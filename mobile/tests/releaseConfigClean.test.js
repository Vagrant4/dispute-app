const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobile = path.resolve(__dirname, "..");
const read = (file) => readFileSync(path.join(mobile, file), "utf8");

test("release configuration permits development-only overrides but never enables them in production", () => {
  const guestTrial = read("src/subscription/guestTrial.ts");
  const remoteAuth = read("src/auth/remoteAuth.ts");
  const eas = JSON.parse(read("eas.json"));
  const gradle = read("android/app/build.gradle");

  assert.match(guestTrial, /isTrialDebugOverrideEnabled\s*=\s*\(\)\s*=>\s*typeof __DEV__ !== "undefined"\s*&&\s*__DEV__\s*&&\s*process\.env\.EXPO_PUBLIC_TRIAL_DEBUG_OVERRIDE\s*===\s*"1"/);
  assert.match(remoteAuth, /configuredApiBaseUrl\.startsWith\("https:\/\/"\)\s*\|\|\s*isDevelopmentRuntime/);
  assert.doesNotMatch(remoteAuth, /(?:localhost|10\.0\.2\.2|https?:\/\/(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.))/i);
  assert.equal(eas.build.production.env.EXPO_PUBLIC_API_BASE_URL, "https://dispute-api-live.onrender.com");
  assert.doesNotMatch(JSON.stringify(eas.build.production), /(?:TESTONLY|DEBUG|MOCK)/i);
  assert.doesNotMatch(read("app.json") + read("app.config.js") + read("eas.json"), /(?:localhost|10\.0\.2\.2|https?:\/\/(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.))/i);
  const releaseBlock = gradle.slice(gradle.indexOf("release {"), gradle.indexOf("internal {"));
  assert.doesNotMatch(releaseBlock, /signingConfig\s+signingConfigs\.debug/);
});

test("Android release permissions are limited to shipped features and explicitly remove transitive extras", () => {
  const app = JSON.parse(read("app.json"));
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  const allowed = [
    "android.permission.CAMERA",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.RECORD_AUDIO",
    "com.android.vending.BILLING",
  ];
  const removed = [
    "android.permission.ACCESS_BACKGROUND_LOCATION",
    "android.permission.FOREGROUND_SERVICE_LOCATION",
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.READ_MEDIA_AUDIO",
    "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
    "android.permission.ACCESS_MEDIA_LOCATION",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.VIBRATE",
    "android.permission.USE_BIOMETRIC",
    "android.permission.USE_FINGERPRINT",
  ];
  assert.deepEqual(app.expo.android.permissions, allowed);
  assert.deepEqual([...app.expo.android.blockedPermissions].sort(), [...removed].sort());
  for (const permission of [...allowed, ...removed]) {
    assert.match(manifest, new RegExp(`android:name="${permission.replace(/\\./g, "\\\\.")}"`));
  }
  for (const permission of removed) {
    assert.match(manifest, new RegExp(`android:name="${permission.replace(/\\./g, "\\\\.")}"\\s+tools:node="remove"`));
  }
});
