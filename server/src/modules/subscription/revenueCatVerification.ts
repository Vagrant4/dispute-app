import { SubscriptionStatus } from '@prisma/client';
import { matchesConfiguredStoreProductIdentifier } from '@claimproof/shared';

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
  if (
    !entitlementProductId ||
    !matchesConfiguredStoreProductIdentifier(entitlementProductId, config.productId)
  ) {
    return {
      ok: false,
      statusCode: 409,
      error: 'RevenueCat returned an entitlement for an unapproved subscription product.'
    };
  }
  const subscriptions = getRecord(subscriber, 'subscriptions');
  const storeSubscription = findRevenueCatSubscription(
    subscriptions,
    entitlementProductId,
    config.productId
  );
  if (!storeSubscription) {
    return {
      ok: false,
      statusCode: 409,
      error: 'RevenueCat did not return the verified store subscription details.'
    };
  }
  const store = getString(storeSubscription, 'store');
  const isSandbox = getOptionalBoolean(storeSubscription, 'is_sandbox');
  const periodType = getString(storeSubscription, 'period_type');
  if (isSandbox === null || !periodType || getString(storeSubscription, 'refunded_at')) {
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
    config.allowSandboxEvents
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
  const status = getString(storeSubscription, 'billing_issues_detected_at')
    ? SubscriptionStatus.PAST_DUE
    : getString(storeSubscription, 'unsubscribe_detected_at')
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
  nodeEnv: string,
  allowSandboxEvents = false
): string | null {
  const store = getString(event, 'store');
  if (!store || !supportedRevenueCatStores.has(store)) {
    return 'RevenueCat webhook store must be Google Play or Apple App Store.';
  }
  const environment = getString(event, 'environment');
  const isAllowedPlaySandbox =
    allowSandboxEvents && store === 'PLAY_STORE' && environment === 'SANDBOX';
  if (nodeEnv === 'production' && environment !== 'PRODUCTION' && !isAllowedPlaySandbox) {
    return 'RevenueCat production webhook must come from the production environment.';
  }
  if (environment !== 'PRODUCTION' && environment !== 'SANDBOX') {
    return 'RevenueCat webhook environment is not supported.';
  }
  return null;
}

function findRevenueCatSubscription(
  subscriptions: Record<string, unknown> | null,
  entitlementProductId: string,
  configuredProductId: string
): Record<string, unknown> | null {
  if (!subscriptions) return null;
  const exact = getRecord(subscriptions, entitlementProductId);
  if (exact) return exact;
  const matches = Object.entries(subscriptions).filter(([identifier, value]) =>
    Boolean(
      value &&
        typeof value === 'object' &&
        matchesConfiguredStoreProductIdentifier(identifier, configuredProductId)
    )
  );
  return matches.length === 1 ? (matches[0][1] as Record<string, unknown>) : null;
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
