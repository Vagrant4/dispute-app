const assert = require("node:assert/strict");
const test = require("node:test");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const source = (relative) => readFileSync(path.join(__dirname, "..", relative), "utf8");

test("native location map uses the official Google provider with a fixed pin", () => {
  const map = source("src/screens/LocationMap.native.tsx");
  assert.match(map, /PROVIDER_GOOGLE/);
  assert.match(map, /provider=\{PROVIDER_GOOGLE\}/);
  assert.doesNotMatch(map, /buildOpenStreetMapTileUrl|tile\.openstreetmap\.org|OpenStreetMap contributors/);
  assert.match(map, /<Marker/);
  assert.match(map, /<Circle/);
  assert.doesNotMatch(map, /draggable\s*=/);
  assert.match(map, /mapType="standard"/);
  assert.doesNotMatch(map, /customMapStyle/);
});

test("native location map has a street-level Singapore region on its first paint", () => {
  const map = source("src/screens/LocationMap.native.tsx");
  assert.match(map, /DEFAULT_LATITUDE = 1\.3521/);
  assert.match(map, /DEFAULT_LONGITUDE = 103\.8198/);
  assert.match(map, /DEFAULT_REGION_DELTA = 0\.01/);
  assert.match(map, /initialRegion=\{\{[\s\S]*latitude,[\s\S]*longitude,[\s\S]*latitudeDelta: DEFAULT_REGION_DELTA,[\s\S]*longitudeDelta: DEFAULT_REGION_DELTA/);
  assert.match(map, /initialCamera=\{\{ center: coordinate, heading: 0, pitch: 0, zoom: MAP_ZOOM \}\}/);
});

test("native Google MapView fills its canvas without post-mount state resizing", () => {
  const map = source("src/screens/LocationMap.native.tsx");
  assert.match(map, /style=\{\{ width: "100%", height: "100%" \}\}/);
  assert.doesNotMatch(map, /useState\(\{ width: 360, height: 260 \}\)|mapSize|handleMapLayout|onLayout=/);
});

test("location map frame flexes and clips map tiles to the rounded card", () => {
  const styles = source("src/styles.ts");
  const frame = styles.match(/locationMapFrame:\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.doesNotMatch(frame, /height:\s*360/);
  assert.match(frame, /overflow:\s*"hidden"/);
  assert.match(frame, /borderRadius:\s*radius\.md/);
  assert.match(frame, /flex:\s*1/);
  assert.match(styles, /locationMapCanvas:\s*\{[^}]*flex:\s*1/);
});

test("web location map keeps a dark, lime-accented fallback at the native map height", () => {
  const styles = source("src/styles.ts");
  const fallback = styles.match(/locationMapFallback:\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.match(fallback, /backgroundColor:\s*theme\.colors\.surfaceMuted/);
  assert.match(fallback, /borderColor:\s*theme\.colors\.primary/);
  assert.match(fallback, /minHeight:\s*260/);
  assert.doesNotMatch(fallback, /fontSize/);
});

test("settings plan subtitle is allowed to wrap", () => {
  const settings = source("src/screens/SettingsScreen.tsx");
  assert.doesNotMatch(settings, /numberOfLines=\{1\}\s+style=\{styles\.settingsRowSubtitle\}/);
});

test("subscription CTA contains only its concise action and price copy sits below", () => {
  const panel = source("src/screens/PlanBillingPanel.tsx");
  const subscribeButton = panel.slice(panel.indexOf('action === "subscribe"'), panel.indexOf('action === "manage"'));
  assert.match(subscribeButton, />Subscribe<\/Text>/);
  assert.doesNotMatch(subscribeButton, /Dispute Basic - \{monthlyPrice\}/);
  assert.match(panel, /\{monthlyPrice\}/);
  assert.match(panel, /Final price shown in Google Play/);
});

test("reviewed text containers do not force explanatory copy to one line", () => {
  const home = source("src/screens/HomeScreen.tsx");
  assert.equal((home.match(/numberOfLines=\{1\}/g) || []).length, 1);
  assert.match(home, /numberOfLines=\{1\} style=\{styles\.todayClock\}/);
  for (const file of ["ProjectDetailScreen.tsx", "SettingsScreen.tsx"]) {
    const screen = source(`src/screens/${file}`);
    assert.doesNotMatch(screen, /numberOfLines=\{1\}/, file);
  }
});
