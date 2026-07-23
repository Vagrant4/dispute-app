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

test("subscription client fetches server entitlement with cookie credentials", () => {
  assert.match(source, /\/subscription\/status/);
  assert.match(source, /credentials: "include"/);
  assert.match(source, /canExportReports/);
  assert.match(source, /parseSubscriptionEntitlement/);
  assert.doesNotMatch(source, /subscription as SubscriptionEntitlement/);
});

test("subscription purchase path uses RevenueCat store adapter and product keys", () => {
  assert.match(source, /react-native-purchases/);
  assert.match(source, /EXPO_PUBLIC_REVENUECAT_IOS_API_KEY/);
  assert.match(source, /EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY/);
  assert.match(source, /process\.env\.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY/);
  assert.match(source, /dispute_basic_monthly/);
  assert.match(source, /item\.product\.identifier === disputeBasicProductId/);
  assert.match(source, /purchasePackage/);
});

test("export screen gates report actions behind canExportReports", () => {
  assert.match(reportsSource, /ensureCanExport/);
  assert.match(reportsSource, /canExportReports/);
  assert.match(reportsSource, /Trial ended|subscription before export|Export requires/);
});

test("settings screen exposes subscription status and subscribe action", () => {
  assert.match(settingsSource, /fetchSubscriptionStatus/);
  assert.match(settingsSource, /purchaseDisputeBasicSubscription/);
  assert.match(settingsSource, /SGD 4\.99\/month/);
});
