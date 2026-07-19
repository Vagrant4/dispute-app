import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.STRIPE_BILLING_MODE = 'disabled';

interface AuthUserResponse {
  devVerificationCode: string;
  verificationRequired?: boolean;
  message?: string;
  user: {
    id: string;
    email: string;
  };
}

interface SubscriptionStatusResponse {
  subscription: {
    userId: string;
    status: string;
    isActive: boolean;
    billingMode: string;
    billingEnforcementActive: boolean;
    message: string;
  };
}

describe('subscription foundation API', () => {
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
      prisma.allowance.deleteMany(),
      prisma.deduction.deleteMany(),
      prisma.paySummary.deleteMany(),
      prisma.progressClaimReport.deleteMany(),
      prisma.photoEvidence.deleteMany(),
      prisma.timeEntry.deleteMany(),
      prisma.project.deleteMany(),
      prisma.company.deleteMany(),
      prisma.workerProfile.deleteMany(),
      prisma.emailVerificationToken.deleteMany(),
      prisma.userSubscription.deleteMany(),
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

  it('requires authentication for subscription status', async () => {
    const response = await fetch(`${baseUrl}/subscription/status`);

    expect(response.status).toBe(401);
  });

  it('returns a conservative foundation-only entitlement for the authenticated user', async () => {
    const user = await registerUser('subscription-status@example.com');

    const response = await fetch(`${baseUrl}/subscription/status`, {
      headers: { Cookie: user.cookie }
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<SubscriptionStatusResponse>(response);
    expect(body.subscription).toMatchObject({
      userId: user.id,
      status: 'FOUNDATION_ONLY',
      isActive: false,
      billingMode: 'disabled',
      billingEnforcementActive: false
    });
    expect(body.subscription.message).toMatch(/not active in V1/i);
  });

  it('does not create checkout sessions while billing is disabled', async () => {
    const user = await registerUser('subscription-checkout@example.com');

    const response = await postJson('/subscription/create-checkout-session', {}, user.cookie);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(501);
    expect(body).toMatchObject({
      error: 'Subscription billing is disabled in this V1 foundation.',
      billingMode: 'disabled'
    });
  });

  it('requires authentication before disabled checkout session handling', async () => {
    const response = await postJson('/subscription/create-checkout-session', {});

    expect(response.status).toBe(401);
  });

  it('leaves webhook handling disabled until raw body signature verification is implemented', async () => {
    const response = await postJson('/subscription/webhook', {
      type: 'customer.subscription.updated'
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(501);
    expect(body).toMatchObject({
      error: 'Stripe webhook handling is disabled until signature verification is implemented.',
      billingMode: 'disabled'
    });
  });

  async function registerUser(email: string): Promise<{ id: string; cookie: string }> {
    const response = await postJson('/auth/register', {
      email,
      password: 'Password123!'
    });
    expect(response.status).toBe(201);
    const body = await jsonBody<AuthUserResponse>(response);
    return {
      id: body.user.id,
      cookie: await verifiedCookie(email, body.devVerificationCode)
    };
  }
  async function verifiedCookie(email: string, code: string): Promise<string> {
    expect(code).toMatch(/^\d{6}$/);
    const response = await postJson('/auth/verify-email', { email, code });
    expect(response.status).toBe(200);
    return sessionCookie(response);
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
