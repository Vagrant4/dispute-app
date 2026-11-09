const assert = require("node:assert/strict");
const test = require("node:test");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const source = (relative) => readFileSync(path.join(__dirname, "..", relative), "utf8");

test("native location map uses an attributed OpenStreetMap basemap with a fixed pin", () => {
  const map = source("src/screens/LocationMap.native.tsx");
  assert.match(map, /buildOpenStreetMapTileUrl/);
  assert.match(map, /getTileRequestSource\(tile\.url\)/);
  assert.match(map, /headers:\s*\{\s*["']User-Agent["']:\s*TILE_USER_AGENT\s*\}/);
  assert.match(map, /TILE_USER_AGENT/);
  assert.doesNotMatch(map, /TILE_USER_AGENT\s*=\s*["'][^"']*okhttp/i);
  assert.match(map, /OpenStreetMap contributors/);
  assert.match(map, /styles\.locationMapPin/);
  assert.match(map, /styles\.locationMapAccuracyRing/);
  assert.doesNotMatch(map, /draggable\s*=/);
});

test("location map frame grows with its content instead of clipping the Maps action", () => {
  const styles = source("src/styles.ts");
  const frame = styles.match(/locationMapFrame:\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.doesNotMatch(frame, /height:\s*360/);
  assert.doesNotMatch(frame, /overflow:\s*"hidden"/);
  assert.match(styles, /locationMapCanvas:\s*\{[^}]*height:\s*260/);
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
  for (const file of ["HomeScreen.tsx", "ProjectDetailScreen.tsx", "SettingsScreen.tsx"]) {
    const screen = source(`src/screens/${file}`);
    assert.doesNotMatch(screen, /numberOfLines=\{1\}/, file);
  }
});
