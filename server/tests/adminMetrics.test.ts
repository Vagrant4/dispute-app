import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

interface AuthUserResponse {
  devVerificationCode: string;
  user: {
    id: string;
    email: string;
  };
}

interface AdminMetricsResponse {
  metrics: {
    registeredActiveUsers: number;
    monthlyActiveUsers: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    mrrByCurrency: Record<string, number>;
  };
}

describe('admin metrics API', () => {
  let server: Server;
  let baseUrl: string;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const db = await import('../src/db/prisma.js');
    prisma = db.prisma;
    const { createApp } = await import('../src/app.js');
    server = createServer(createApp());
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.emailVerificationToken.deleteMany(),
      prisma.userSubscription.deleteMany(),
      prisma.subscriptionPlan.deleteMany(),
      prisma.appSetting.deleteMany(),
      prisma.user.deleteMany()
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.$disconnect();
  });

  it('requires authentication before exposing developer metrics', async () => {
    const response = await fetch(`${baseUrl}/admin/metrics`);

    expect(response.status).toBe(401);
  });

  it('tracks active users, monthly active users, subscriptions, and MRR', async () => {
    const admin = await registerAndVerify('admin-metrics@example.com');
    const activeRecent = await prisma.user.create({
      data: {
        email: 'active-recent@example.com',
        passwordHash: 'hash',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        lastSeenAt: new Date()
      }
    });
    const activeDormant = await prisma.user.create({
      data: {
        email: 'active-dormant@example.com',
        passwordHash: 'hash',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        lastSeenAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45)
      }
    });
    await prisma.user.create({
      data: {
        email: 'pending@example.com',
        passwordHash: 'hash',
        status: 'PENDING_EMAIL_VERIFICATION'
      }
    });
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: 'Solo Monthly',
        price: '19.00',
        currency: 'SGD',
        billingInterval: 'month',
        limitsJson: '{}',
        status: 'ACTIVE'
      }
    });
    await prisma.userSubscription.createMany({
      data: [
        {
          userId: activeRecent.id,
          planId: plan.id,
          status: 'ACTIVE',
          monthlyRecurringCents: 1900,
          currency: 'SGD'
        },
        {
          userId: activeDormant.id,
          planId: plan.id,
          status: 'TRIALING',
          monthlyRecurringCents: 1900,
          currency: 'SGD'
        }
      ]
    });

    const response = await fetch(`${baseUrl}/admin/metrics`, {
      headers: { Cookie: admin.cookie }
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<AdminMetricsResponse>(response);
    expect(body.metrics).toMatchObject({
      registeredActiveUsers: 3,
      monthlyActiveUsers: 2,
      activeSubscriptions: 1,
      trialingSubscriptions: 1,
      mrrByCurrency: { SGD: 1900 }
    });
  });

  async function registerAndVerify(email: string): Promise<{ id: string; cookie: string }> {
    const registered = await postJson('/auth/register', {
      email,
      password: 'Password123!'
    });
    expect(registered.status).toBe(201);
    const body = await jsonBody<AuthUserResponse>(registered);
    const verified = await postJson('/auth/verify-email', {
      email,
      code: body.devVerificationCode
    });
    expect(verified.status).toBe(200);
    return {
      id: body.user.id,
      cookie: sessionCookie(verified)
    };
  }

  function postJson(path: string, body: unknown, cookie?: string): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {})
      },
      body: JSON.stringify(body)
    });
  }
});

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  expect(setCookie).toBeTruthy();
  return setCookie?.split(';')[0] ?? '';
}

async function jsonBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
