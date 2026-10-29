const assert = require("node:assert/strict");
const test = require("node:test");
const { createLoader, fixture, source } = require("./locationTestHelpers");
const { formatProjectSite } = createLoader()("src/work/projectSite.ts");

test("project site labels distinguish a named site, unnamed GPS and missing fix", () => {
  const fix = { lastSiteAddress: null, lastSiteLatitude: 0, lastSiteLongitude: 0, lastSiteAccuracyM: 12.6 };
  assert.equal(formatProjectSite(fix), "GPS site ±13m");
  assert.equal(formatProjectSite({ ...fix, lastSiteAddress: "  Road 1 " }), "Road 1");
  assert.equal(formatProjectSite({ ...fix, lastSiteAddress: " " }), "GPS site ±13m");
  for (const accuracy of [null, -1, NaN, Infinity]) assert.equal(formatProjectSite({ ...fix, lastSiteAccuracyM: accuracy }), "GPS site");
  assert.equal(formatProjectSite({ ...fix, lastSiteLatitude: null }), "No GPS site recorded");
  assert.equal(formatProjectSite(null), "No GPS site recorded");
});

for (const kind of ["sqlite", "web"]) test(`${kind}: latest unnamed stop fix takes precedence over named start site`, async () => {
  const { store, userId, projectId } = await fixture(kind);
  const entry = await store.clockIn({ userId, projectId, clockInAt: new Date("2026-10-26T08:00:00Z"), locationText: "Start street", gpsLatitude: 1.3, gpsLongitude: 103.8, gpsAccuracyM: 5 });
  let summary = (await store.listProjectSummaries(userId, "2026-10-26")).find((row) => row.id === projectId);
  assert.equal(formatProjectSite(summary), "Start street");
  await store.clockOut({ userId, entryId: entry.id, clockOutAt: new Date("2026-10-26T09:00:00Z"), gpsLatitude: 1.4, gpsLongitude: 103.9, gpsAccuracyM: 22.7 });
  summary = (await store.listProjectSummaries(userId, "2026-10-26")).find((row) => row.id === projectId);
  assert.equal(formatProjectSite(summary), "GPS site ±23m");
});

test("bottom tabs use stacked glyphs, theme colours, accessible targets and bottom safe area", () => {
  const app = source("App.tsx");
  const bar = app.slice(app.indexOf('<SafeAreaView style={styles.bottomTabBar}'));
  assert.doesNotMatch(bar, /styles\.tabButton/);
  assert.match(bar, /accessibilityRole="tab"/);
  assert.match(bar, /accessibilityState=\{\{ selected \}\}/);
  assert.match(bar, /edges=\{\["bottom"\]\}/);
  assert.ok(bar.indexOf("{tabIcons[tab.id]}") < bar.lastIndexOf("{tab.label}"));
  for (const glyph of ["◷", "▦", "▤", "⚙"]) assert.ok(app.includes(glyph));
  const styles = source("src/styles.ts");
  assert.match(styles, /bottomTabItem: \{[^\n]*minWidth: 48, minHeight: 48/);
  assert.match(styles, /bottomTabBar: \{[^\n]*borderTopColor: theme.colors.border/);
  assert.match(styles, /bottomTabActive: \{ color: theme.colors.primary/);
  for (const key of ["bottomTabIcon", "bottomTabLabel"]) assert.match(styles, new RegExp(key + ': \\{ color: theme.colors.textMuted'));
});

test("Photos and Projects keep the single App title and inner count subtitles", () => {
  const app = source("App.tsx");
  assert.equal((app.match(/\? activeTitle/g) || []).length, 1);
  const { tabs } = createLoader()("src/screenContent.ts");
  for (const title of ["Photos", "Projects"]) assert.equal(tabs.filter((tab) => tab.title === title).length, 1);
  assert.doesNotMatch(source("src/screens/PhotoEvidenceScreen.tsx"), />Photos<\/Text>/);
  assert.doesNotMatch(source("src/screens/ProjectsScreen.tsx"), />Projects<\/Text>/);
  assert.match(source("src/screens/PhotoEvidenceScreen.tsx"), /\{rows.length\} photos/);
  assert.match(source("src/screens/ProjectsScreen.tsx"), /\{summaries.length\} projects/);
  for (const screen of ["ProjectsScreen", "ProjectDetailScreen"]) assert.match(source(`src/screens/${screen}.tsx`), /formatProjectSite\(/);
});
