import { Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export interface SubscriptionEntitlement {
  userId: string;
  status: SubscriptionStatus | 'NONE';
  isActive: boolean;
  canExportReports: boolean;
  billingProvider: 'store';
  billingEnforcementActive: boolean;
  planName: string;
  priceCents: number;
  currency: string;
  billingInterval: 'month';
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  message: string;
}

const trialDays = 3;
const basicPlanCode = 'dispute-basic-monthly';
const storeProductId = 'dispute_basic_monthly';
const basicPlanName = 'DISPUTE Basic';
const basicPlanPriceCents = 499;
const basicPlanCurrency = 'SGD';

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

export async function createTrialSubscriptionForUser(
  userId: string,
  verifiedAt: Date,
  client: PrismaClientOrTx = prisma
): Promise<void> {
  const existing = await client.userSubscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
  if (existing) {
    return;
  }

  const plan = await ensureBasicPlan(client);
  await client.userSubscription.create({
    data: {
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
      await createTrialSubscriptionForUser(userId, new Date());
      subscription = await prisma.userSubscription.findFirst({
        where: { userId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      });
    }
  }

  if (!subscription) {
    return {
      userId,
      status: 'NONE',
      isActive: false,
      canExportReports: false,
      billingProvider: 'store',
      billingEnforcementActive: true,
      planName: basicPlanName,
      priceCents: basicPlanPriceCents,
      currency: basicPlanCurrency,
      billingInterval: 'month',
      trialEndsAt: null,
      currentPeriodEnd: null,
      message: 'No trial or subscription is active. Subscribe to export reports.'
    };
  }

  const effectiveStatus = getEffectiveStatus(subscription.status, subscription.trialEndsAt);
  const isActive = effectiveStatus === SubscriptionStatus.ACTIVE || effectiveStatus === SubscriptionStatus.TRIALING;
  return {
    userId,
    status: effectiveStatus,
    isActive,
    canExportReports: isActive,
    billingProvider: 'store',
    billingEnforcementActive: true,
    planName: subscription.plan.name,
    priceCents: subscription.monthlyRecurringCents,
    currency: subscription.currency,
    billingInterval: 'month',
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    message: buildEntitlementMessage(effectiveStatus, subscription.trialEndsAt)
  };
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

  const plan = await ensureBasicPlan(prisma);
  const productId = getString(event, 'product_id');
  if (productId !== storeProductId) {
    return {
      statusCode: 400,
      body: { error: `RevenueCat webhook product_id must be ${storeProductId}.` }
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
  const expirationAt = getDateFromMs(event, 'expiration_at_ms');
  const priceCents = getRevenueCents(event) ?? basicPlanPriceCents;
  const currency = getString(event, 'currency') ?? basicPlanCurrency;
  const providerSubscriptionId =
    getString(event, 'transaction_id') ?? getString(event, 'original_transaction_id');

  await prisma.userSubscription.upsert({
    where: {
      id:
        (
          await prisma.userSubscription.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { id: true }
          })
        )?.id ?? ''
    },
    create: {
      userId,
      planId: plan.id,
      status,
      monthlyRecurringCents: priceCents,
      currency,
      provider: 'revenuecat',
      providerSubscriptionId,
      currentPeriodStart: purchasedAt,
      currentPeriodEnd: expirationAt,
      trialEndsAt: status === SubscriptionStatus.TRIALING ? expirationAt : null,
      canceledAt: status === SubscriptionStatus.CANCELED ? new Date() : null
    },
    update: {
      planId: plan.id,
      status,
      monthlyRecurringCents: priceCents,
      currency,
      provider: 'revenuecat',
      providerSubscriptionId,
      currentPeriodStart: purchasedAt,
      currentPeriodEnd: expirationAt,
      trialEndsAt: status === SubscriptionStatus.TRIALING ? expirationAt : undefined,
      canceledAt: status === SubscriptionStatus.CANCELED ? new Date() : null
    }
  });

  return {
    statusCode: 200,
    body: { received: true, userId, status }
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
      price: new Prisma.Decimal('4.99'),
      currency: basicPlanCurrency,
      billingInterval: 'month',
      limitsJson: JSON.stringify({ exportReports: true }),
      status: 'active'
    },
    create: {
      id: basicPlanCode,
      name: basicPlanName,
      price: new Prisma.Decimal('4.99'),
      currency: basicPlanCurrency,
      billingInterval: 'month',
      limitsJson: JSON.stringify({ exportReports: true }),
      status: 'active'
    }
  });
}

function getEffectiveStatus(status: SubscriptionStatus, trialEndsAt: Date | null): SubscriptionStatus {
  if (status === SubscriptionStatus.TRIALING && trialEndsAt && trialEndsAt <= new Date()) {
    return SubscriptionStatus.EXPIRED;
  }
  return status;
}

function buildEntitlementMessage(status: SubscriptionStatus, trialEndsAt: Date | null): string {
  if (status === SubscriptionStatus.TRIALING) {
    return trialEndsAt
      ? `Trial active until ${trialEndsAt.toISOString()}. Export is available during the trial.`
      : 'Trial active. Export is available during the trial.';
  }
  if (status === SubscriptionStatus.ACTIVE) {
    return 'Subscription active. Export is available.';
  }
  if (status === SubscriptionStatus.PAST_DUE) {
    return 'Subscription payment is past due. Subscribe again to export reports.';
  }
  if (status === SubscriptionStatus.CANCELED) {
    return 'Subscription was canceled. Subscribe again to export reports.';
  }
  return 'Trial ended. Subscribe to export reports. Your time and evidence records remain available.';
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

function getDateFromMs(body: Record<string, unknown>, key: string): Date | null {
  const value = body[key];
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? new Date(numberValue) : null;
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
