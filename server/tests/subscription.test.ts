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
    canExportReports: boolean;
    billingProvider: string;
    billingEnforcementActive: boolean;
    planName: string;
    priceCents: number;
    currency: string;
    trialEndsAt: string | null;
    message: string;
  };
}

describe('subscription API', () => {
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

  it('returns a 3-day trial entitlement for the authenticated user after email verification', async () => {
    const user = await registerUser('subscription-status@example.com');

    const response = await fetch(`${baseUrl}/subscription/status`, {
      headers: { Cookie: user.cookie }
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<SubscriptionStatusResponse>(response);
    expect(body.subscription).toMatchObject({
      userId: user.id,
      status: 'TRIALING',
      isActive: true,
      canExportReports: true,
      billingProvider: 'store',
      billingEnforcementActive: true,
      planName: 'DISPUTE Basic',
      priceCents: 499,
      currency: 'SGD'
    });
    expect(body.subscription.trialEndsAt).toEqual(expect.any(String));
    expect(Date.parse(body.subscription.trialEndsAt!)).toBeGreaterThan(Date.now());
    expect(body.subscription.message).toMatch(/Trial active/i);
  });

  it('blocks export when the 3-day trial is expired', async () => {
    const user = await registerUser('subscription-expired@example.com');
    await prisma.userSubscription.updateMany({
      where: { userId: user.id },
      data: { trialEndsAt: new Date(Date.now() - 1000), currentPeriodEnd: new Date(Date.now() - 1000) }
    });

    const response = await fetch(`${baseUrl}/subscription/status`, {
      headers: { Cookie: user.cookie }
    });

    expect(response.status).toBe(200);
    const body = await jsonBody<SubscriptionStatusResponse>(response);
    expect(body.subscription).toMatchObject({
      status: 'EXPIRED',
      isActive: false,
      canExportReports: false
    });
    expect(body.subscription.message).toMatch(/Subscribe to export reports/i);

    const reportResponse = await postJson('/reports/progress-claim', {}, user.cookie);
    expect(reportResponse.status).toBe(402);
    await expect(reportResponse.json()).resolves.toMatchObject({
      error: 'An active DISPUTE trial or subscription is required to export reports.'
    });
  });

  it('keeps checkout creation in the mobile store purchase path', async () => {
    const user = await registerUser('subscription-checkout@example.com');

    const response = await postJson('/subscription/create-checkout-session', {}, user.cookie);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: 'Use the mobile Subscribe button. DISPUTE mobile subscriptions are handled by Apple App Store or Google Play.',
      billingProvider: 'store'
    });
  });

  it('requires authentication before checkout session handling', async () => {
    const response = await postJson('/subscription/create-checkout-session', {});

    expect(response.status).toBe(401);
  });

  it('updates subscription status from RevenueCat webhook events', async () => {
    const user = await registerUser('subscription-webhook@example.com');
    const response = await postJson('/subscription/webhook', {
      event: {
        type: 'INITIAL_PURCHASE',
        product_id: 'dispute_basic_monthly',
        app_user_id: user.id,
        transaction_id: 'store_txn_123',
        price_in_purchased_currency: 4.99,
        currency: 'SGD',
        purchased_at_ms: Date.now(),
        expiration_at_ms: Date.now() + 1000 * 60 * 60 * 24 * 30
      }
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      received: true,
      userId: user.id,
      status: 'ACTIVE'
    });

    const statusResponse = await fetch(`${baseUrl}/subscription/status`, {
      headers: { Cookie: user.cookie }
    });
    const statusBody = await jsonBody<SubscriptionStatusResponse>(statusResponse);
    expect(statusBody.subscription).toMatchObject({
      status: 'ACTIVE',
      isActive: true,
      canExportReports: true,
      priceCents: 499,
      currency: 'SGD'
    });
  });

  it('backfills a 3-day trial for a verified user missing a subscription row', async () => {
    const user = await registerUser('subscription-backfill@example.com');
    await prisma.userSubscription.deleteMany({ where: { userId: user.id } });

    const response = await fetch(`${baseUrl}/subscription/status`, {
      headers: { Cookie: user.cookie }
    });
    const body = await jsonBody<SubscriptionStatusResponse>(response);

    expect(response.status).toBe(200);
    expect(body.subscription).toMatchObject({ status: 'TRIALING', isActive: true, canExportReports: true });
    expect(await prisma.userSubscription.count({ where: { userId: user.id } })).toBe(1);
  });

  it('rejects webhooks for another product or an unknown event type', async () => {
    const user = await registerUser('subscription-rejected-webhook@example.com');

    const wrongProduct = await postJson('/subscription/webhook', {
      event: { type: 'INITIAL_PURCHASE', product_id: 'another_product', app_user_id: user.id }
    });
    expect(wrongProduct.status).toBe(400);

    const unknownEvent = await postJson('/subscription/webhook', {
      event: { type: 'TEST_OR_UNKNOWN', product_id: 'dispute_basic_monthly', app_user_id: user.id }
    });
    expect(unknownEvent.status).toBe(400);

    const subscription = await prisma.userSubscription.findFirst({ where: { userId: user.id } });
    expect(subscription?.status).toBe('TRIALING');
  });

  async function registerUser(email: string): Promise<{ id: string; cookie: string }> {
    const response = await postJson('/auth/register', {
      email,
      password: 'Password123!',
      fullName: 'Test Worker',
      phone: '+65 9000 0000'
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
