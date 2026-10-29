const assert = require("node:assert/strict");
const test = require("node:test");
const { source, createLoader } = require("./locationTestHelpers");
const { startReadiness } = createLoader()("src/work/startReadiness.ts");
for (const [hasLocation, hasProject, missing] of [[false, false, "both"], [false, true, "location"], [true, false, "project"], [true, true, null]]) test(`readiness ${hasLocation} ${hasProject}`, () => {
  const result = startReadiness({ hasLocation, hasProject });
  assert.equal(result.ready, missing === null);
  assert.equal(result.missing, missing);
});
const { formatIdleClock, formatWorkedClock, formatLocationRow, workedSecondsToday } = createLoader()("src/work/todayDisplay.ts");
test("idle clock is local time and worked clock includes seconds", () => {
  assert.deepEqual(formatIdleClock(new Date(2026, 9, 29, 8, 45)), { time: "8:45", period: "AM" });
  assert.equal(formatWorkedClock(13335), "3:42:15");
  assert.equal(formatWorkedClock(0), "0:00:00");
});
test("location rows use address or friendly saved fallback", () => {
  const fix = { source: "gps", address: null, accuracy: 8, locatedAt: new Date(2026, 9, 29, 7, 58).toISOString() };
  const idle = { working: false, locating: false, locationOff: false };
  assert.deepEqual(formatLocationRow(fix, idle), { title: "Location saved", subtitle: "±8 m · 7:58 AM" });
  assert.equal(formatLocationRow({ ...fix, address: "Bayfront Ave" }, idle).subtitle, "Tap to update · ±8 m");
  assert.equal(formatLocationRow(fix, { ...idle, working: true }).subtitle, "Saved at 7:58 AM");
  assert.equal(formatLocationRow(null, { ...idle, locationOff: true }).subtitle, "Location is off · Open settings");
  assert.doesNotMatch(source("src/work/locationEvidence.ts"), /GPS point/);
});
test("Today has a neutral pill, large clock and single round action", () => {
  const home = source("src/screens/HomeScreen.tsx");
  assert.match(home, /Working · since/);
  assert.match(home, /Not clocked in/);
  assert.match(home, /isRunning \? formatWorkedClock\(workedSeconds\) : idleClock.time/);
  assert.match(home, /"Clock out" : "Clock in"/);
  assert.doesNotMatch(home, /styles.card|styles.clockPanel|styles.metricValue|theme.colors.primary|worker note|Recent time/);
  assert.match(home, /trialDaysLeft > 0 && trialDaysLeft <= 3/);
  const styles = source("src/styles.ts");
  assert.match(styles, /todayClock: \{[^\n]*today.clock/);
  assert.match(styles, /todayRoundButton: \{[^\n]*width: 176, height: 176/);
  const today = styles.slice(styles.indexOf("  todayScreen:"), styles.indexOf("  todayBottomAction:"));
  assert.equal((today.match(/theme.colors.primary\b/g) || []).length, 2);
});
test("Clock in directs missing requirements to GPS or the picker", () => {
  const home = source("src/screens/HomeScreen.tsx");
  const handler = home.slice(home.indexOf("async function handleClockIn"), home.indexOf("async function handleLocateMe"));
  assert.match(handler, /readiness.missing === "location" \|\| readiness.missing === "both"/);
  assert.match(handler, /await handleLocateMe\(\)/);
  assert.match(handler, /readiness.missing === "project"\) \{ setProjectPickerOpen\(true\)/);
  assert.match(home, /pendingLocations.current.push\(fix\)/);
  assert.match(home, /store.refreshLocation\(params\)/);
  assert.match(home, /Linking.openSettings\(\)/);
});
test("both evidence rows lock during work with normal text and real icons", () => {
  const home = source("src/screens/HomeScreen.tsx");
  assert.match(home, /disabled=\{isRunning \|\| locating \|\| stopping\}/);
  assert.match(home, /accessibilityState=\{\{ disabled: isRunning \}\}/);
  assert.match(home, /Locked during shift/);
  for (const icon of ["pin", "briefcase", "lock"]) assert.ok(home.includes(`assets/icons/${icon}.png`));
  assert.equal((home.match(/!isRunning \? <Text style=\{styles.todayChevron\}/g) || []).length, 2);
});

test("today timer includes completed shifts and only today's part of an overnight shift", () => {
  const now = new Date(2026, 9, 29, 1, 0, 12);
  assert.equal(workedSecondsToday(30, new Date(2026, 9, 28, 23), now), 5412);
  assert.equal(workedSecondsToday(30, null, now), 1800);
});
