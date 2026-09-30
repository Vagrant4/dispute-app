import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.ADMIN_EMAILS = 'admin-metrics@example.com';

interface AuthUserResponse {
  devVerificationCode: string;
  user: {
    id: string;
    email: string;
  };
}

interface AdminMetricsResponse {
  metrics: {
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    suspendedUsers: number;
    monthlyActiveUsers: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    defaultTrialDays: number;
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
      prisma.adminAuditLog.deleteMany(),
      prisma.emailVerificationToken.deleteMany(),
      prisma.userSubscription.deleteMany(),
      prisma.subscriptionPlan.deleteMany(),
      prisma.appSetting.deleteMany(),
      prisma.workerProfile.deleteMany(),
      prisma.user.deleteMany()
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.$disconnect();
  });

  it('requires authentication before exposing admin metrics', async () => {
    const response = await fetch(`${baseUrl}/admin/metrics`);
    expect(response.status).toBe(401);
  });

  it('rejects an authenticated non-admin user', async () => {
    const worker = await registerAndVerify('worker-metrics@example.com');
    const response = await fetch(`${baseUrl}/admin/metrics`, {
      headers: { Cookie: worker.cookie }
    });
    expect(response.status).toBe(403);
  });

  it('tracks account, trial, subscription, activity and MRR metrics for admins', async () => {
    const admin = await registerAndVerify('admin-metrics@example.com');
    const now = new Date();
    const future = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 20);

    const activeRecent = await prisma.user.create({
      data: {
        email: 'active-recent@example.com',
        passwordHash: 'hash',
        status: 'ACTIVE',
        emailVerifiedAt: now,
        lastSeenAt: now
      }
    });
    const activeDormant = await prisma.user.create({
      data: {
        email: 'active-dormant@example.com',
        passwordHash: 'hash',
        status: 'ACTIVE',
        emailVerifiedAt: now,
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
    await prisma.user.create({
      data: {
        email: 'suspended@example.com',
        passwordHash: 'hash',
        status: 'SUSPENDED',
        emailVerifiedAt: now
      }
    });

    const plan = await prisma.subscriptionPlan.findFirstOrThrow({
      where: { subscriptions: { some: { userId: admin.id } } }
    });

    await prisma.userSubscription.createMany({
      data: [
        {
          userId: activeRecent.id,
          planId: plan.id,
          status: 'ACTIVE',
          monthlyRecurringCents: 1900,
          currency: 'SGD',
          currentPeriodStart: now,
          currentPeriodEnd: future
        },
        {
          userId: activeDormant.id,
          planId: plan.id,
          status: 'TRIALING',
          monthlyRecurringCents: 699,
          currency: 'SGD',
          currentPeriodStart: now,
          currentPeriodEnd: future,
          trialEndsAt: future
        }
      ]
    });

    const response = await fetch(`${baseUrl}/admin/metrics`, {
      headers: { Cookie: admin.cookie }
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<AdminMetricsResponse>(response);
    expect(body.metrics).toMatchObject({
      totalUsers: 5,
      activeUsers: 3,
      pendingUsers: 1,
      suspendedUsers: 1,
      monthlyActiveUsers: 2,
      activeSubscriptions: 1,
      trialingSubscriptions: 2,
      defaultTrialDays: 30,
      mrrByCurrency: { SGD: 1900 }
    });
  });

  async function registerAndVerify(email: string): Promise<{ id: string; cookie: string }> {
    const registered = await postJson('/auth/register', {
      email,
      password: 'Password123!',
      fullName: 'Test Worker',
      phone: '+65 9000 0000'
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
