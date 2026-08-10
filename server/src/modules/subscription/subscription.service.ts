import { Prisma, SubscriptionStatus } from '@prisma/client';
import { matchesConfiguredStoreProductIdentifier } from '@claimproof/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { recordPaidReferralPeriod } from '../referrals/referral.service.js';
import {
  validateRevenueCatStoreContext,
  verifyRevenueCatSubscriberPayload,
  type VerifiedStoreSubscription
} from './revenueCatVerification.js';

export { validateRevenueCatStoreContext } from './revenueCatVerification.js';

export interface SubscriptionEntitlement {
  userId: string;
  status: SubscriptionStatus | 'NONE';
  isActive: boolean;
  canCreateRecords: boolean;
  canExportReports: boolean;
  canExportPremiumReports: boolean;
  canExportBasicData: true;
  billingProvider: 'store';
  billingEnforcementActive: boolean;
  planName: string;
  priceCents: number;
  currency: string;
  billingInterval: 'month';
  hasReferralRewardAccess: boolean;
  referralRewardEndsAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  message: string;
}

const trialDays = 3;
const basicPlanCode = 'dispute-basic-monthly';
const storeProductId = env.revenueCat.productId || 'dispute_basic_monthly';
const storeEntitlementId = env.revenueCat.entitlementId || 'dispute_basic';
const basicPlanName = 'DISPUTE Basic';
const basicPlanPriceCents = 699;
const basicPlanCurrency = 'SGD';

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;
type FetchLike = typeof fetch;

interface RevenueCatSyncOptions {
  allowAppleSandboxEvents?: boolean;
  allowSandboxEvents?: boolean;
  entitlementId?: string;
  fetcher?: FetchLike;
  nodeEnv?: string;
  now?: Date;
  productId?: string;
  secretApiKey?: string;
}

export async function createTrialSubscriptionForUser(
  userId: string,
  verifiedAt: Date,
  client: PrismaClientOrTx = prisma
): Promise<void> {
  const plan = await ensureBasicPlan(client);
  await client.userSubscription.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      planId: plan.id,
      status: SubscriptionStatus.TRIALING,
      monthlyRecurringCents: basicPlanPriceCents,
      currency: basicPlanCurrency,
      provider: 'store',
      trialEndsAt: addDays(verifiedAt, trialDays),
      currentPeriodStart: verifiedAt,
      currentPeriodEnd: addDays(verifiedAt, trialDays)
    }
  });
}

export async function getSubscriptionEntitlement(userId: string): Promise<SubscriptionEntitlement> {
  let subscription = await prisma.userSubscription.findFirst({
    where: { userId },
    include: { plan: true },
    orderBy: { createdAt: 'desc' }
  });

  if (!subscription) {
    const verifiedUser = await prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE', emailVerifiedAt: { not: null } },
      select: { emailVerifiedAt: true }
    });
    if (verifiedUser?.emailVerifiedAt) {
      await createTrialSubscriptionForUser(userId, verifiedUser.emailVerifiedAt);
      subscription = await prisma.userSubscription.findFirst({
        where: { userId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      });
    }
  }

  const activeReward = await prisma.referralReward.findFirst({
    where: {
      userId,
      status: 'FULFILLED',
      fulfillmentStartsAt: { lte: new Date() },
      fulfillmentEndsAt: { gt: new Date() }
    },
    orderBy: { fulfillmentEndsAt: 'desc' }
  });

  if (!subscription) {
    const hasReferralRewardAccess = Boolean(activeReward);
    return {
      userId,
      status: 'NONE',
      isActive: hasReferralRewardAccess,
      canCreateRecords: hasReferralRewardAccess,
      canExportReports: hasReferralRewardAccess,
      canExportPremiumReports: hasReferralRewardAccess,
      canExportBasicData: true,
      billingProvider: 'store',
      billingEnforcementActive: true,
      planName: basicPlanName,
      priceCents: basicPlanPriceCents,
      currency: basicPlanCurrency,
      billingInterval: 'month',
      hasReferralRewardAccess: Boolean(activeReward),
      referralRewardEndsAt: activeReward?.fulfillmentEndsAt?.toISOString() ?? null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      message: activeReward
        ? `Referral reward access is active until ${activeReward.fulfillmentEndsAt!.toISOString()}.`
        : 'No trial or subscription is active. Existing records remain readable; subscribe to create new records or export premium PDF/CSV reports.'
    };
  }

  const effectiveStatus = getEffectiveStatus(
    subscription.status,
    subscription.trialEndsAt,
    subscription.currentPeriodEnd
  );
  const hasSubscriptionAccess =
    effectiveStatus === SubscriptionStatus.ACTIVE ||
    effectiveStatus === SubscriptionStatus.TRIALING ||
    effectiveStatus === SubscriptionStatus.CANCELED ||
    effectiveStatus === SubscriptionStatus.PAST_DUE;
  const hasReferralRewardAccess = Boolean(activeReward);
  const hasFullAccess = hasSubscriptionAccess || hasReferralRewardAccess;
  return {
    userId,
    status: effectiveStatus,
    isActive: hasFullAccess,
    canCreateRecords: hasFullAccess,
    canExportReports: hasFullAccess,
    canExportPremiumReports: hasFullAccess,
    canExportBasicData: true,
    billingProvider: 'store',
    billingEnforcementActive: true,
    planName: subscription.plan.name,
    priceCents: subscription.monthlyRecurringCents,
    currency: subscription.currency,
    billingInterval: 'month',
    hasReferralRewardAccess,
    referralRewardEndsAt: activeReward?.fulfillmentEndsAt?.toISOString() ?? null,
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    message: hasReferralRewardAccess && !hasSubscriptionAccess
      ? `Referral reward access is active until ${activeReward!.fulfillmentEndsAt!.toISOString()}.`
      : buildEntitlementMessage(
          effectiveStatus,
          subscription.trialEndsAt,
          subscription.currentPeriodEnd
        )
  };
}

export async function syncSubscriptionFromRevenueCat(
  userId: string,
  options: RevenueCatSyncOptions = {}
) {
  const secretApiKey = options.secretApiKey ?? env.revenueCat.secretApiKey;
  const productId = options.productId ?? storeProductId;
  const entitlementId = options.entitlementId ?? storeEntitlementId;
  if (!secretApiKey || !productId || !entitlementId) {
    return {
      statusCode: 503,
      body: {
        error: 'Subscription verification is not configured on the Dispute server.'
      }
    } as const;
  }

  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretApiKey}`,
          Accept: 'application/json'
        }
      }
    );
  } catch {
    return {
      statusCode: 502,
      body: {
        error: 'RevenueCat could not be reached. The existing subscription status was not changed.'
      }
    } as const;
  }

  if (!response.ok) {
    return {
      statusCode: 502,
      body: {
        error: 'RevenueCat could not verify this subscription. The existing subscription status was not changed.'
      }
    } as const;
  }

  const payload = await readRevenueCatJson(response);
  const verified = verifyRevenueCatSubscriberPayload(payload, {
    allowAppleSandboxEvents:
      options.allowAppleSandboxEvents ?? env.revenueCat.allowAppleSandboxEvents,
    allowSandboxEvents: options.allowSandboxEvents ?? env.revenueCat.allowSandboxEvents,
    entitlementId,
    nodeEnv: options.nodeEnv ?? env.nodeEnv,
    now: options.now ?? new Date(),
    productId
  });
  if (!verified.ok) {
    return {
      statusCode: verified.statusCode,
      body: {
        error: verified.error
      }
    } as const;
  }

  const applied = await persistVerifiedSubscription(userId, verified.subscription);
  const stored = await prisma.userSubscription.findUnique({
    where: { userId },
    select: { status: true }
  });
  return {
    statusCode: 200,
    body: {
      synced: true,
      applied,
      userId,
      status: stored?.status ?? verified.subscription.status
    }
  } as const;
}

export async function updateSubscriptionFromRevenueCatWebhook(body: unknown) {
  const event = getRevenueCatEvent(body);
  const userId = getString(event, 'app_user_id') ?? getString(event, 'original_app_user_id');
  if (!userId) {
    return {
      statusCode: 400,
      body: { error: 'RevenueCat webhook is missing app_user_id.' }
    } as const;
  }

  const productId = getString(event, 'product_id');
  if (!matchesConfiguredStoreProductIdentifier(productId, storeProductId)) {
    return {
      statusCode: 400,
      body: { error: `RevenueCat webhook product_id must be ${storeProductId}.` }
    } as const;
  }
  const entitlementIds = getStringArray(event, 'entitlement_ids');
  if (!entitlementIds.includes(storeEntitlementId)) {
    return {
      statusCode: 400,
      body: { error: `RevenueCat webhook must grant ${storeEntitlementId}.` }
    } as const;
  }
  const storeContextError = validateRevenueCatStoreContext(
    event,
    env.nodeEnv,
    env.revenueCat.allowSandboxEvents,
    env.revenueCat.allowAppleSandboxEvents
  );
  if (storeContextError) {
    return {
      statusCode: 400,
      body: { error: storeContextError }
    } as const;
  }
  const status = mapRevenueCatStatus(getString(event, 'type'));
  if (!status) {
    return {
      statusCode: 400,
      body: { error: 'RevenueCat webhook event type is not supported.' }
    } as const;
  }
  const purchasedAt = getDateFromMs(event, 'purchased_at_ms');
  const expirationAt = status === SubscriptionStatus.PAST_DUE
    ? getDateFromMs(event, 'grace_period_expiration_at_ms')
    : getDateFromMs(event, 'expiration_at_ms');
  if (status === SubscriptionStatus.PAST_DUE && (!expirationAt || expirationAt <= new Date())) {
    return {
      statusCode: 400,
      body: {
        error: 'RevenueCat billing issue must include a future grace_period_expiration_at_ms.'
      }
    } as const;
  }
  if (requiresFutureExpiration(status) && (!expirationAt || expirationAt <= new Date())) {
    return {
      statusCode: 400,
      body: { error: 'RevenueCat access-granting event must include a future expiration_at_ms.' }
    } as const;
  }
  const reportedPriceCents = getRevenueCents(event);
  const priceCents = reportedPriceCents ?? basicPlanPriceCents;
  const currency = getString(event, 'currency') ?? basicPlanCurrency;
  const providerSubscriptionId =
    getString(event, 'transaction_id') ?? getString(event, 'original_transaction_id');
  const paidPeriodTransactionId = getString(event, 'transaction_id');
  const providerUpdatedAt = getDateFromMs(event, 'event_timestamp_ms');
  if (!providerUpdatedAt) {
    return {
      statusCode: 400,
      body: { error: 'RevenueCat webhook is missing a valid event_timestamp_ms.' }
    } as const;
  }

  const applied = await persistVerifiedSubscription(userId, {
    status,
    purchasedAt,
    expirationAt,
    providerSubscriptionId,
    providerUpdatedAt
  }, priceCents, currency);

  await recordPaidReferralPeriod({
    userId,
    event,
    eventType: getString(event, 'type') ?? '',
    transactionId: paidPeriodTransactionId,
    store: getString(event, 'store'),
    purchasedAt,
    priceCents: reportedPriceCents,
    currency
  });

  return {
    statusCode: 200,
    body: { received: true, applied, userId, status }
  } as const;
}

export function getMobileStoreCheckoutResponse() {
  return {
    statusCode: 409,
    body: {
      error: 'Use the mobile Subscribe button. DISPUTE mobile subscriptions are handled by Apple App Store or Google Play.',
      billingProvider: 'store'
    }
  } as const;
}

async function ensureBasicPlan(client: PrismaClientOrTx) {
  return client.subscriptionPlan.upsert({
    where: { id: basicPlanCode },
    update: {
      name: basicPlanName,
      price: new Prisma.Decimal('6.99'),
      currency: basicPlanCurrency,
      billingInterval: 'month',
      limitsJson: JSON.stringify({ exportReports: true }),
      status: 'active'
    },
    create: {
      id: basicPlanCode,
      name: basicPlanName,
      price: new Prisma.Decimal('6.99'),
      currency: basicPlanCurrency,
      billingInterval: 'month',
      limitsJson: JSON.stringify({ exportReports: true }),
      status: 'active'
    }
  });
}

async function persistVerifiedSubscription(
  userId: string,
  subscription: VerifiedStoreSubscription,
  priceCents = basicPlanPriceCents,
  currency = basicPlanCurrency
): Promise<boolean> {
  const plan = await ensureBasicPlan(prisma);
  const data = {
    planId: plan.id,
    status: subscription.status,
    monthlyRecurringCents: priceCents,
    currency,
    provider: 'revenuecat',
    providerSubscriptionId: subscription.providerSubscriptionId,
    providerUpdatedAt: subscription.providerUpdatedAt,
    currentPeriodStart: subscription.purchasedAt,
    currentPeriodEnd: subscription.expirationAt,
    trialEndsAt:
      subscription.status === SubscriptionStatus.TRIALING
        ? subscription.expirationAt
        : null,
    canceledAt:
      subscription.status === SubscriptionStatus.CANCELED ? new Date() : null
  };
  const updateWhere: Prisma.UserSubscriptionWhereInput = {
    userId,
    OR: [
      { providerUpdatedAt: null },
      { providerUpdatedAt: { lte: subscription.providerUpdatedAt } }
    ]
  };
  const updated = await prisma.userSubscription.updateMany({
    where: updateWhere,
    data
  });
  if (updated.count > 0) return true;

  const existing = await prisma.userSubscription.findUnique({
    where: { userId },
    select: { id: true }
  });
  if (existing) return false;

  try {
    await prisma.userSubscription.create({ data: { userId, ...data } });
    return true;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }
    const racedUpdate = await prisma.userSubscription.updateMany({
      where: updateWhere,
      data
    });
    return racedUpdate.count > 0;
  }
}

async function readRevenueCatJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getEffectiveStatus(
  status: SubscriptionStatus,
  trialEndsAt: Date | null,
  currentPeriodEnd: Date | null
): SubscriptionStatus {
  if (status === SubscriptionStatus.TRIALING) {
    return trialEndsAt && trialEndsAt > new Date()
      ? SubscriptionStatus.TRIALING
      : SubscriptionStatus.EXPIRED;
  }
  if (status === SubscriptionStatus.CANCELED) {
    return currentPeriodEnd && currentPeriodEnd > new Date()
      ? SubscriptionStatus.CANCELED
      : SubscriptionStatus.EXPIRED;
  }
  if (status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.PAST_DUE) {
    return currentPeriodEnd && currentPeriodEnd > new Date()
      ? status
      : SubscriptionStatus.EXPIRED;
  }
  return status;
}

function requiresFutureExpiration(status: SubscriptionStatus): boolean {
  const accessStatuses: SubscriptionStatus[] = [
    SubscriptionStatus.TRIALING,
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELED
  ];
  return accessStatuses.includes(status);
}

function buildEntitlementMessage(
  status: SubscriptionStatus,
  trialEndsAt: Date | null,
  currentPeriodEnd: Date | null
): string {
  if (status === SubscriptionStatus.TRIALING) {
    return trialEndsAt
      ? `Trial active until ${trialEndsAt.toISOString()}. Export is available during the trial.`
      : 'Trial active. Export is available during the trial.';
  }
  if (status === SubscriptionStatus.ACTIVE) {
    return 'Subscription active. Export is available.';
  }
  if (status === SubscriptionStatus.PAST_DUE) {
    return currentPeriodEnd
      ? `Subscription payment needs attention. Access remains available during the billing grace period until ${currentPeriodEnd.toISOString()}.`
      : 'Subscription payment is past due. Subscribe again to export reports.';
  }
  if (status === SubscriptionStatus.CANCELED) {
    return currentPeriodEnd
      ? `Subscription canceled. Export remains available until ${currentPeriodEnd.toISOString()}.`
      : 'Subscription was canceled. Subscribe again to export reports.';
  }
  return 'Trial ended. Existing records remain readable and basic JSON backup stays available. Subscribe to create new records or export premium PDF/CSV reports.';
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getRevenueCatEvent(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const record = body as Record<string, unknown>;
  const event = record.event;
  return event && typeof event === 'object' ? (event as Record<string, unknown>) : record;
}

function getString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getStringArray(body: Record<string, unknown>, key: string): string[] {
  const value = body[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function getDateFromMs(body: Record<string, unknown>, key: string): Date | null {
  const value = body[key];
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(numberValue)) return null;
  const date = new Date(numberValue);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getRevenueCents(body: Record<string, unknown>): number | null {
  const price = body.price_in_purchased_currency ?? body.price;
  const numeric = typeof price === 'number' ? price : typeof price === 'string' ? Number(price) : NaN;
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 100) : null;
}

function mapRevenueCatStatus(type: string | null): SubscriptionStatus | null {
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
      return SubscriptionStatus.ACTIVE;
    case 'TRIAL_STARTED':
      return SubscriptionStatus.TRIALING;
    case 'BILLING_ISSUE':
      return SubscriptionStatus.PAST_DUE;
    case 'CANCELLATION':
      return SubscriptionStatus.CANCELED;
    case 'EXPIRATION':
      return SubscriptionStatus.EXPIRED;
    default:
      return null;
  }
}
