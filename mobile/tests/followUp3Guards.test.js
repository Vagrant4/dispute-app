const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobile = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(mobile, name), "utf8");

test("0.3.26 Google Maps identity and versionCode 28 are shared by JS and native Android", () => {
  const app = JSON.parse(read("app.json"));
  const pkg = JSON.parse(read("package.json"));
  const tileConfig = read("src/maps/tileConfig.ts");
  const gradle = read("android/app/build.gradle");
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  const appConfig = read("app.config.js");
  assert.equal(app.expo.version, "0.3.26");
  assert.equal(app.expo.android.versionCode, 28);
  assert.equal(pkg.version, "0.3.26");
  assert.match(tileConfig, /APP_VERSION = "0\.3\.26"/);
  assert.match(gradle, /versionCode 28/);
  assert.match(gradle, /versionName "0\.3\.26"/);
  assert.match(gradle, /versionNameSuffix "-test"/);
  assert.match(gradle, /manifestPlaceholders\.googleMapsApiKey/);
  assert.match(manifest, /android:name="com\.google\.android\.geo\.API_KEY"/);
  assert.match(manifest, /android:value="\$\{googleMapsApiKey\}"/);
  assert.doesNotMatch(appConfig, /extra:\s*\{[^}]*googleMapsApiKey/s);
});

test("geocoding and map diagnostics never log configuration or key-bearing values", () => {
  const source = `${read("src/work/workLocation.ts")}\n${read("src/screens/LocationMap.native.tsx")}`;
  assert.doesNotMatch(source, /console\.(?:warn|log|error)\([^\n]*(?:expoConfig|apiKey|googleMaps)/i);
  assert.doesNotMatch(source, /maps\.googleapis\.com\/maps\/api\/geocode/);
});

test("Today project choices use the shared dark sheet and light text", () => {
  const home = read("src/screens/HomeScreen.tsx");
  const picker = read("src/screens/ProjectPickerSheet.tsx");
  assert.match(home, /testID="today-project-picker-sheet"/);
  assert.match(picker, /styles\.projectSheet/);
  assert.match(picker, /<Text style=\{styles\.body\}>\{project\.name\}<\/Text>/);
  assert.match(home, /<Text style=\{\[styles\.body,[^\]]*\]\}>\+ New project<\/Text>/);
});

test("Today uses the official Google provider without custom tile URLs", () => {
  const map = read("src/screens/LocationMap.native.tsx");
  assert.match(map, /PROVIDER_GOOGLE/);
  assert.match(map, /provider=\{PROVIDER_GOOGLE\}/);
  assert.doesNotMatch(map, /buildOpenStreetMapTileUrl|tile\.openstreetmap\.org|OpenStreetMap contributors/);
});

test("Today embeds the map and accessible locate control without old map UI", () => {
  const home = read("src/screens/HomeScreen.tsx");
  assert.match(home, /<LocationMap/);
  assert.match(home, /accessibilityLabel="Show my location"/);
  const mapFrame = home.slice(home.indexOf('const renderMap'), home.indexOf('const todaySectionRenderers'));
  assert.match(mapFrame, /testID="today-locate-button"/);
  assert.match(mapFrame, /testID="today-locate-reticle"/);
  assert.match(mapFrame, /locationReticleHorizontal/);
  assert.match(mapFrame, /locationReticleVertical/);
  assert.doesNotMatch(mapFrame, /◎|pin\.png|navigation|arrow|>\s*[+xX]\s*</);
  assert.doesNotMatch(home, /accessibilityLabel="Get location"|formatLocationRow|assets\/icons\/pin\.png|Add your location|At your location/);
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
