import { createHash, randomBytes } from 'node:crypto';
import { Prisma, ReferralRewardStatus, ReferralStatus, UserStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';

const referralPrefix = 'DSP';
const referralsPerRewardMonth = 5;
const paidPeriodsToQualify = 2;
const playPackageName = 'sg.claimproof.mobile';

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

export interface ReferralSummary {
  code: string;
  shareUrl: string;
  referredCount: number;
  qualifiedCount: number;
  progressToNextReward: number;
  referralsNeededForNextReward: number;
  earnedRewardMonths: number;
  fulfilledRewardMonths: number;
  rewardMessage: string;
}

export function normalizeReferralCode(value: string | undefined): string {
  return (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

export function normalizePhoneForAbuseControl(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

export async function findEligibleReferrer(
  code: string,
  client: PrismaClientOrTx = prisma
): Promise<{ id: string; referralCode: string } | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  return client.user.findFirst({
    where: {
      referralCode: normalized,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: { not: null }
    },
    select: { id: true, referralCode: true }
  }) as Promise<{ id: string; referralCode: string } | null>;
}

export async function generateUniqueReferralCode(
  client: PrismaClientOrTx = prisma
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = randomBytes(5).toString('hex').toUpperCase();
    const code = `${referralPrefix}-${suffix}`;
    const existing = await client.user.findUnique({
      where: { referralCode: code },
      select: { id: true }
    });
    if (!existing) return code;
  }
  throw new Error('Unable to allocate a unique referral code.');
}

export async function getReferralSummary(userId: string): Promise<ReferralSummary> {
  const code = await ensureUserReferralCode(userId);
  const [referredCount, qualifiedCount, rewards] = await Promise.all([
    prisma.referral.count({
      where: {
        referrerUserId: userId,
        referredUser: { status: UserStatus.ACTIVE, emailVerifiedAt: { not: null } }
      }
    }),
    prisma.referral.count({
      where: {
        referrerUserId: userId,
        status: { in: [ReferralStatus.QUALIFIED, ReferralStatus.REWARDED] },
        referredUser: { status: UserStatus.ACTIVE, emailVerifiedAt: { not: null } }
      }
    }),
    prisma.referralReward.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true }
    })
  ]);
  const earnedRewardMonths = rewards
    .filter((row) => row.status !== ReferralRewardStatus.VOID)
    .reduce((sum, row) => sum + row._count._all, 0);
  const fulfilledRewardMonths =
    rewards.find((row) => row.status === ReferralRewardStatus.FULFILLED)?._count._all ?? 0;
  const progressToNextReward = qualifiedCount % referralsPerRewardMonth;
  const referralsNeededForNextReward = referralsPerRewardMonth - progressToNextReward;

  return {
    code,
    shareUrl: `${env.serverPublicUrl}/referrals/r/${encodeURIComponent(code)}`,
    referredCount,
    qualifiedCount,
    progressToNextReward,
    referralsNeededForNextReward,
    earnedRewardMonths,
    fulfilledRewardMonths,
    rewardMessage:
      earnedRewardMonths > fulfilledRewardMonths
        ? `${earnedRewardMonths - fulfilledRewardMonths} reward month earned and awaiting store-compliant fulfillment.`
        : `${referralsNeededForNextReward} more qualified referral${referralsNeededForNextReward === 1 ? '' : 's'} to the next reward month.`
  };
}

export async function getPublicReferral(code: string) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const referrer = await prisma.user.findFirst({
    where: {
      referralCode: normalized,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: { not: null }
    },
    select: { referralCode: true }
  });
  if (!referrer?.referralCode) return null;
  const playReferrer = encodeURIComponent(`utm_source=referral&utm_content=${referrer.referralCode}`);
  return {
    code: referrer.referralCode,
    playUrl: `https://play.google.com/store/apps/details?id=${playPackageName}&referrer=${playReferrer}`
  };
}

export async function recordPaidReferralPeriod(input: {
  userId: string;
  event: Record<string, unknown>;
  eventType: string;
  transactionId: string | null;
  store: string | null;
  purchasedAt: Date | null;
  priceCents: number | null;
  currency: string | null;
}): Promise<void> {
  if (!['INITIAL_PURCHASE', 'RENEWAL'].includes(input.eventType)) return;
  if (!input.priceCents || input.priceCents <= 0) return;
  if (!input.transactionId || !input.store) return;
  if (getString(input.event, 'period_type') === 'TRIAL') return;

  const providerEventId = getProviderEventId(input);
  const paidPeriodKey = `${input.store}:${input.transactionId}`;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.subscriptionEvent.create({
        data: {
          providerEventId,
          paidPeriodKey,
          userId: input.userId,
          eventType: input.eventType,
          transactionId: input.transactionId,
          purchasedAt: input.purchasedAt,
          priceCents: input.priceCents,
          currency: input.currency
        }
      });
      await reconcileReferralQualification(input.userId, tx);
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      await prisma.$transaction((tx) => reconcileReferralQualification(input.userId, tx));
      return;
    }
    throw error;
  }
}

async function reconcileReferralQualification(
  userId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  const referral = await tx.referral.findUnique({
    where: { referredUserId: userId },
    include: { referredUser: { select: { status: true, emailVerifiedAt: true } } }
  });
  if (
    !referral ||
    referral.status === ReferralStatus.REJECTED ||
    referral.referredUser.status !== UserStatus.ACTIVE ||
    !referral.referredUser.emailVerifiedAt
  ) return;

  const paidPeriodCount = await tx.subscriptionEvent.count({
    where: {
      userId,
      eventType: { in: ['INITIAL_PURCHASE', 'RENEWAL'] },
      priceCents: { gt: 0 },
      paidPeriodKey: { not: null }
    }
  });
  const newlyQualified =
    paidPeriodCount >= paidPeriodsToQualify && referral.status === ReferralStatus.PENDING;
  await tx.referral.update({
    where: { id: referral.id },
    data: {
      paidPeriodCount,
      ...(newlyQualified
        ? { status: ReferralStatus.QUALIFIED, qualifiedAt: new Date() }
        : {})
    }
  });
  if (!newlyQualified) return;

  await allocateEarnedRewards(referral.referrerUserId, tx);
}

async function ensureUserReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true }
  });
  if (!user) throw new Error('Referral account was not found.');
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = await generateUniqueReferralCode(prisma);
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }
  throw new Error('Unable to allocate a unique referral code.');
}

async function allocateEarnedRewards(
  referrerUserId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  const qualifiedCount = await tx.referral.count({
    where: {
      referrerUserId,
      status: { in: [ReferralStatus.QUALIFIED, ReferralStatus.REWARDED] }
    }
  });
  const rewardTarget = Math.floor(qualifiedCount / referralsPerRewardMonth);
  const existingRewards = await tx.referralReward.count({ where: { userId: referrerUserId } });

  for (let ordinal = existingRewards + 1; ordinal <= rewardTarget; ordinal += 1) {
    await tx.referralReward.create({
      data: { userId: referrerUserId, ordinal, status: ReferralRewardStatus.EARNED }
    });
    const referrals = await tx.referral.findMany({
      where: { referrerUserId, status: ReferralStatus.QUALIFIED },
      orderBy: [{ qualifiedAt: 'asc' }, { createdAt: 'asc' }],
      take: referralsPerRewardMonth,
      select: { id: true }
    });
    await tx.referral.updateMany({
      where: { id: { in: referrals.map((row) => row.id) } },
      data: { status: ReferralStatus.REWARDED, rewardedAt: new Date() }
    });
  }
}

function getProviderEventId(input: {
  event: Record<string, unknown>;
  userId: string;
  eventType: string;
  transactionId: string | null;
  purchasedAt: Date | null;
}): string {
  const explicit = getString(input.event, 'id');
  if (explicit) return explicit;
  const stable = [
    input.userId,
    input.eventType,
    input.transactionId ?? '',
    input.purchasedAt?.toISOString() ?? ''
  ].join('|');
  return `derived-${createHash('sha256').update(stable).digest('hex')}`;
}

function getString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
