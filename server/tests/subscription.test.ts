import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTrialSubscriptionForUser,
  syncSubscriptionFromRevenueCat,
  validateRevenueCatStoreContext
} from '../src/modules/subscription/subscription.service.js';

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
    canCreateRecords: boolean;
    hasReferralRewardAccess: boolean;
    referralRewardEndsAt: string | null;
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
      prisma.subscriptionEvent.deleteMany(),
      prisma.referralReward.deleteMany(),
      prisma.referral.deleteMany(),
      prisma.referralPhoneClaim.deleteMany(),
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
      priceCents: 699,
      currency: 'SGD'
    });
    expect(body.subscription.trialEndsAt).toEqual(expect.any(String));
    expect(Date.parse(body.subscription.trialEndsAt!)).toBeGreaterThan(Date.now());
    expect(body.subscription.message).toMatch(/Trial active/i);
  });

  it('rejects sandbox and non-platform store webhooks at the production boundary', () => {
    expect(
      validateRevenueCatStoreContext(
        { store: 'PLAY_STORE', environment: 'SANDBOX' },
        'production'
      )
    ).toMatch(/matching store testing pilot flag/i);
    expect(
      validateRevenueCatStoreContext(
        { store: 'AMAZON', environment: 'PRODUCTION' },
        'production'
      )
    ).toMatch(/Google Play or Apple App Store/i);
    expect(
      validateRevenueCatStoreContext(
        { store: 'PLAY_STORE', environment: 'PRODUCTION' },
        'production'
      )
    ).toBeNull();
  });

  it('accepts Play license-tester sandbox webhooks only when the pilot flag is enabled', () => {
    expect(
      validateRevenueCatStoreContext(
        { store: 'PLAY_STORE', environment: 'SANDBOX' },
        'production',
        true
      )
    ).toBeNull();
    expect(
      validateRevenueCatStoreContext(
        { store: 'AMAZON', environment: 'SANDBOX' },
        'production',
        true
      )
    ).toMatch(/Google Play or Apple App Store/i);
    expect(
      validateRevenueCatStoreContext(
        { store: 'APP_STORE', environment: 'SANDBOX' },
        'production',
        true
      )
    ).toMatch(/matching store testing pilot flag/i);
    expect(
      validateRevenueCatStoreContext(
        { store: 'PLAY_STORE', environment: 'SANDBOX' },
        'development',
        false
      )
    ).toMatch(/matching store testing pilot flag/i);
    expect(
      validateRevenueCatStoreContext(
        { store: 'APP_STORE', environment: 'SANDBOX' },
        'development',
        true
      )
    ).toMatch(/matching store testing pilot flag/i);
    expect(
      validateRevenueCatStoreContext(
        { store: 'APP_STORE', environment: 'SANDBOX' },
        'production',
        false,
        true
      )
    ).toBeNull();
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
    expect(body.subscription.message).toMatch(/Subscribe to create new records or export premium PDF\/CSV reports/i);

    const reportResponse = await postJson('/reports/progress-claim', {}, user.cookie);
    expect(reportResponse.status).toBe(402);
    await expect(reportResponse.json()).resolves.toMatchObject({
      error: 'An active DISPUTE trial, subscription or fulfilled referral reward is required to export reports.'
    });

    const projectResponse = await postJson('/projects', {}, user.cookie);
    expect(projectResponse.status).toBe(402);
    await expect(projectResponse.json()).resolves.toMatchObject({
      error: 'An active DISPUTE trial, subscription or fulfilled referral reward is required to create or change work records.'
    });

    const payResponse = await postJson('/pay-summaries/generate', {}, user.cookie);
    expect(payResponse.status).toBe(402);

    const reportDeleteResponse = await fetch(`${baseUrl}/reports/not-a-report`, {
      method: 'DELETE',
      headers: { Cookie: user.cookie }
    });
    expect(reportDeleteResponse.status).toBe(402);
  });

  it('fails closed when an active entitlement has no period end', async () => {
    const user = await registerUser('subscription-missing-end@example.com');
    await prisma.userSubscription.updateMany({
      where: { userId: user.id },
      data: { status: 'ACTIVE', currentPeriodEnd: null }
    });

    const response = await fetch(`${baseUrl}/subscription/status`, {
      headers: { Cookie: user.cookie }
    });
    const body = await jsonBody<SubscriptionStatusResponse>(response);
    expect(body.subscription).toMatchObject({
      status: 'EXPIRED', isActive: false, canCreateRecords: false, canExportReports: false
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

  it('requires authentication for RevenueCat subscription synchronization', async () => {
    const response = await postJson('/subscription/sync', {});

    expect(response.status).toBe(401);
  });

  it('restores backend access from an authenticated active RevenueCat subscription', async () => {
    const user = await registerUser('subscription-restore-sync@example.com');
    await prisma.userSubscription.updateMany({
      where: { userId: user.id },
      data: {
        status: 'EXPIRED',
        trialEndsAt: new Date(0),
        currentPeriodEnd: new Date(0)
      }
    });
    const now = new Date('2026-08-08T00:00:00.000Z');
    const periodEnd = new Date('2026-09-08T00:00:00.000Z');
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`
      );
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-server-key');
      return Response.json({
        request_date: now.toISOString(),
        subscriber: {
          entitlements: {
            dispute_basic: {
              expires_date: periodEnd.toISOString(),
              grace_period_expires_date: null,
              product_identifier: 'dispute_basic_monthly:monthly-plan',
              purchase_date: '2026-08-08T00:00:00.000Z'
            }
          },
          subscriptions: {
            'dispute_basic_monthly:monthly-plan': {
              billing_issues_detected_at: null,
              expires_date: periodEnd.toISOString(),
              grace_period_expires_date: null,
              is_sandbox: true,
              period_type: 'normal',
              purchase_date: '2026-08-08T00:00:00.000Z',
              refunded_at: null,
              store: 'play_store',
              store_transaction_id: 'test-store-transaction',
              unsubscribe_detected_at: null
            }
          }
        }
      });
    };

    const sync = await syncSubscriptionFromRevenueCat(user.id, {
      allowSandboxEvents: true,
      entitlementId: 'dispute_basic',
      fetcher,
      nodeEnv: 'production',
      now,
      productId: 'dispute_basic_monthly',
      secretApiKey: 'test-server-key'
    });

    expect(sync.statusCode).toBe(200);
    expect(sync.body).toMatchObject({ synced: true, status: 'ACTIVE' });
    const response = await fetch(`${baseUrl}/subscription/status`, {
      headers: { Cookie: user.cookie }
    });
    const body = await jsonBody<SubscriptionStatusResponse>(response);
    expect(body.subscription).toMatchObject({
      userId: user.id,
      status: 'ACTIVE',
      isActive: true,
      canCreateRecords: true,
      canExportReports: true
    });
  });

  it('preserves backend status when RevenueCat verification is unavailable or invalid', async () => {
    const user = await registerUser('subscription-restore-fails-closed@example.com');
    await prisma.userSubscription.updateMany({
      where: { userId: user.id },
      data: {
        status: 'EXPIRED',
        trialEndsAt: new Date(0),
        currentPeriodEnd: new Date(0)
      }
    });
    const now = new Date('2026-08-08T00:00:00.000Z');
    const invalidProduct = await syncSubscriptionFromRevenueCat(user.id, {
      allowSandboxEvents: true,
      entitlementId: 'dispute_basic',
      fetcher: async () => Response.json(revenueCatCustomerInfo({
        productId: 'another_product',
        sandbox: true
      })),
      nodeEnv: 'production',
      now,
      productId: 'dispute_basic_monthly',
      secretApiKey: 'test-server-key'
    });
    expect(invalidProduct.statusCode).toBe(409);

    const rejectedSandbox = await syncSubscriptionFromRevenueCat(user.id, {
      allowSandboxEvents: false,
      entitlementId: 'dispute_basic',
      fetcher: async () => Response.json(revenueCatCustomerInfo({ sandbox: true })),
      nodeEnv: 'production',
      now,
      productId: 'dispute_basic_monthly',
      secretApiKey: 'test-server-key'
    });
    expect(rejectedSandbox.statusCode).toBe(409);

    const malformed = await syncSubscriptionFromRevenueCat(user.id, {
      entitlementId: 'dispute_basic',
      fetcher: async () => Response.json({ unexpected: true }),
      nodeEnv: 'production',
      now,
      productId: 'dispute_basic_monthly',
      secretApiKey: 'test-server-key'
    });
    expect(malformed.statusCode).toBe(502);

    const unavailable = await syncSubscriptionFromRevenueCat(user.id, {
      entitlementId: 'dispute_basic',
      fetcher: async () => {
        throw new Error('network unavailable');
      },
      nodeEnv: 'production',
      now,
      productId: 'dispute_basic_monthly',
      secretApiKey: 'test-server-key'
    });
    expect(unavailable.statusCode).toBe(502);

    const subscription = await prisma.userSubscription.findFirst({
      where: { userId: user.id }
    });
    expect(subscription).toMatchObject({ status: 'EXPIRED' });
    expect(subscription?.currentPeriodEnd?.getTime()).toBe(0);
  });

  it.each([
    ['a bare Play subscription id', { productId: 'dispute_basic_monthly' }],
    ['a legacy Play base plan', { productId: 'dispute_basic_monthly:legacy-plan' }],
    ['a yearly Play base plan', { productId: 'dispute_basic_monthly:yearly-plan' }],
    ['an unknown period type', { subscriptionOverrides: { period_type: 'lifetime' } }],
    ['a malformed billing issue date', { subscriptionOverrides: { billing_issues_detected_at: 123 } }],
    ['a missing cancellation field', { subscriptionOverrides: { unsubscribe_detected_at: undefined } }],
    ['an Apple sandbox receipt', { sandbox: true, store: 'app_store' }]
  ])('fails closed for %s', async (_label, fixture) => {
    const user = await registerUser(`subscription-strict-${crypto.randomUUID()}@example.com`);
    await prisma.userSubscription.updateMany({
      where: { userId: user.id },
      data: { status: 'EXPIRED', trialEndsAt: new Date(0), currentPeriodEnd: new Date(0) }
    });
    const result = await syncSubscriptionFromRevenueCat(user.id, {
      allowSandboxEvents: true,
      entitlementId: 'dispute_basic',
      fetcher: async () => Response.json(revenueCatCustomerInfo(fixture)),
      nodeEnv: 'production',
      now: new Date('2026-08-08T00:00:00.000Z'),
      productId: 'dispute_basic_monthly',
      secretApiKey: 'test-server-key'
    });

    expect(result.statusCode).toBe(409);
    const subscription = await prisma.userSubscription.findFirst({ where: { userId: user.id } });
    expect(subscription).toMatchObject({ status: 'EXPIRED' });
    expect(subscription?.currentPeriodEnd?.getTime()).toBe(0);
  });

  it('updates only the authenticated owner and creates a missing owner row', async () => {
    const owner = await registerUser('subscription-owner-sync@example.com');
    const other = await registerUser('subscription-other-user@example.com');
    await prisma.userSubscription.deleteMany({ where: { userId: owner.id } });
    await prisma.userSubscription.updateMany({
      where: { userId: other.id },
      data: { status: 'EXPIRED', trialEndsAt: new Date(0), currentPeriodEnd: new Date(0) }
    });

    const result = await syncSubscriptionFromRevenueCat(owner.id, {
      allowSandboxEvents: true,
      entitlementId: 'dispute_basic',
      fetcher: async () => Response.json(revenueCatCustomerInfo({ sandbox: true })),
      nodeEnv: 'production',
      now: new Date('2026-08-08T00:00:00.000Z'),
      productId: 'dispute_basic_monthly',
      secretApiKey: 'test-server-key'
    });

    expect(result.statusCode).toBe(200);
    expect(await prisma.userSubscription.count({ where: { userId: owner.id } })).toBe(1);
    await expect(prisma.userSubscription.findFirst({ where: { userId: owner.id } }))
      .resolves.toMatchObject({ status: 'ACTIVE' });
    await expect(prisma.userSubscription.findFirst({ where: { userId: other.id } }))
      .resolves.toMatchObject({ status: 'EXPIRED' });
  });

  it('keeps one owner row when concurrent verification starts without a subscription', async () => {
    const owner = await registerUser('subscription-concurrent-owner@example.com');
    await prisma.userSubscription.deleteMany({ where: { userId: owner.id } });
    const sync = () => syncSubscriptionFromRevenueCat(owner.id, {
      allowSandboxEvents: true,
      entitlementId: 'dispute_basic',
      fetcher: async () => Response.json(revenueCatCustomerInfo({ sandbox: true })),
      nodeEnv: 'production',
      now: new Date('2026-08-08T00:00:00.000Z'),
      productId: 'dispute_basic_monthly',
      secretApiKey: 'test-server-key'
    });

    const results = await Promise.all([sync(), sync()]);

    expect(results.map((result) => result.statusCode)).toEqual([200, 200]);
    expect(await prisma.userSubscription.count({ where: { userId: owner.id } })).toBe(1);
  });

  it('allows App Store sandbox verification only with the separate TestFlight flag', async () => {
    const user = await registerUser('subscription-testflight-sync@example.com');
    await prisma.userSubscription.updateMany({
      where: { userId: user.id },
      data: { status: 'EXPIRED', trialEndsAt: new Date(0), currentPeriodEnd: new Date(0) }
    });

    const result = await syncSubscriptionFromRevenueCat(user.id, {
      allowAppleSandboxEvents: true,
      allowSandboxEvents: false,
      entitlementId: 'dispute_basic',
      fetcher: async () => Response.json(revenueCatCustomerInfo({
        productId: 'dispute_basic_monthly',
        sandbox: true,
        store: 'app_store'
      })),
      nodeEnv: 'production',
      now: new Date('2026-08-08T00:00:00.000Z'),
      productId: 'dispute_basic_monthly',
      secretApiKey: 'test-server-key'
    });

    expect(result.statusCode).toBe(200);
    await expect(prisma.userSubscription.findUnique({ where: { userId: user.id } }))
      .resolves.toMatchObject({ status: 'ACTIVE' });
  });

  it('rate limits repeated authenticated subscription sync requests per user', async () => {
    const user = await registerUser('subscription-sync-rate-limit@example.com');
    const { env } = await import('../src/config/env.js');
    const mutableRevenueCat = env.revenueCat as { secretApiKey: string };
    const previousSecret = mutableRevenueCat.secretApiKey;
    mutableRevenueCat.secretApiKey = '';
    try {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await postJson('/subscription/sync', {}, user.cookie);
        expect(response.status).toBe(503);
      }
      const blocked = await postJson('/subscription/sync', {}, user.cookie);
      expect(blocked.status).toBe(429);
      await expect(blocked.json()).resolves.toMatchObject({
        error: 'Too many subscription verification attempts. Wait 15 minutes and try again.'
      });
    } finally {
      mutableRevenueCat.secretApiKey = previousSecret;
    }
  });

  it('does not call RevenueCat when server-side verification is not configured', async () => {
    let fetchCalled = false;
    const result = await syncSubscriptionFromRevenueCat('authenticated-user', {
      entitlementId: 'dispute_basic',
      fetcher: async () => {
        fetchCalled = true;
        return Response.json({});
      },
      productId: 'dispute_basic_monthly',
      secretApiKey: ''
    });

    expect(result.statusCode).toBe(503);
    expect(fetchCalled).toBe(false);
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
        product_id: 'dispute_basic_monthly:monthly-plan',
        entitlement_ids: ['dispute_basic'],
        store: 'PLAY_STORE',
        environment: 'PRODUCTION',
        app_user_id: user.id,
        transaction_id: 'store_txn_123',
        price_in_purchased_currency: 6.99,
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
      priceCents: 699,
      currency: 'SGD'
    });
  });

  it('keeps canceled subscription access until the paid period expires', async () => {
    const user = await registerUser('subscription-canceled@example.com');
    const periodEnd = Date.now() + 1000 * 60 * 60 * 24 * 10;
    const cancellation = await postJson('/subscription/webhook', {
      event: {
        type: 'CANCELLATION',
        product_id: 'dispute_basic_monthly',
        entitlement_ids: ['dispute_basic'],
        store: 'PLAY_STORE',
        environment: 'PRODUCTION',
        app_user_id: user.id,
        transaction_id: 'store_txn_canceled',
        price_in_purchased_currency: 6.99,
        currency: 'SGD',
        purchased_at_ms: Date.now() - 1000 * 60 * 60 * 24 * 20,
        expiration_at_ms: periodEnd
      }
    });

    expect(cancellation.status).toBe(200);
    await expect(cancellation.json()).resolves.toMatchObject({ status: 'CANCELED' });

    const currentResponse = await fetch(`${baseUrl}/subscription/status`, {
      headers: { Cookie: user.cookie }
    });
    const current = await jsonBody<SubscriptionStatusResponse>(currentResponse);
    expect(current.subscription).toMatchObject({
      status: 'CANCELED',
      isActive: true,
      canExportReports: true
    });
    expect(current.subscription.message).toMatch(/remains available until/i);

    await prisma.userSubscription.updateMany({
      where: { userId: user.id },
      data: { currentPeriodEnd: new Date(Date.now() - 1000) }
    });
    const expiredResponse = await fetch(`${baseUrl}/subscription/status`, {
      headers: { Cookie: user.cookie }
    });
    const expired = await jsonBody<SubscriptionStatusResponse>(expiredResponse);
    expect(expired.subscription).toMatchObject({
      status: 'EXPIRED',
      isActive: false,
      canExportReports: false
    });
  });

  it('backfills a 3-day trial for a verified user missing a subscription row', async () => {
    const user = await registerUser('subscription-backfill@example.com');
    await prisma.userSubscription.deleteMany({ where: { userId: user.id } });
    const verifiedAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: verifiedAt } });

    const response = await fetch(`${baseUrl}/subscription/status`, {
      headers: { Cookie: user.cookie }
    });
    const body = await jsonBody<SubscriptionStatusResponse>(response);

    expect(response.status).toBe(200);
    expect(body.subscription).toMatchObject({ status: 'EXPIRED', isActive: false, canExportReports: false });
    expect(await prisma.userSubscription.count({ where: { userId: user.id } })).toBe(1);
  });

  it('atomically creates one trial when concurrent backfills find no subscription', async () => {
    const user = await registerUser('subscription-concurrent-trial@example.com');
    await prisma.userSubscription.deleteMany({ where: { userId: user.id } });
    const verifiedAt = new Date('2026-08-08T00:00:00.000Z');

    await Promise.all([
      createTrialSubscriptionForUser(user.id, verifiedAt),
      createTrialSubscriptionForUser(user.id, verifiedAt)
    ]);

    expect(await prisma.userSubscription.count({ where: { userId: user.id } })).toBe(1);
    await expect(prisma.userSubscription.findUnique({ where: { userId: user.id } }))
      .resolves.toMatchObject({ status: 'TRIALING', provider: 'store' });
  });

  it('grants and expires a fulfilled referral reward access window', async () => {
    const user = await registerUser('subscription-reward@example.com');
    await prisma.userSubscription.updateMany({
      where: { userId: user.id },
      data: { status: 'EXPIRED', trialEndsAt: new Date(0), currentPeriodEnd: new Date(0) }
    });
    await prisma.referralReward.create({
      data: {
        userId: user.id,
        ordinal: 1,
        status: 'FULFILLED',
        fulfilledAt: new Date(),
        fulfillmentStartsAt: new Date(Date.now() - 1000),
        fulfillmentEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        fulfillmentRef: 'test-fulfillment'
      }
    });

    const activeResponse = await fetch(`${baseUrl}/subscription/status`, {
      headers: { Cookie: user.cookie }
    });
    const active = await jsonBody<SubscriptionStatusResponse>(activeResponse);
    expect(active.subscription).toMatchObject({
      status: 'EXPIRED',
      isActive: true,
      canCreateRecords: true,
      canExportReports: true,
      hasReferralRewardAccess: true
    });

    await prisma.referralReward.updateMany({
      where: { userId: user.id },
      data: { fulfillmentEndsAt: new Date(Date.now() - 1000) }
    });
    const expiredResponse = await fetch(`${baseUrl}/subscription/status`, {
      headers: { Cookie: user.cookie }
    });
    const expired = await jsonBody<SubscriptionStatusResponse>(expiredResponse);
    expect(expired.subscription).toMatchObject({
      isActive: false,
      canCreateRecords: false,
      canExportReports: false,
      hasReferralRewardAccess: false
    });
  });

  it('rejects webhooks for another product or an unknown event type', async () => {
    const user = await registerUser('subscription-rejected-webhook@example.com');

    const wrongProduct = await postJson('/subscription/webhook', {
      event: {
        type: 'INITIAL_PURCHASE',
        product_id: 'dispute_basic_monthly:legacy-plan',
        entitlement_ids: ['dispute_basic'],
        store: 'PLAY_STORE',
        environment: 'SANDBOX',
        app_user_id: user.id
      }
    });
    expect(wrongProduct.status).toBe(400);

    const wrongEntitlement = await postJson('/subscription/webhook', {
      event: {
        type: 'INITIAL_PURCHASE',
        product_id: 'dispute_basic_monthly',
        entitlement_ids: ['another_entitlement'],
        store: 'PLAY_STORE',
        environment: 'SANDBOX',
        app_user_id: user.id
      }
    });
    expect(wrongEntitlement.status).toBe(400);

    const unsupportedStore = await postJson('/subscription/webhook', {
      event: {
        type: 'INITIAL_PURCHASE',
        product_id: 'dispute_basic_monthly',
        entitlement_ids: ['dispute_basic'],
        store: 'AMAZON',
        environment: 'PRODUCTION',
        app_user_id: user.id
      }
    });
    expect(unsupportedStore.status).toBe(400);

    const unknownEvent = await postJson('/subscription/webhook', {
      event: {
        type: 'TEST_OR_UNKNOWN',
        product_id: 'dispute_basic_monthly',
        entitlement_ids: ['dispute_basic'],
        store: 'PLAY_STORE',
        environment: 'SANDBOX',
        app_user_id: user.id
      }
    });
    expect(unknownEvent.status).toBe(400);

    const missingExpiration = await postJson('/subscription/webhook', {
      event: {
        type: 'INITIAL_PURCHASE',
        product_id: 'dispute_basic_monthly',
        entitlement_ids: ['dispute_basic'],
        store: 'PLAY_STORE',
        environment: 'SANDBOX',
        app_user_id: user.id,
        transaction_id: 'missing-expiration',
        price_in_purchased_currency: 6.99,
        currency: 'SGD'
      }
    });
    expect(missingExpiration.status).toBe(400);

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

function revenueCatCustomerInfo({
  productId = 'dispute_basic_monthly:monthly-plan',
  sandbox = false,
  store = 'play_store',
  subscriptionOverrides = {}
}: {
  productId?: string;
  sandbox?: boolean;
  store?: string;
  subscriptionOverrides?: Record<string, unknown>;
} = {}) {
  return {
    subscriber: {
      entitlements: {
        dispute_basic: {
          expires_date: '2026-09-08T00:00:00.000Z',
          grace_period_expires_date: null,
          product_identifier: productId,
          purchase_date: '2026-08-08T00:00:00.000Z'
        }
      },
      subscriptions: {
        [productId]: {
          billing_issues_detected_at: null,
          expires_date: '2026-09-08T00:00:00.000Z',
          grace_period_expires_date: null,
          is_sandbox: sandbox,
          period_type: 'normal',
          purchase_date: '2026-08-08T00:00:00.000Z',
          refunded_at: null,
          store,
          store_transaction_id: 'test-store-transaction',
          unsubscribe_detected_at: null,
          ...subscriptionOverrides
        }
      }
    }
  };
}
