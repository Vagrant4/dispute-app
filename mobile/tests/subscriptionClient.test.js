const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTsModule(relativePath, mocks = {}) {
  const cache = new Map();
  function load(normalizedPath) {
    const normalized = normalizedPath.replaceAll("\\", "/");
    if (cache.has(normalized)) return cache.get(normalized).exports;
    const sourcePath = path.join(__dirname, "..", normalized);
    const compiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const module = { exports: {} };
    cache.set(normalized, module);
    function localRequire(request) {
      if (request in mocks) return mocks[request];
      if (request.startsWith(".")) {
        return load(path.join(path.dirname(normalized), `${request}.ts`));
      }
      return require(request);
    }
    new Function("exports", "module", "require", compiled)(
      module.exports,
      module,
      localRequire,
    );
    return module.exports;
  }
  return load(relativePath);
}

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
  assert.match(source, /matchesConfiguredStoreProductIdentifier/);
  assert.match(source, /purchasePackage/);
  assert.match(source, /restorePurchases/);
  assert.match(source, /restoreDisputeBasicSubscription/);
  assert.match(source, /fetchDisputeBasicStorePrice/);
  assert.match(source, /product\.priceString/);
  assert.match(source, /Purchases\.isConfigured/);
});

test("subscription product matching accepts only the approved Google Play base plan", () => {
  const { matchesConfiguredStoreProductIdentifier } = loadTsModule(
    "src/subscription/subscriptionProduct.ts",
  );
  assert.equal(
    matchesConfiguredStoreProductIdentifier(
      "dispute_basic_monthly",
      "dispute_basic_monthly",
    ),
    true,
  );
  assert.equal(
    matchesConfiguredStoreProductIdentifier(
      "dispute_basic_monthly:monthly-plan",
      "dispute_basic_monthly",
    ),
    true,
  );
  assert.equal(
    matchesConfiguredStoreProductIdentifier(
      "dispute_basic_monthly:monthly-plan",
      "dispute_basic_monthly:monthly-plan",
    ),
    true,
  );
  assert.equal(
    matchesConfiguredStoreProductIdentifier(
      "dispute_basic_monthly:legacy-plan",
      "dispute_basic_monthly",
    ),
    false,
  );
  assert.equal(
    matchesConfiguredStoreProductIdentifier(
      "dispute_basic_monthly:",
      "dispute_basic_monthly",
    ),
    false,
  );
  assert.equal(
    matchesConfiguredStoreProductIdentifier(
      "other:monthly-plan",
      "dispute_basic_monthly",
    ),
    false,
  );
});

test("PDF export access accepts an active trial and rejects expired access", () => {
  const { canExportProgressClaim } = loadTsModule(
    "src/subscription/subscriptionClient.ts",
    {
      "react-native": { Platform: { OS: "android" } },
      "../auth/remoteAuth": {
        getAuthApiBaseUrl: () => "https://example.invalid",
      },
    },
  );
  const base = {
    userId: "user-a",
    status: "TRIALING",
    isActive: true,
    canCreateRecords: true,
    canExportReports: true,
    canExportPremiumReports: true,
    canExportBasicData: true,
    billingProvider: "store",
    billingEnforcementActive: true,
    planName: "DISPUTE Basic",
    priceCents: 699,
    currency: "SGD",
    billingInterval: "month",
    hasReferralRewardAccess: false,
    referralRewardEndsAt: null,
    currentPeriodEnd: null,
    message: "Trial active",
  };
  const nowMs = Date.parse("2026-08-07T00:00:00.000Z");
  assert.equal(
    canExportProgressClaim(
      { ...base, trialEndsAt: "2026-08-08T00:00:00.000Z" },
      nowMs,
    ),
    true,
  );
  assert.equal(
    canExportProgressClaim(
      { ...base, trialEndsAt: "2026-08-06T00:00:00.000Z" },
      nowMs,
    ),
    false,
  );
  assert.equal(
    canExportProgressClaim(
      {
        ...base,
        canExportReports: false,
        trialEndsAt: "2026-08-08T00:00:00.000Z",
      },
      nowMs,
    ),
    false,
  );
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
  assert.match(storePriceHookSource, /S\$6\.99\/month/);
  assert.doesNotMatch(settingsSource, /SGD 4\.99\/month/);
  assert.match(settingsSource, /No card required/);
  assert.match(settingsSource, /no charge starts automatically/i);
});
