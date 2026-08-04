const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = readFileSync(
  path.join(__dirname, "..", "src", "subscription", "subscriptionClient.ts"),
  "utf8",
);
const reportsSource = readFileSync(
  path.join(__dirname, "..", "src", "screens", "ProgressClaimReportsScreen.tsx"),
  "utf8",
);
const settingsSource = readFileSync(
  path.join(__dirname, "..", "src", "screens", "SettingsScreen.tsx"),
  "utf8",
);
const storePriceHookSource = readFileSync(
  path.join(
    __dirname,
    "..",
    "src",
    "subscription",
    "useDisputeBasicStorePrice.ts",
  ),
  "utf8",
);

test("subscription client fetches server entitlement with cookie credentials", () => {
  assert.match(source, /\/subscription\/status/);
  assert.match(source, /credentials: "include"/);
  assert.match(source, /canExportReports/);
  assert.match(source, /canCreateRecords/);
  assert.match(source, /canExportBasicData/);
  assert.match(source, /parseSubscriptionEntitlement/);
  assert.match(source, /hasCurrentFullAccess/);
  assert.match(source, /referralRewardEndsAt/);
  assert.match(source, /expo-secure-store/);
  assert.match(source, /loadCachedSubscriptionEntitlement/);
  assert.match(source, /expectedUserId/);
  assert.match(source, /subscription\.userId !== expectedUserId/);
  assert.match(source, /clearCachedSubscriptionEntitlement/);
  assert.doesNotMatch(source, /subscription as SubscriptionEntitlement/);
});

test("subscription purchase path uses RevenueCat store adapter and product keys", () => {
  assert.match(source, /react-native-purchases/);
  assert.match(source, /EXPO_PUBLIC_REVENUECAT_IOS_API_KEY/);
  assert.match(source, /EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY/);
  assert.match(source, /EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID/);
  assert.match(source, /process\.env\.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY/);
  assert.match(source, /dispute_basic_monthly/);
  assert.match(source, /apiKey\.startsWith\("test_"\)/);
  assert.match(source, /useAmazon: false/);
  assert.match(source, /entitlements\.active\[disputeBasicEntitlementId\]/);
  assert.match(source, /item\.product\.identifier === disputeBasicProductId/);
  assert.match(source, /purchasePackage/);
  assert.match(source, /restorePurchases/);
  assert.match(source, /restoreDisputeBasicSubscription/);
  assert.match(source, /fetchDisputeBasicStorePrice/);
  assert.match(source, /product\.priceString/);
  assert.match(source, /Purchases\.isConfigured/);
});

test("export screen gates report actions behind canExportReports", () => {
  assert.match(reportsSource, /ensureCanExport/);
  assert.match(reportsSource, /canExportReports/);
  assert.match(reportsSource, /Trial ended|subscription before export|Export requires/);
});

test("settings screen exposes subscription status and subscribe action", () => {
  assert.match(settingsSource, /useSubscriptionAccess/);
  assert.doesNotMatch(settingsSource, /fetchSubscriptionStatus/);
  assert.match(settingsSource, /purchaseDisputeBasicSubscription/);
  assert.match(settingsSource, /restoreDisputeBasicSubscription/);
  assert.match(settingsSource, /Restore purchases/);
  assert.match(settingsSource, /useDisputeBasicStorePrice/);
  assert.match(settingsSource, /formatMonthlyStorePrice/);
  assert.match(storePriceHookSource, /fetchDisputeBasicStorePrice/);
  assert.match(storePriceHookSource, /S\$7\.20\/month/);
  assert.doesNotMatch(settingsSource, /SGD 4\.99\/month/);
  assert.match(settingsSource, /No card required/);
  assert.match(settingsSource, /no charge starts automatically/i);
});
