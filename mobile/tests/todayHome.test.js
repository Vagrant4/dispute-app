const assert = require("node:assert/strict");
const test = require("node:test");
const { source, createLoader } = require("./locationTestHelpers");
const { startReadiness } = createLoader()("src/work/startReadiness.ts");
for (const [hasLocation, hasProject, enabled, hint] of [
  [false, false, false, "Add location and project to start"],
  [false, true, false, "Add your location to start"],
  [true, false, false, "Choose a project to start"],
  [true, true, true, null],
]) test(`start readiness: location ${hasLocation}, project ${hasProject}`, () => {
  assert.deepEqual(startReadiness({ hasLocation, hasProject }), { enabled, hint });
});
test("Start and Stop share the pinned bottom container with accessible disabled styles", () => {
  const home = source("src/screens/HomeScreen.tsx");
  const bottom = home.slice(home.indexOf('<View style={styles.todayBottomAction}>'));
  assert.match(bottom, /handleClockOut\(\) : handleClockIn\(\)/);
  assert.match(bottom, /"Stop work" : "Start work"/);
  assert.match(bottom, /accessibilityState=\{\{ disabled: startDisabled \}\}/);
  assert.match(home, /const startDisabled = !isRunning &&/);
  assert.match(bottom, /styles.disabledButtonText/);
  assert.match(source("src/styles.ts"), /todayBottomAction: \{ marginTop: "auto"/);
});
test("whole location row requests GPS before a shift and refresh appends existing evidence", () => {
  const home = source("src/screens/HomeScreen.tsx");
  assert.match(home, /accessibilityLabel="Get location"[^\n]*onPress=\{\(\) => void handleLocateMe\(\)\}/);
  assert.match(home, /Tap for location/);
  const locate = home.slice(home.indexOf("async function handleLocateMe"), home.indexOf("async function handleClockOut"));
  assert.match(locate, /getWorkLocationWithTimeout\(20_000\)/);
  assert.match(locate, /store.refreshLocation\(params\)/);
  assert.match(locate, /pendingLocations.current.push\(fix\)/);
  assert.match(home, /for \(const fix of pendingLocations.current\)/);
  assert.match(home, /Linking.openSettings\(\)/);
  assert.doesNotMatch(home, /TextInput|detailsExpanded|DAY_TYPE_OPTIONS|>Details|Free trial ·/);
  assert.match(home, /trialDaysLeft > 0 && trialDaysLeft <= 3/);
  assert.match(home, /activeProjects.length === 1 \? activeProjects\[0\].id : null/);
  assert.match(source("src/styles.ts"), /todayLocationRow: \{ minHeight: control.height/);
});
