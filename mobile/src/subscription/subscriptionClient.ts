import { Platform } from "react-native";

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
  canExportReports: boolean;
  billingProvider: "store";
  billingEnforcementActive: boolean;
  planName: string;
  priceCents: number;
  currency: string;
  billingInterval: "month";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  message: string;
};

type FetchLike = typeof fetch;

const revenueCatIosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
const revenueCatAndroidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";
const disputeBasicProductId = "dispute_basic_monthly";

export async function fetchSubscriptionStatus(
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

    return {
      ok: true,
      subscription,
    };
  } catch {
    return {
      ok: false,
      message:
        "Unable to reach Dispute server. Connect to the internet to refresh subscription status.",
    };
  }
}

export async function purchaseDisputeBasicSubscription(
  account: LocalAccount,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (Platform.OS === "web") {
    return { ok: false, message: "Store subscriptions are available in the phone app." };
  }

  const apiKey =
    Platform.OS === "ios" ? revenueCatIosApiKey : revenueCatAndroidApiKey;
  if (!apiKey) {
    return {
      ok: false,
      message:
        "Subscription purchase is not configured yet. Add the RevenueCat store API key and DISPUTE Basic product before taking payment.",
    };
  }

  try {
    const purchasesModule = await import("react-native-purchases");
    const Purchases =
      "default" in purchasesModule ? purchasesModule.default : purchasesModule;
    Purchases.configure({
      apiKey,
      appUserID: account.id ?? account.email,
    });

    const offerings = await Purchases.getOfferings();
    const selectedPackage = offerings.current?.availablePackages?.find(
      (item) => item.product.identifier === disputeBasicProductId,
    );
    if (!selectedPackage) {
      return {
        ok: false,
        message:
          "DISPUTE Basic subscription product is not available in the store yet.",
      };
    }

    await Purchases.purchasePackage(selectedPackage);
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

export function formatSubscriptionPrice(subscription: SubscriptionEntitlement): string {
  return `${subscription.currency} ${(subscription.priceCents / 100).toFixed(2)}/month`;
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
    typeof item.canExportReports !== "boolean" ||
    typeof item.billingEnforcementActive !== "boolean" ||
    item.billingProvider !== "store" ||
    item.billingInterval !== "month"
  ) return null;

  return item as SubscriptionEntitlement;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
