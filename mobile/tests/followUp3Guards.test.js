const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobile = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(mobile, name), "utf8");

test("0.3.3 tile identity is shared by JS and native Android", () => {
  const app = JSON.parse(read("app.json"));
  const tileConfig = read("src/maps/tileConfig.ts");
  const native = read("android/app/src/main/java/sg/claimproof/mobile/MainApplication.kt");
  assert.equal(app.expo.version, "0.3.3");
  assert.match(tileConfig, /APP_VERSION = "0\.3\.3"/);
  assert.match(native, /OkHttpClientProvider\.setOkHttpClientFactory/);
  assert.match(native, /tile\.openstreetmap\.org/);
  assert.match(native, /User-Agent/);
  assert.match(native, /BuildConfig\.VERSION_NAME/);
});

test("tile URLs use a versioned Fresco cache key and retain JS headers", () => {
  const map = read("src/screens/LocationMap.native.tsx");
  assert.match(map, /buildOpenStreetMapTileUrl/);
  assert.match(map, /TILE_CACHE_VERSION/);
  assert.match(map, /headers:\s*\{\s*"User-Agent": TILE_USER_AGENT/);
});

test("Today embeds the map and accessible locate control without old map UI", () => {
  const home = read("src/screens/HomeScreen.tsx");
  assert.match(home, /<LocationMap/);
  assert.match(home, /accessibilityLabel="Show my location"/);
  assert.doesNotMatch(home, /View on map/);
  assert.doesNotMatch(home, /locationMapOpen/);
  assert.doesNotMatch(read("src/screens/LocationMap.native.tsx"), /Open in Maps/);
});

test("mobile screens contain no visible accuracy readouts", () => {
  const screenFiles = fs.readdirSync(path.join(mobile, "src/screens")).filter((name) => /\.tsx$/.test(name));
  const source = screenFiles.map((name) => read(`src/screens/${name}`)).join("\n");
  assert.doesNotMatch(source, /Accuracy unknown|accuracy unknown|Math\.round\([^)]*accuracy|[±]\$\{/);
});

test("mobile referral UI and module are removed", () => {
  const source = [read("App.tsx"), ...fs.readdirSync(path.join(mobile, "src/screens")).filter((name) => /\.tsx$/.test(name)).map((name) => read(`src/screens/${name}`))].join("\n");
  assert.doesNotMatch(source, /Refer a friend|ReferralScreen|referrals/);
  assert.equal(fs.existsSync(path.join(mobile, "src/referrals")), false);
});

test("all React Native Modal declarations provide onRequestClose", () => {
  for (const name of fs.readdirSync(path.join(mobile, "src/screens")).filter((name) => /\.tsx$/.test(name))) {
    const source = read(`src/screens/${name}`);
    for (const match of source.matchAll(/<Modal\b([^>]*)>/gs)) {
      assert.match(match[1], /onRequestClose=/, `${name} Modal must handle Android back`);
    }
  }
});

test("modal sheets consume safe area bottom inset", () => {
  assert.match(read("src/screens/ProjectNameSheet.tsx"), /useSafeAreaInsets/);
  assert.match(read("src/screens/PhotoEvidenceScreen.tsx"), /useSafeAreaInsets/);
});
