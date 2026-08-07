export const DISPUTE_BASIC_ANDROID_BASE_PLAN_ID = "monthly-plan";

export function matchesConfiguredStoreProductIdentifier(
  storeIdentifier: string,
  configuredIdentifier: string,
): boolean {
  const normalizedStoreIdentifier = storeIdentifier.trim();
  const normalizedConfiguredIdentifier = configuredIdentifier.trim();
  if (!normalizedStoreIdentifier || !normalizedConfiguredIdentifier) {
    return false;
  }
  if (normalizedStoreIdentifier === normalizedConfiguredIdentifier) {
    return true;
  }

  // RevenueCat SDK v6+ identifies Google Play subscriptions as
  // "subscription-id:base-plan-id". When the environment keeps only the
  // stable subscription id, fail closed to DISPUTE's approved monthly plan.
  return !normalizedConfiguredIdentifier.includes(":") &&
    normalizedStoreIdentifier ===
      `${normalizedConfiguredIdentifier}:${DISPUTE_BASIC_ANDROID_BASE_PLAN_ID}`;
}
