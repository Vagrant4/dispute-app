const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.join(__dirname, "..");
const repoRoot = path.join(mobileRoot, "..");
const read = (...segments) => readFileSync(path.join(...segments), "utf8");

test("production package and EAS profile use release-safe versioning and AAB output", () => {
  const packageJson = JSON.parse(read(mobileRoot, "package.json"));
  const appJson = JSON.parse(read(mobileRoot, "app.json"));
  const easJson = JSON.parse(read(mobileRoot, "eas.json"));
  const buildGradle = read(mobileRoot, "android", "app", "build.gradle");
  const gradleVersionName = buildGradle.match(/versionName\s+"([^"]+)"/)?.[1];
  const gradleVersionCode = Number(buildGradle.match(/versionCode\s+(\d+)/)?.[1]);

  assert.equal(packageJson.version, appJson.expo.version);
  assert.equal(gradleVersionName, appJson.expo.version);
  assert.equal(packageJson.dependencies["expo-dev-client"], undefined);
  assert.ok(appJson.expo.android.versionCode >= 2);
  assert.equal(gradleVersionCode, appJson.expo.android.versionCode);
  assert.equal(appJson.expo.android.allowBackup, false);
  assert.equal(easJson.cli.appVersionSource, "remote");
  assert.equal(easJson.build.production.autoIncrement, true);
  assert.equal(easJson.build.production.android.buildType, "app-bundle");
  assert.equal(easJson.build.production.credentialsSource, "remote");
  assert.match(easJson.build.production.env.EXPO_PUBLIC_API_BASE_URL, /^https:\/\//);
  assert.equal(easJson.build.development.android.gradleCommand, ":app:assembleDebug");
  assert.equal(easJson.build.preview.android.gradleCommand, ":app:assembleDebug");
});

test("mobile authentication fails safely to HTTPS outside development", () => {
  const remoteAuth = read(mobileRoot, "src", "auth", "remoteAuth.ts");
  assert.match(remoteAuth, /configuredApiBaseUrl\.startsWith\("https:\/\/"\)/);
  assert.match(remoteAuth, /isDevelopmentRuntime/);
  assert.match(remoteAuth, /https:\/\/dispute-api-live\.onrender\.com/);
});

test("release Gradle configuration has no debug signing and enables R8 plus resource shrinking", () => {
  const buildGradle = read(mobileRoot, "android", "app", "build.gradle");
  const properties = read(mobileRoot, "android", "gradle.properties");

  assert.doesNotMatch(buildGradle, /signingConfig\s+signingConfigs\.debug/);
  assert.match(buildGradle, /applicationIdSuffix "\.test"/);
  assert.match(buildGradle, /versionNameSuffix "-test"/);
  assert.match(buildGradle, /resValue "string", "app_name", "DISPUTE Test"/);
  assert.match(buildGradle, /minifyEnabled true/);
  assert.match(buildGradle, /shrinkResources true/);
  assert.match(buildGradle, /proguard-android-optimize\.txt/);
  assert.doesNotMatch(properties, /EX_DEV_CLIENT_NETWORK_INSPECTOR/);
});

test("production manifest blocks cleartext, backups, dev permissions, test stores, and custom schemes", () => {
  const manifest = read(mobileRoot, "android", "app", "src", "main", "AndroidManifest.xml");

  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:launchMode="singleTop"/);
  for (const permission of [
    "RECORD_AUDIO",
    "SYSTEM_ALERT_WINDOW",
    "READ_EXTERNAL_STORAGE",
    "WRITE_EXTERNAL_STORAGE",
    "USE_BIOMETRIC",
    "USE_FINGERPRINT",
    "VIBRATE",
  ]) {
    assert.match(manifest, new RegExp(`${permission}[^>]+tools:node="remove"`));
  }
  assert.match(manifest, /com\.amazon\.device\.iap\.ResponseReceiver[^>]+tools:node="remove"/);
  assert.match(manifest, /SimulatedStoreErrorDialogActivity[^>]+tools:node="remove"/);
  assert.doesNotMatch(manifest, /exp\+claimproof-sg/);
});

test("debug-only manifest can use local cleartext traffic without weakening release", () => {
  const debugManifest = read(mobileRoot, "android", "app", "src", "debug", "AndroidManifest.xml");
  assert.match(debugManifest, /android:usesCleartextTraffic="true"/);
});

test("backup rules exclude all app domains and signing materials are ignored", () => {
  const backupRules = read(mobileRoot, "android", "app", "src", "main", "res", "xml", "backup_rules.xml");
  const extractionRules = read(mobileRoot, "android", "app", "src", "main", "res", "xml", "data_extraction_rules.xml");
  const gitignore = read(repoRoot, ".gitignore");

  for (const domain of ["root", "file", "database", "sharedpref", "external"]) {
    assert.match(backupRules, new RegExp(`exclude domain="${domain}" path="\\."`));
    assert.match(extractionRules, new RegExp(`exclude domain="${domain}" path="\\."`));
  }
  assert.match(gitignore, /\*\.keystore/);
  assert.match(gitignore, /\*\.jks/);
  assert.match(gitignore, /credentials\.json/);
});
