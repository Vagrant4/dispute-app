const assert = require("node:assert/strict");
const test = require("node:test");
const { source, createLoader } = require("./locationTestHelpers");
const { startReadiness } = createLoader()("src/work/startReadiness.ts");
for (const [hasLocation, hasProject, missing] of [[false, false, "both"], [false, true, "location"], [true, false, "project"], [true, true, null]]) test(`readiness ${hasLocation} ${hasProject}`, () => {
  const result = startReadiness({ hasLocation, hasProject });
  assert.equal(result.ready, missing === null);
  assert.equal(result.missing, missing);
});
const { shortAddress, formatIdleClock, formatWorkedClock, formatLocationRow, workedSecondsToday, formatCoordinateLabel } = createLoader()("src/work/todayDisplay.ts");
test("idle clock is local time and worked clock includes seconds", () => {
  assert.deepEqual(formatIdleClock(new Date(2026, 9, 29, 8, 45)), { time: "8:45", period: "AM" });
  assert.equal(formatWorkedClock(13335), "3:42:15");
  assert.equal(formatWorkedClock(0), "0:00:00");
});
test("location rows use address or friendly saved fallback", () => {
  const fix = { source: "gps", address: null, accuracy: 8, locatedAt: new Date(2026, 9, 29, 7, 58).toISOString() };
  const idle = { working: false, locating: false, locationOff: false };
  assert.deepEqual(formatLocationRow(fix, idle), { title: "Location saved", subtitle: "Saved at 7:58 AM" });
  assert.equal(formatLocationRow({ ...fix, address: "Bayfront Ave" }, idle).subtitle, "Tap to update location");
  assert.equal(formatLocationRow(fix, { ...idle, working: true }).subtitle, "Saved at 7:58 AM");
  assert.equal(formatLocationRow(null, { ...idle, locationOff: true }).subtitle, "Location is off · Open settings");
  assert.doesNotMatch(source("src/work/locationEvidence.ts"), /GPS point/);
});
test("Today limits lime to the working pill, wordmark and round action", () => {
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
  const limeStyles = today.split(/\r?\n/).filter((line) => /theme.colors.primary\b/.test(line)).map((line) => line.trim().split(":")[0]);
  assert.deepEqual(limeStyles, ["todayWordmark", "todayStatusDotWorking", "todayStatusTextWorking", "todayRoundButton"]);
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
test("project evidence row locks during work and standalone location chrome is removed", () => {
  const home = source("src/screens/HomeScreen.tsx");
  assert.match(home, /accessibilityState=\{\{ disabled: isRunning \}\}/);
  assert.match(home, /Locked during shift/);
  for (const icon of ["briefcase", "lock"]) assert.ok(home.includes(`assets/icons/${icon}.png`));
  assert.doesNotMatch(home, /assets\/icons\/pin\.png|accessibilityLabel="Get location"|formatLocationRow/);
  assert.equal((home.match(/!isRunning \? <Text style=\{styles.todayChevron\}/g) || []).length, 1);
});

test("today timer includes completed shifts and only today's part of an overnight shift", () => {
  const now = new Date(2026, 9, 29, 1, 0, 12);
  assert.equal(workedSecondsToday(30, new Date(2026, 9, 28, 23), now), 5412);
  assert.equal(workedSecondsToday(30, null, now), 1800);
});

test("App hides the shared header on Today and Settings and keeps the top safe area", () => {
  const app = source("App.tsx");
  assert.match(app, /const showHeader = account \? activeTab !== "home" && activeTab !== "settings" : authMode !== "logo";/);
  assert.match(app, /\{showHeader \? \(/);
  assert.match(app, /<SafeAreaView style=\{styles.app\} edges=\{account \? \["top", "left", "right"\]/);
});
test("shortAddress uses geocode street line and area without changing the full address", () => {
  const reading = { address: "Full saved address, Singapore, 018956", addressParts: { name: "12 Bayfront Ave", streetNumber: "12", street: "Bayfront Ave", district: "Marina Bay", city: "Singapore" } };
  assert.equal(shortAddress(reading), "12 Bayfront Ave, Marina Bay");
  assert.equal(shortAddress({ addressParts: { streetNumber: "12", street: "Bayfront Ave", city: "Marina Bay" } }), "12 Bayfront Ave, Marina Bay");
  assert.equal(reading.address, "Full saved address, Singapore, 018956");
  assert.equal(formatLocationRow({ ...reading, source: "gps" }, { working: false }).title, "12 Bayfront Ave, Marina Bay");
});
test("shortAddress uses the first two distinct joined parts for older readings", () => {
  assert.equal(shortAddress({ address: "12 Bayfront Ave, 12 Bayfront Ave, Marina Bay, Singapore, 018956" }), "12 Bayfront Ave, Marina Bay");
});
test("shortAddress returns null for empty readings so the row uses Location saved", () => {
  for (const reading of [null, {}, { address: " , , " }, { addressParts: {} }]) assert.equal(shortAddress(reading), null);
  assert.equal(formatLocationRow({ source: "gps", address: " , " }, { working: false }).title, "Location saved");
});

test("working pill uses lime while idle stays neutral", () => {
  const styles = source("src/styles.ts");
  const home = source("src/screens/HomeScreen.tsx");
  assert.match(styles, /primaryHalo: "#1B2410"/);
  assert.match(styles, /todayStatusWorking: \{ backgroundColor: theme.colors.primaryHalo/);
  assert.match(styles, /todayStatusDotWorking: \{ backgroundColor: theme.colors.primary/);
  assert.match(styles, /todayStatusTextWorking: \{ color: theme.colors.primary/);
  for (const key of ["todayStatus", "todayStatusDot", "todayStatusText"]) {
    assert.doesNotMatch(styles.match(new RegExp(key + ": \\{[^\\n]*"))[0], /theme.colors.primary/);
    assert.ok(home.includes("isRunning && styles." + key + "Working"));
  }
});
test("round action keeps a fixed frame and full touch target", () => {
  const styles = source("src/styles.ts");
  const home = source("src/screens/HomeScreen.tsx");
  assert.match(styles, /todayButtonFrame: \{[^\n]*width: 200, height: 200[^\n]*alignItems: "center", justifyContent: "center"/);
  assert.match(styles, /todayRoundButton: \{ width: 176, height: 176/);
  assert.match(styles, /todayStopButton: \{ width: 160, height: 160/);
  assert.match(styles, /todayHalo: \{ padding: today.halo/);
  assert.match(source("src/theme/tokens.ts"), /halo: 12/);
  assert.match(home, /hitSlop=\{isRunning \? 8 : 0\}/);
  assert.match(home, /style=\{styles.todayButtonFrame\}/);
});
test("tabs use PNG line icons with lime active icons and normal active labels", () => {
  const app = source("App.tsx");
  const styles = source("src/styles.ts");
  for (const name of ["today", "photos", "projects", "settings"]) assert.ok(app.includes('require("./assets/icons/tab-' + name + '.png")'));
  assert.match(app, /<Image accessible=\{false\} source=\{tabIcons\[tab.id\]\}/);
  assert.doesNotMatch(app, /[◷▦▤≡]/);
  assert.match(app, /accessibilityRole="tab"/);
  assert.match(app, /accessibilityState=\{\{ selected \}\}/);
  assert.match(styles, /bottomTabIcon: \{ width: 24, height: 24, tintColor: theme.colors.placeholder/);
  assert.match(styles, /bottomTabIconActive: \{ tintColor: theme.colors.primary/);
  assert.match(styles, /bottomTabActive: \{ color: theme.colors.text/);
  assert.match(styles, /bottomTabLabel: \{ color: theme.colors.placeholder, \.\.\.type.tabLabel/);
  assert.match(styles, /bottomTabItem: \{[^\n]*gap: space.xs/);
  assert.match(styles, /bottomTabBar: \{[^\n]*borderTopWidth: 1, borderTopColor: theme.colors.border/);
  const tabStyles = styles.slice(styles.indexOf("  bottomTabBar:"), styles.indexOf("  tabScroller:"));
  assert.equal((tabStyles.match(/theme.colors.primary\b/g) || []).length, 1);
});

test("shortAddress rejects bare house-number + country labels like 377, Singapore", () => {
  assert.equal(shortAddress({ addressParts: { name: "377", city: "Singapore" } }), null);
  assert.equal(shortAddress({ addressParts: { streetNumber: "377", city: "Singapore" } }), null);
  assert.equal(shortAddress({ address: "377, Singapore" }), null);
  assert.equal(shortAddress({ addressParts: { name: "377", street: "Orchard Road", city: "Singapore" } }), "377 Orchard Road, Singapore");
  assert.equal(formatCoordinateLabel(1.2945, 103.852), "1.29° N, 103.85° E");
  assert.equal(
    formatLocationRow(
      { source: "gps", address: null, addressParts: { name: "377", city: "Singapore" }, latitude: 1.2945, longitude: 103.852, accuracy: 17, locatedAt: new Date(2026, 10, 6, 0, 40).toISOString() },
      { working: false, locating: false, locationOff: false },
    ).title,
    "1.29° N, 103.85° E",
  );
});

test("Today embeds the fixed-pin map without a separate map screen", () => {
  const home = source("src/screens/HomeScreen.tsx");
  const nativeMap = source("src/screens/LocationMap.native.tsx");
  assert.match(home, /testID="today-map"/);
  assert.match(nativeMap, /showDetails[\s\S]*\{showDetails && hasFix \? <View style=\{styles\.locationMapDetails\}>/);
  assert.match(nativeMap, /1\.3521/);
  assert.match(nativeMap, /103\.8198/);
  assert.match(nativeMap, /PROVIDER_GOOGLE/);
  assert.match(nativeMap, /MAP_ZOOM = 16/);
  assert.doesNotMatch(nativeMap, /No GPS reading yet\. Tap the crosshair\./);
  assert.doesNotMatch(home, /View on map|setLocationMapOpen/);
  assert.doesNotMatch(nativeMap, /openDeviceMaps|Open in Maps/);
  assert.match(nativeMap, /GPS pin is fixed/);
  assert.match(nativeMap, /from "react-native-maps"/);
  assert.match(nativeMap, /<MapView/);
});

test("Today keeps the address hidden until the locate crosshair requests Android geocoding", () => {
  const home = source("src/screens/HomeScreen.tsx");
  const location = source("src/work/workLocation.ts");
  assert.match(home, /handleLocateMe\(false/);
  assert.match(home, /getWorkLocationWithTimeout\(20_000, \{ geocode: revealDetails \}\)/);
  assert.match(location, /reverseGeocodeAddress/);
  assert.match(location, /Location\.reverseGeocodeAsync/);
  assert.doesNotMatch(location, /maps\.googleapis\.com\/maps\/api\/geocode\/json/);
});

test("App restores the signed-in session from SecureStore on cold start", () => {
  const app = source("App.tsx");
  const storage = source("src/auth/localAuthStorageExpo.ts");
  assert.match(storage, /ACTIVE_SESSION_KEY/);
  assert.match(storage, /saveActiveSession/);
  assert.match(storage, /loadActiveSession/);
  assert.match(storage, /clearActiveSession/);
  assert.match(app, /loadActiveSession\(\)/);
  assert.match(app, /saveActiveSession\(next\)/);
  assert.match(app, /clearActiveSession\(\)/);
  assert.match(app, /authReady/);
  assert.match(app, /establishAccount/);
});
