import { SubscriptionStatus } from '@prisma/client';
import { DISPUTE_BASIC_ANDROID_BASE_PLAN_ID } from '@claimproof/shared';

const supportedRevenueCatStores = new Set(['PLAY_STORE', 'APP_STORE']);

export interface VerifiedStoreSubscription {
  status: SubscriptionStatus;
  purchasedAt: Date | null;
  expirationAt: Date | null;
  providerSubscriptionId: string | null;
}

export function verifyRevenueCatSubscriberPayload(
  payload: unknown,
  config: {
    allowAppleSandboxEvents: boolean;
    allowSandboxEvents: boolean;
    entitlementId: string;
    nodeEnv: string;
    now: Date;
    productId: string;
  }
):
  | { ok: true; subscription: VerifiedStoreSubscription }
  | { ok: false; statusCode: 409 | 502; error: string } {
  const subscriber = getRevenueCatSubscriber(payload);
  if (!subscriber) {
    return {
      ok: false,
      statusCode: 502,
      error: 'RevenueCat returned an invalid response. The existing subscription status was not changed.'
    };
  }
  const entitlements = getRecord(subscriber, 'entitlements');
  const entitlement = entitlements ? getRecord(entitlements, config.entitlementId) : null;
  if (!entitlement) {
    return {
      ok: false,
      statusCode: 409,
      error: 'RevenueCat did not confirm an active DISPUTE entitlement for this account.'
    };
  }
  const entitlementProductId = getString(entitlement, 'product_identifier');
  if (!entitlementProductId) {
    return {
      ok: false,
      statusCode: 409,
      error: 'RevenueCat returned an entitlement for an unapproved subscription product.'
    };
  }
  const subscriptions = getRecord(subscriber, 'subscriptions');
  const storeSubscription = subscriptions
    ? getRecord(subscriptions, entitlementProductId)
    : null;
  if (!storeSubscription) {
    return {
      ok: false,
      statusCode: 409,
      error: 'RevenueCat did not return the verified store subscription details.'
    };
  }
  const store = getString(storeSubscription, 'store');
  if (!matchesApprovedProductForStore(entitlementProductId, config.productId, store)) {
    return {
      ok: false,
      statusCode: 409,
      error: 'RevenueCat returned an entitlement for an unapproved subscription product.'
    };
  }
  const isSandbox = getOptionalBoolean(storeSubscription, 'is_sandbox');
  const periodType = getString(storeSubscription, 'period_type');
  const refundedAt = getNullableString(storeSubscription, 'refunded_at');
  const billingIssueAt = getNullableString(storeSubscription, 'billing_issues_detected_at');
  const unsubscribeAt = getNullableString(storeSubscription, 'unsubscribe_detected_at');
  if (
    isSandbox === null ||
    !periodType ||
    !['normal', 'trial', 'intro'].includes(periodType) ||
    !refundedAt.valid ||
    !billingIssueAt.valid ||
    !unsubscribeAt.valid ||
    refundedAt.value
  ) {
    return {
      ok: false,
      statusCode: 409,
      error: 'RevenueCat returned incomplete or refunded store subscription details.'
    };
  }
  const storeContextError = validateRevenueCatStoreContext(
    {
      store: normalizeRevenueCatStore(store),
      environment: isSandbox ? 'SANDBOX' : 'PRODUCTION'
    },
    config.nodeEnv,
    config.allowSandboxEvents,
    config.allowAppleSandboxEvents
  );
  if (storeContextError) {
    return { ok: false, statusCode: 409, error: storeContextError };
  }
  const expirationAt = getDate(entitlement, 'expires_date');
  if (!expirationAt || expirationAt <= config.now) {
    return {
      ok: false,
      statusCode: 409,
      error: 'RevenueCat did not confirm a current DISPUTE access period.'
    };
  }
  const subscriptionExpirationAt = getDate(storeSubscription, 'expires_date');
  if (!subscriptionExpirationAt || subscriptionExpirationAt.getTime() !== expirationAt.getTime()) {
    return {
      ok: false,
      statusCode: 409,
      error: 'RevenueCat returned inconsistent subscription expiration details.'
    };
  }
  const status = billingIssueAt.value
    ? SubscriptionStatus.PAST_DUE
    : unsubscribeAt.value
      ? SubscriptionStatus.CANCELED
      : periodType === 'trial'
        ? SubscriptionStatus.TRIALING
        : SubscriptionStatus.ACTIVE;
  if (status === SubscriptionStatus.PAST_DUE) {
    return {
      ok: false,
      statusCode: 409,
      error: 'RevenueCat reports a billing issue. The existing subscription status was not changed.'
    };
  }
  return {
    ok: true,
    subscription: {
      status,
      purchasedAt:
        getDate(storeSubscription, 'purchase_date') ?? getDate(entitlement, 'purchase_date'),
      expirationAt,
      providerSubscriptionId: getString(storeSubscription, 'store_transaction_id')
    }
  };
}

export function validateRevenueCatStoreContext(
  event: Record<string, unknown>,
  _nodeEnv: string,
  allowSandboxEvents = false,
  allowAppleSandboxEvents = false
): string | null {
  const store = getString(event, 'store');
  if (!store || !supportedRevenueCatStores.has(store)) {
    return 'RevenueCat webhook store must be Google Play or Apple App Store.';
  }
  const environment = getString(event, 'environment');
  if (environment !== 'PRODUCTION' && environment !== 'SANDBOX') {
    return 'RevenueCat webhook environment is not supported.';
  }
  if (environment === 'SANDBOX') {
    const sandboxAllowed = store === 'PLAY_STORE'
      ? allowSandboxEvents
      : allowAppleSandboxEvents;
    if (!sandboxAllowed) {
      return 'RevenueCat sandbox events require the matching store testing pilot flag.';
    }
  }
  return null;
}

function matchesApprovedProductForStore(
  entitlementProductId: string,
  configuredProductId: string,
  store: string | null
): boolean {
  const normalizedConfiguredProductId = configuredProductId.trim();
  if (!normalizedConfiguredProductId) return false;
  if (store?.toLowerCase() === 'play_store') {
    const expectedProductId = normalizedConfiguredProductId.includes(':')
      ? normalizedConfiguredProductId
      : `${normalizedConfiguredProductId}:${DISPUTE_BASIC_ANDROID_BASE_PLAN_ID}`;
    return entitlementProductId === expectedProductId;
  }
  if (store?.toLowerCase() === 'app_store') {
    return entitlementProductId === normalizedConfiguredProductId;
  }
  return false;
}

function getRevenueCatSubscriber(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const value = getRecord(root, 'value');
  return getRecord(value ?? root, 'subscriber');
}

function getRecord(
  body: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const value = body[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getOptionalBoolean(body: Record<string, unknown>, key: string): boolean | null {
  const value = body[key];
  return typeof value === 'boolean' ? value : null;
}

function getNullableString(
  body: Record<string, unknown>,
  key: string
): { valid: boolean; value: string | null } {
  const value = body[key];
  if (value === null) return { valid: true, value: null };
  if (typeof value === 'string' && value.trim()) {
    return { valid: true, value: value.trim() };
  }
  return { valid: false, value: null };
}

function getDate(body: Record<string, unknown>, key: string): Date | null {
  const value = getString(body, key);
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function normalizeRevenueCatStore(store: string | null): string | null {
  switch (store?.toLowerCase()) {
    case 'play_store':
      return 'PLAY_STORE';
    case 'app_store':
      return 'APP_STORE';
    default:
      return null;
  }
}
