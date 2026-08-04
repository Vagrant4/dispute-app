import { Platform } from "react-native";
import type RevenueCatPurchases from "react-native-purchases";

import type { LocalAccount } from "../auth/localAuth";
import { getAuthApiBaseUrl } from "../auth/remoteAuth";

export type SubscriptionStatus =
  | "NONE"
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "EXPIRED";

export type SubscriptionEntitlement = {
  userId: string;
  status: SubscriptionStatus;
  isActive: boolean;
  canCreateRecords: boolean;
  canExportReports: boolean;
  canExportPremiumReports: boolean;
  canExportBasicData: boolean;
  billingProvider: "store";
  billingEnforcementActive: boolean;
  planName: string;
  priceCents: number;
  currency: string;
  billingInterval: "month";
  hasReferralRewardAccess: boolean;
  referralRewardEndsAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  message: string;
};

type FetchLike = typeof fetch;

const revenueCatIosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
const revenueCatAndroidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";
const disputeBasicProductId =
  process.env.EXPO_PUBLIC_REVENUECAT_PRODUCT_ID?.trim() || "dispute_basic_monthly";
const disputeBasicEntitlementId =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || "";
const entitlementCacheKeyPrefix = "dispute.subscription-entitlement.v1";

export async function fetchSubscriptionStatus(
  expectedUserId?: string,
  fetcher: FetchLike = fetch,
): Promise<
  | { ok: true; subscription: SubscriptionEntitlement }
  | { ok: false; message: string }
> {
  try {
    const response = await fetcher(`${getAuthApiBaseUrl()}/subscription/status`, {
      method: "GET",
      credentials: "include",
    });
    const body = await readJsonBody(response);
    if (!response.ok) {
      return {
        ok: false,
        message: getErrorMessage(body, "Unable to check subscription status."),
      };
    }

    const subscription = parseSubscriptionEntitlement(body.subscription);
    if (!subscription) {
      return {
        ok: false,
        message: "Subscription status is unavailable until the Dispute server update completes.",
      };
    }

    if (expectedUserId && subscription.userId !== expectedUserId) {
      return { ok: false, message: "Subscription status does not match the signed-in account." };
    }
    await saveCachedSubscriptionEntitlement(subscription);
    return {
      ok: true,
      subscription,
    };
  } catch {
    const cached = expectedUserId
      ? await loadCachedSubscriptionEntitlement(expectedUserId)
      : null;
    if (cached && hasCurrentFullAccess(cached)) {
      return { ok: true, subscription: cached };
    }
    return {
      ok: false,
      message:
        "Unable to reach Dispute server. Connect to the internet to refresh subscription status.",
    };
  }
}

export function hasCurrentFullAccess(
  subscription: SubscriptionEntitlement | null,
  nowMs = Date.now(),
): boolean {
  if (!subscription) return false;
  if (
    subscription.hasReferralRewardAccess &&
    isFutureTimestamp(subscription.referralRewardEndsAt, nowMs)
  ) {
    return true;
  }
  if (subscription.status === "TRIALING") {
    return subscription.canCreateRecords && isFutureTimestamp(subscription.trialEndsAt, nowMs);
  }
  if (subscription.status === "ACTIVE" || subscription.status === "CANCELED") {
    return subscription.canCreateRecords && isFutureTimestamp(subscription.currentPeriodEnd, nowMs);
  }
  return false;
}

export async function purchaseDisputeBasicSubscription(
  account: LocalAccount,
  currentSubscription?: SubscriptionEntitlement | null,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const eligibility = currentSubscription
    ? { ok: true as const, subscription: currentSubscription }
    : await fetchSubscriptionStatus(account.id);
  if (!eligibility.ok) {
    return {
      ok: false,
      message: "Subscription status must be checked before opening Google Play. Connect to the internet and try again.",
    };
  }
  const checkedSubscription = eligibility.subscription;
  if (
    checkedSubscription?.status === "TRIALING" &&
    hasCurrentFullAccess(checkedSubscription)
  ) {
    return {
      ok: false,
      message: "No card is required during the 3-day trial. Subscribe after the trial ends.",
    };
  }
  if (hasCurrentFullAccess(checkedSubscription)) {
    return { ok: false, message: "Your current access period is still active." };
  }
  try {
    const configured = await getConfiguredPurchases(account);
    if (!configured.ok) return configured;
    const { Purchases } = configured;

    const selectedPackage = await getDisputeBasicPackage(Purchases);
    if (!selectedPackage) {
      return {
        ok: false,
        message:
          "DISPUTE Basic subscription product is not available in the store yet.",
      };
    }

    const purchase = await Purchases.purchasePackage(selectedPackage);
    const activeEntitlement =
      purchase.customerInfo.entitlements.active[disputeBasicEntitlementId];
    if (!activeEntitlement) {
      return {
        ok: false,
        message:
          "The store completed the purchase but the DISPUTE entitlement is not active. Restore purchases or contact support before retrying.",
      };
    }
    return {
      ok: true,
      message: "Subscription purchase completed. Refreshing access...",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Subscription purchase could not be completed.",
    };
  }
}

export async function fetchDisputeBasicStorePrice(
  account: LocalAccount,
): Promise<
  | { ok: true; localizedPrice: string }
  | { ok: false; message: string }
> {
  try {
    const configured = await getConfiguredPurchases(account);
    if (!configured.ok) return configured;

    const selectedPackage = await getDisputeBasicPackage(configured.Purchases);
    const localizedPrice = selectedPackage?.product.priceString?.trim();
    if (!localizedPrice) {
      return {
        ok: false,
        message: "The store price is not available yet.",
      };
    }

    return { ok: true, localizedPrice };
  } catch {
    return {
      ok: false,
      message: "Unable to load the localized store price.",
    };
  }
}

export async function restoreDisputeBasicSubscription(
  account: LocalAccount,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  try {
    const configured = await getConfiguredPurchases(account);
    if (!configured.ok) return configured;
    const customerInfo = await configured.Purchases.restorePurchases();
    const activeEntitlement =
      customerInfo.entitlements.active[disputeBasicEntitlementId];
    if (!activeEntitlement) {
      return {
        ok: false,
        message: "No active DISPUTE subscription was found for this store account.",
      };
    }
    return {
      ok: true,
      message: "Subscription restored. Refreshing access...",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Subscription restoration could not be completed.",
    };
  }
}

async function getConfiguredPurchases(account: LocalAccount) {
  if (Platform.OS === "web") {
    return {
      ok: false as const,
      message: "Store subscriptions are available in the phone app.",
    };
  }

  const apiKey =
    Platform.OS === "ios" ? revenueCatIosApiKey : revenueCatAndroidApiKey;
  const configurationError = getRevenueCatConfigurationError(
    Platform.OS,
    apiKey,
    disputeBasicEntitlementId,
  );
  if (configurationError) {
    return { ok: false as const, message: configurationError };
  }

  const purchasesModule = await import("react-native-purchases");
  const Purchases =
    "default" in purchasesModule ? purchasesModule.default : purchasesModule;
  const appUserID = account.id ?? account.email;
  if (!(await Purchases.isConfigured())) {
    Purchases.configure({
      apiKey,
      appUserID,
      useAmazon: false,
      diagnosticsEnabled: false,
      automaticDeviceIdentifierCollectionEnabled: false,
    });
  } else if (configuredRevenueCatUserId !== appUserID) {
    await Purchases.logIn(appUserID);
  }
  configuredRevenueCatUserId = appUserID;
  return { ok: true as const, Purchases };
}

let configuredRevenueCatUserId: string | null = null;

async function getDisputeBasicPackage(
  Purchases: typeof RevenueCatPurchases,
) {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages?.find(
    (item) => item.product.identifier === disputeBasicProductId,
  );
}

function getRevenueCatConfigurationError(
  platform: string,
  apiKey: string,
  entitlementId: string,
): string | null {
  if (!apiKey || !entitlementId) {
    return "Subscription purchase is unavailable until the production store configuration is completed.";
  }
  if (apiKey.startsWith("test_")) {
    return "Test Store billing is disabled in this production application.";
  }
  if (platform === "android" && !apiKey.startsWith("goog_")) {
    return "The Android subscription key is not a Google Play RevenueCat public key.";
  }
  if (platform === "ios" && !apiKey.startsWith("appl_")) {
    return "The iOS subscription key is not an App Store RevenueCat public key.";
  }
  return null;
}

export function formatTrialCountdown(subscription: SubscriptionEntitlement | null): string {
  if (!subscription?.trialEndsAt || subscription.status !== "TRIALING") {
    return "";
  }
  const remainingMs = Date.parse(subscription.trialEndsAt) - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "Trial ending now";
  }
  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return `${days} day${days === 1 ? "" : "s"} trial remaining`;
}

async function readJsonBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getErrorMessage(body: Record<string, unknown>, fallback: string) {
  const error = body.error;
  const message = body.message;
  return typeof error === "string"
    ? error
    : typeof message === "string"
      ? message
      : fallback;
}

function parseSubscriptionEntitlement(value: unknown): SubscriptionEntitlement | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const statuses: SubscriptionStatus[] = [
    "NONE",
    "TRIALING",
    "ACTIVE",
    "PAST_DUE",
    "CANCELED",
    "EXPIRED",
  ];
  if (!statuses.includes(item.status as SubscriptionStatus)) return null;
  if (typeof item.userId !== "string" || typeof item.planName !== "string") return null;
  if (typeof item.priceCents !== "number" || !Number.isFinite(item.priceCents)) return null;
  if (typeof item.currency !== "string" || typeof item.message !== "string") return null;
  if (!isNullableString(item.trialEndsAt) || !isNullableString(item.currentPeriodEnd)) return null;
  if (
    typeof item.isActive !== "boolean" ||
    typeof item.canCreateRecords !== "boolean" ||
    typeof item.canExportReports !== "boolean" ||
    typeof item.canExportPremiumReports !== "boolean" ||
    typeof item.canExportBasicData !== "boolean" ||
    typeof item.hasReferralRewardAccess !== "boolean" ||
    typeof item.billingEnforcementActive !== "boolean" ||
    item.billingProvider !== "store" ||
    item.billingInterval !== "month" ||
    !isNullableString(item.referralRewardEndsAt)
  ) return null;

  return item as SubscriptionEntitlement;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isFutureTimestamp(value: string | null, nowMs: number): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > nowMs;
}

async function saveCachedSubscriptionEntitlement(
  subscription: SubscriptionEntitlement,
): Promise<void> {
  try {
    const serialized = JSON.stringify(subscription);
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(getEntitlementCacheKey(subscription.userId), serialized);
      return;
    }
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(getEntitlementCacheKey(subscription.userId), serialized);
  } catch {
    // A cache failure must never block a verified server entitlement.
  }
}

async function loadCachedSubscriptionEntitlement(
  expectedUserId: string,
): Promise<SubscriptionEntitlement | null> {
  try {
    const serialized = Platform.OS === "web"
      ? globalThis.localStorage?.getItem(getEntitlementCacheKey(expectedUserId)) ?? null
      : await (await import("expo-secure-store")).getItemAsync(
          getEntitlementCacheKey(expectedUserId),
        );
    if (!serialized) return null;
    const subscription = parseSubscriptionEntitlement(JSON.parse(serialized));
    return subscription?.userId === expectedUserId ? subscription : null;
  } catch {
    return null;
  }
}

export async function clearCachedSubscriptionEntitlement(userId?: string): Promise<void> {
  if (!userId) return;
  try {
    const key = getEntitlementCacheKey(userId);
    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await (await import("expo-secure-store")).deleteItemAsync(key);
  } catch {
    // Logout and deletion continue even if the cache was already unavailable.
  }
}

function getEntitlementCacheKey(userId: string): string {
  return `${entitlementCacheKeyPrefix}.${userId}`;
}
