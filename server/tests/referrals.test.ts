import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getReferralSummary, recordPaidReferralPeriod } from '../src/modules/referrals/referral.service.js';

process.env.JWT_SECRET = 'test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.STRIPE_BILLING_MODE = 'disabled';

describe('referral pilot', () => {
  let server: Server;
  let baseUrl: string;
  let prisma: PrismaClient;

  it('backfills abuse-control phone claims only for verified active accounts', () => {
    const migrationSql = readFileSync(
      new URL('../prisma/migrations/20260804193000_android_pilot_referrals/migration.sql', import.meta.url),
      'utf8'
    );

    expect(migrationSql).toMatch(/INNER JOIN "User" u ON u\."id" = p\."userId"/);
    expect(migrationSql).toMatch(/u\."status" = 'ACTIVE'/);
    expect(migrationSql).toMatch(/u\."emailVerifiedAt" IS NOT NULL/);
  });

  beforeAll(async () => {
    const db = await import('../src/db/prisma.js');
    prisma = db.prisma;
    const { createApp } = await import('../src/app.js');
    server = createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.subscriptionEvent.deleteMany(),
      prisma.referralReward.deleteMany(),
      prisma.referral.deleteMany(),
      prisma.referralPhoneClaim.deleteMany(),
      prisma.userSubscription.deleteMany(),
      prisma.workerProfile.deleteMany(),
      prisma.emailVerificationToken.deleteMany(),
      prisma.appSetting.deleteMany(),
      prisma.user.deleteMany()
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  });

  it('locks a valid referral to a new account and exposes a shareable HTTPS production path', async () => {
    const referrer = await registerAndVerify('referrer@example.com', '+65 9000 0001');
    const referrerRecord = await prisma.user.findUniqueOrThrow({ where: { id: referrer.id } });

    const referredRegistration = await postJson('/auth/register', {
      email: 'referred@example.com',
      password: 'Password123!',
      fullName: 'Referred Worker',
      phone: '+65 9000 0002',
      referralCode: referrerRecord.referralCode
    });
    expect(referredRegistration.status).toBe(201);
    const referredBody = await jsonBody<{ user: { id: string }; devVerificationCode: string }>(referredRegistration);

    const pendingSummaryResponse = await fetch(`${baseUrl}/referrals/me`, { headers: { Cookie: referrer.cookie } });
    const pendingSummary = await jsonBody<{ referral: Record<string, unknown> }>(pendingSummaryResponse);
    expect(pendingSummary.referral).toMatchObject({ referredCount: 0, qualifiedCount: 0 });

    await postJson('/auth/verify-email', { email: 'referred@example.com', code: referredBody.devVerificationCode });

    const referral = await prisma.referral.findUnique({ where: { referredUserId: referredBody.user.id } });
    expect(referral).toMatchObject({
      referrerUserId: referrer.id,
      codeUsed: referrerRecord.referralCode,
      status: 'PENDING',
      paidPeriodCount: 0
    });

    const summaryResponse = await fetch(`${baseUrl}/referrals/me`, { headers: { Cookie: referrer.cookie } });
    expect(summaryResponse.status).toBe(200);
    const summary = await jsonBody<{ referral: Record<string, unknown> }>(summaryResponse);
    expect(summary.referral).toMatchObject({
      code: referrerRecord.referralCode,
      referredCount: 1,
      qualifiedCount: 0,
      earnedRewardMonths: 0
    });
    expect(String(summary.referral.shareUrl)).toContain(`/referrals/r/${referrerRecord.referralCode}`);
  });

  it('rejects invalid referral codes and duplicate normalized mobile numbers', async () => {
    const invalid = await postJson('/auth/register', {
      email: 'invalid-referral@example.com',
      password: 'Password123!',
      fullName: 'Invalid Referral',
      phone: '+65 9000 0010',
      referralCode: 'DSP-NOTACTIVE'
    });
    expect(invalid.status).toBe(400);

    const referrer = await registerAndVerify('phone-referrer@example.com', '+65 9000 0012');
    const referrerRecord = await prisma.user.findUniqueOrThrow({ where: { id: referrer.id } });
    await registerAndVerify('phone-owner@example.com', '+65 9000 0011');
    const duplicatePhone = await postJson('/auth/register', {
      email: 'duplicate-phone@example.com',
      password: 'Password123!',
      fullName: 'Duplicate Phone',
      phone: '+65 9000-0011',
      referralCode: referrerRecord.referralCode
    });
    expect(duplicatePhone.status).toBe(409);
  });

  it('locks a referral phone only when email verification succeeds', async () => {
    const referrer = await registerAndVerify('pending-referrer@example.com', '+65 9000 0020');
    const record = await prisma.user.findUniqueOrThrow({ where: { id: referrer.id } });
    const first = await postJson('/auth/register', {
      email: 'pending-one@example.com', password: 'Password123!', fullName: 'Pending One',
      phone: '+65 9000 0021', referralCode: record.referralCode
    });
    const second = await postJson('/auth/register', {
      email: 'pending-two@example.com', password: 'Password123!', fullName: 'Pending Two',
      phone: '+65 9000-0021', referralCode: record.referralCode
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstBody = await jsonBody<{ devVerificationCode: string }>(first);
    const secondBody = await jsonBody<{ devVerificationCode: string }>(second);
    expect((await postJson('/auth/verify-email', {
      email: 'pending-one@example.com', code: firstBody.devVerificationCode
    })).status).toBe(200);
    expect((await postJson('/auth/verify-email', {
      email: 'pending-two@example.com', code: secondBody.devVerificationCode
    })).status).toBe(409);
  });

  it('qualifies only after two distinct paid periods and ignores duplicate events', async () => {
    const { referrerId, referredId } = await seedDirectReferral('two-period');
    await paidPeriod(referredId, 'INITIAL_PURCHASE', 'event-one', 'txn-one');
    await paidPeriod(referredId, 'RENEWAL', 'event-two', 'txn-two');
    await paidPeriod(referredId, 'RENEWAL', 'event-two', 'txn-two');

    const referral = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: referredId } });
    expect(referral).toMatchObject({ status: 'QUALIFIED', paidPeriodCount: 2 });
    expect(await prisma.subscriptionEvent.count({ where: { userId: referredId } })).toBe(2);
    expect(await prisma.referralReward.count({ where: { userId: referrerId } })).toBe(0);
  });

  it('does not count the same store transaction twice under different webhook event ids', async () => {
    const { referredId } = await seedDirectReferral('same-transaction');
    await paidPeriod(referredId, 'INITIAL_PURCHASE', 'event-a', 'txn-one');
    await paidPeriod(referredId, 'RENEWAL', 'event-b', 'txn-one');

    const referral = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: referredId } });
    expect(referral).toMatchObject({ status: 'PENDING', paidPeriodCount: 1 });
    expect(await prisma.subscriptionEvent.count({ where: { userId: referredId } })).toBe(1);
  });

  it('does not count a webhook without a reported paid price', async () => {
    const { referredId } = await seedDirectReferral('missing-price');
    await recordPaidReferralPeriod({
      userId: referredId,
      event: { id: 'event-no-price', type: 'INITIAL_PURCHASE', period_type: 'NORMAL' },
      eventType: 'INITIAL_PURCHASE',
      transactionId: 'txn-no-price',
      store: 'PLAY_STORE',
      purchasedAt: new Date(),
      priceCents: null,
      currency: 'SGD'
    });

    expect(await prisma.subscriptionEvent.count({ where: { userId: referredId } })).toBe(0);
    expect(await prisma.referral.findUniqueOrThrow({ where: { referredUserId: referredId } }))
      .toMatchObject({ status: 'PENDING', paidPeriodCount: 0 });
  });

  it('earns one pending reward month after five qualified referrals', async () => {
    const referrer = await createDirectUser('reward-referrer@example.com', 'DSP-REWARD0001');
    for (let index = 0; index < 5; index += 1) {
      const referred = await createDirectUser(`reward-${index}@example.com`, `DSP-REWARD00${index + 2}`);
      await prisma.referral.create({
        data: {
          referrerUserId: referrer.id,
          referredUserId: referred.id,
          codeUsed: referrer.referralCode!
        }
      });
      await paidPeriod(referred.id, 'INITIAL_PURCHASE', `initial-${index}`, `initial-txn-${index}`);
      await paidPeriod(referred.id, 'RENEWAL', `renewal-${index}`, `renewal-txn-${index}`);
    }

    expect(await prisma.referral.count({ where: { referrerUserId: referrer.id, status: 'REWARDED' } })).toBe(5);
    expect(await prisma.referralReward.findFirst({ where: { userId: referrer.id } })).toMatchObject({
      ordinal: 1,
      status: 'EARNED',
      fulfilledAt: null
    });
  });

  it('does not show voided reward months as earned', async () => {
    const user = await createDirectUser('void-reward@example.com', 'DSP-VOID00001');
    await prisma.referralReward.create({
      data: { userId: user.id, ordinal: 1, status: 'VOID' }
    });
    const summary = await getReferralSummary(user.id);
    expect(summary).toMatchObject({ earnedRewardMonths: 0, fulfilledRewardMonths: 0 });
  });

  async function registerAndVerify(email: string, phone: string): Promise<{ id: string; cookie: string }> {
    const registration = await postJson('/auth/register', {
      email,
      password: 'Password123!',
      fullName: 'Test Worker',
      phone
    });
    expect(registration.status).toBe(201);
    const body = await jsonBody<{ user: { id: string }; devVerificationCode: string }>(registration);
    const verification = await postJson('/auth/verify-email', { email, code: body.devVerificationCode });
    expect(verification.status).toBe(200);
    return { id: body.user.id, cookie: sessionCookie(verification) };
  }

  async function seedDirectReferral(seed: string) {
    const referrer = await createDirectUser(`${seed}-referrer@example.com`, 'DSP-DIRECT001');
    const referred = await createDirectUser(`${seed}-referred@example.com`, 'DSP-DIRECT002');
    await prisma.referral.create({
      data: { referrerUserId: referrer.id, referredUserId: referred.id, codeUsed: referrer.referralCode! }
    });
    return { referrerId: referrer.id, referredId: referred.id };
  }

  function createDirectUser(email: string, referralCode: string) {
    return prisma.user.create({
      data: {
        email,
        referralCode,
        passwordHash: 'not-used-in-service-test',
        status: 'ACTIVE',
        emailVerifiedAt: new Date()
      }
    });
  }

  function paidPeriod(userId: string, eventType: string, id: string, transactionId: string) {
    const purchasedAt = new Date();
    return recordPaidReferralPeriod({
      userId,
      event: { id, type: eventType, period_type: 'NORMAL' },
      eventType,
      transactionId,
      store: 'PLAY_STORE',
      purchasedAt,
      priceCents: 720,
      currency: 'SGD'
    });
  }

  function postJson(path: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
});

function sessionCookie(response: Response): string {
  return response.headers.get('set-cookie')?.split(';')[0] ?? '';
}

async function jsonBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
