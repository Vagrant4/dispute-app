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
const profileSettingsSource = readFileSync(
  path.join(__dirname, "..", "src", "screens", "ProfileSettingsPanel.tsx"),
  "utf8",
);
const planBillingSource = readFileSync(
  path.join(__dirname, "..", "src", "screens", "PlanBillingPanel.tsx"),
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

test("mobile uses the shared approved Google Play base-plan policy", () => {
  const productPolicySource = readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "subscription",
      "subscriptionProduct.ts",
    ),
    "utf8",
  );
  assert.match(productPolicySource, /from ["']@claimproof\/shared["']/);
  assert.match(productPolicySource, /matchesConfiguredStoreProductIdentifier/);
  assert.match(productPolicySource, /DISPUTE_BASIC_ANDROID_BASE_PLAN_ID/);
});

test("restore verifies the active store entitlement with the authenticated server", async () => {
  const previousAndroidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  const previousEntitlement = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID;
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = "goog_test_public_key";
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID = "dispute_basic";
  const syncCalls = [];
  try {
    const Purchases = {
      isConfigured: async () => true,
      logIn: async () => undefined,
      restorePurchases: async () => ({
        entitlements: { active: { dispute_basic: {} } },
      }),
    };
    const { restoreDisputeBasicSubscription } = loadTsModule(
      "src/subscription/subscriptionClient.ts",
      {
        "react-native": { Platform: { OS: "android" } },
        "react-native-purchases": Purchases,
        "../auth/remoteAuth": {
          getAuthApiBaseUrl: () => "https://api.dispute.test",
        },
        "@claimproof/shared": {
          DISPUTE_BASIC_ANDROID_BASE_PLAN_ID: "monthly-plan",
          matchesConfiguredStoreProductIdentifier: () => true,
        },
      },
    );
    const fetcher = async (input, init) => {
      syncCalls.push({ input: String(input), init });
      return Response.json({ synced: true, status: "ACTIVE" });
    };

    const restored = await restoreDisputeBasicSubscription(
      { id: "user-a", email: "user-a@example.com" },
      fetcher,
    );

    assert.deepEqual(restored, {
      ok: true,
      message: "Subscription restored and access is active.",
    });
    assert.equal(syncCalls.length, 1);
    assert.equal(syncCalls[0].input, "https://api.dispute.test/subscription/sync");
    assert.equal(syncCalls[0].init.method, "POST");
    assert.equal(syncCalls[0].init.credentials, "include");
  } finally {
    restoreEnv("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY", previousAndroidKey);
    restoreEnv("EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID", previousEntitlement);
  }
});

test("restore does not report success when server verification fails", async () => {
  const previousAndroidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  const previousEntitlement = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID;
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = "goog_test_public_key";
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID = "dispute_basic";
  try {
    const Purchases = {
      isConfigured: async () => true,
      logIn: async () => undefined,
      restorePurchases: async () => ({
        entitlements: { active: { dispute_basic: {} } },
      }),
    };
    const { restoreDisputeBasicSubscription } = loadTsModule(
      "src/subscription/subscriptionClient.ts",
      {
        "react-native": { Platform: { OS: "android" } },
        "react-native-purchases": Purchases,
        "../auth/remoteAuth": {
          getAuthApiBaseUrl: () => "https://api.dispute.test",
        },
        "@claimproof/shared": {
          DISPUTE_BASIC_ANDROID_BASE_PLAN_ID: "monthly-plan",
          matchesConfiguredStoreProductIdentifier: () => true,
        },
      },
    );

    const restored = await restoreDisputeBasicSubscription(
      { id: "user-a", email: "user-a@example.com" },
      async () => Response.json(
        { error: "RevenueCat could not verify this subscription." },
        { status: 502 },
      ),
    );

    assert.deepEqual(restored, {
      ok: false,
      message:
        "The store found your subscription, but Dispute could not verify access yet. Please wait a moment and try again, or contact support.",
    });
  } finally {
    restoreEnv("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY", previousAndroidKey);
    restoreEnv("EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID", previousEntitlement);
  }
});

test("PDF export access accepts an active trial and rejects expired access", () => {
  const { canExportProgressClaim } = loadTsModule(
    "src/subscription/subscriptionClient.ts",
    {
      "react-native": { Platform: { OS: "android" } },
      "../auth/remoteAuth": {
        getAuthApiBaseUrl: () => "https://example.invalid",
      },
      "@claimproof/shared": {
        DISPUTE_BASIC_ANDROID_BASE_PLAN_ID: "monthly-plan",
        matchesConfiguredStoreProductIdentifier: () => false,
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
  assert.equal(
    canExportProgressClaim(
      {
        ...base,
        status: "PAST_DUE",
        trialEndsAt: null,
        currentPeriodEnd: "2026-08-08T00:00:00.000Z",
      },
      nowMs,
    ),
    true,
  );
});

test("export screen gates report actions behind canExportReports", () => {
  assert.match(reportsSource, /ensureCanExport/);
  assert.match(reportsSource, /canExportReports/);
  assert.match(reportsSource, /Trial ended|subscription before export|Export requires/);
});

test("settings screen keeps profile read-only and shows only subscribe or manage", () => {
  assert.match(settingsSource, /useSubscriptionAccess/);
  assert.doesNotMatch(settingsSource, /fetchSubscriptionStatus/);
  assert.match(settingsSource, /purchaseDisputeBasicSubscription/);
  assert.match(settingsSource, /getSubscriptionSettingsAction/);
  assert.match(settingsSource, /getSubscriptionManagementUrl/);
  assert.match(settingsSource, /Plan & billing/);
  assert.match(settingsSource, /PlanBillingPanel/);
  assert.match(settingsSource, /ProfileSettingsPanel/);
  assert.match(planBillingSource, /Manage subscription/);
  assert.doesNotMatch(planBillingSource, /Cancel subscription/);
  assert.match(profileSettingsSource, /Verified email/);
  assert.doesNotMatch(profileSettingsSource, /Profile changes are local to this phone/);
  assert.doesNotMatch(profileSettingsSource, /accessibilityLabel="Profile email"/);
  assert.doesNotMatch(settingsSource, /Restore purchases/);
  assert.doesNotMatch(settingsSource, /Refresh status/);
  assert.doesNotMatch(settingsSource, /current plan/);
  assert.doesNotMatch(settingsSource, /subscriptionContent\.noCheckout/);
  assert.doesNotMatch(settingsSource, /subscriptionContent\.policyGated/);
  assert.match(settingsSource, /useDisputeBasicStorePrice/);
  assert.match(planBillingSource, /formatMonthlyStorePrice/);
  assert.match(storePriceHookSource, /fetchDisputeBasicStorePrice/);
  assert.match(storePriceHookSource, /S\$6\.99\/month/);
  assert.doesNotMatch(settingsSource, /SGD 4\.99\/month/);
  assert.doesNotMatch(source, /Restore purchases/);
});

test("subscription settings action follows the paid period instead of referral access", () => {
  const { getSubscriptionSettingsAction } = loadTsModule(
    "src/subscription/subscriptionClient.ts",
    {
      "react-native": { Platform: { OS: "android" } },
      "../auth/remoteAuth": {
        getAuthApiBaseUrl: () => "https://example.invalid",
      },
      "@claimproof/shared": {
        DISPUTE_BASIC_ANDROID_BASE_PLAN_ID: "monthly-plan",
        matchesConfiguredStoreProductIdentifier: () => false,
      },
    },
  );

  const nowMs = Date.parse("2026-08-10T00:00:00.000Z");
  const future = "2026-08-11T00:00:00.000Z";
  const past = "2026-08-09T00:00:00.000Z";
  assert.equal(getSubscriptionSettingsAction(null, nowMs), "none");
  assert.equal(
    getSubscriptionSettingsAction({ status: "EXPIRED", currentPeriodEnd: future }, nowMs),
    "subscribe",
  );
  assert.equal(
    getSubscriptionSettingsAction({ status: "ACTIVE", currentPeriodEnd: future }, nowMs),
    "manage",
  );
  assert.equal(
    getSubscriptionSettingsAction({ status: "ACTIVE", currentPeriodEnd: past }, nowMs),
    "subscribe",
  );
  assert.equal(
    getSubscriptionSettingsAction({ status: "PAST_DUE", currentPeriodEnd: future }, nowMs),
    "manage",
  );
  assert.equal(
    getSubscriptionSettingsAction({ status: "TRIALING", trialEndsAt: future }, nowMs),
    "none",
  );
  assert.equal(
    getSubscriptionSettingsAction({ status: "TRIALING", trialEndsAt: past }, nowMs),
    "subscribe",
  );
  assert.equal(
    getSubscriptionSettingsAction({ status: "CANCELED", currentPeriodEnd: future }, nowMs),
    "manage",
  );
  assert.equal(
    getSubscriptionSettingsAction({ status: "CANCELED", currentPeriodEnd: past }, nowMs),
    "subscribe",
  );
});

test("subscription management opens the correct store page", () => {
  const { getSubscriptionManagementUrl } = loadTsModule(
    "src/subscription/subscriptionClient.ts",
    {
      "react-native": { Platform: { OS: "android" } },
      "../auth/remoteAuth": {
        getAuthApiBaseUrl: () => "https://example.invalid",
      },
      "@claimproof/shared": {
        DISPUTE_BASIC_ANDROID_BASE_PLAN_ID: "monthly-plan",
        matchesConfiguredStoreProductIdentifier: () => false,
      },
    },
  );

  assert.equal(
    getSubscriptionManagementUrl("android"),
    "https://play.google.com/store/account/subscriptions?sku=dispute_basic_monthly&package=sg.claimproof.mobile",
  );
  assert.equal(
    getSubscriptionManagementUrl("ios"),
    "https://apps.apple.com/account/subscriptions",
  );
  assert.equal(getSubscriptionManagementUrl("web"), null);
});

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
