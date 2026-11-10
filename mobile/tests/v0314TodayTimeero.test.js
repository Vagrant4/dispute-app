const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobile = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(mobile, name), "utf8");

test("Today renders only the Timeero hierarchy in an ordered section array", () => {
  const home = read("src/screens/HomeScreen.tsx");
  assert.match(home, /TODAY_SECTIONS\s*=\s*\["timerCard",\s*"quickActions",\s*"map",\s*"clock"\]\s*as const/);
  assert.match(home, /TODAY_SECTIONS\.map/);
  for (const section of ["timerCard", "quickActions", "map", "clock"])
    assert.match(home, new RegExp(`${section}:\\s*render`));
  assert.doesNotMatch(home, /todayStatusDot|todayCaption|today-project-section|today-clock-section/);
});

test("timer card contains the timer, started state, and project row", () => {
  const home = read("src/screens/HomeScreen.tsx");
  for (const id of ["today-timer-card", "today-timer", "today-started", "today-add-project"])
    assert.ok(home.includes(`testID="${id}"`));
  assert.match(home, /isRunning \? formatWorkedClock\(workedSeconds\) : "00:00:00"/);
  assert.match(home, /isRunning && clockInAt \? `Started \$\{formatClockTime\(clockInAt\)\}` : "Not clocked in"/);
  assert.match(home, />Project<\/Text>/);
});

test("Today timer card and sections have spacing without divider lines", () => {
  const home = read("src/screens/HomeScreen.tsx");
  const styles = read("src/styles.ts");
  assert.doesNotMatch(home, /todayDivider/);
  assert.doesNotMatch(styles, /todayDivider\s*:/);
  for (const styleName of ["todayTimerCard", "todayProjectActions", "todayEvidenceRow", "todaySections"]) {
    const block = styles.match(new RegExp(`${styleName}:\\s*\\{([^\\n]+)\\}`))?.[1] ?? "";
    assert.ok(block, `${styleName} style must exist`);
    assert.doesNotMatch(block, /borderTopWidth|borderBottomWidth|hairlineWidth/);
  }
  const projectActions = styles.match(/todayProjectActions:\s*\{([^\n]+)\}/)?.[1] ?? "";
  assert.match(projectActions, /marginTop:\s*todayLayout\.cardPadding/);
  assert.match(styles, /todaySections:\s*\{[^\n]*gap:\s*todayLayout\.gap/);
  assert.match(styles, /todayQuickActions:\s*\{[^\n]*gap:\s*todayLayout\.gap/);
  assert.match(styles, /todayClockAction:\s*\{[^\n]*gap:\s*todayLayout\.gap/);
  assert.match(styles, /todayRunningControls:\s*\{[^\n]*gap:\s*todayLayout\.gap/);
});

test("Today has exactly one quick action and opens photos for the selected project", () => {
  const home = read("src/screens/HomeScreen.tsx");
  assert.equal((home.match(/testID="today-photo-action"/g) ?? []).length, 1);
  assert.match(home, /onOpenPhotos\?\.\(selectedProjectId \?\? undefined\)/);
  assert.match(home, /onOpenPhotos\?: \(projectId\?: string\) => void/);
  const app = read("App.tsx");
  assert.match(app, /<HomeScreen account=\{account\} onOpenPhotos=\{onSeePhotos\}/);
  assert.match(app, /setPhotoProjectId\(projectId\); setActiveTab\("evidence"\)/);
});

test("Today excludes unsupported controls and map detail text", () => {
  const home = read("src/screens/HomeScreen.tsx");
  const map = read("src/screens/LocationMap.native.tsx");
  const rendered = `${home}\n${map}`;
  for (const text of ["Daily sign offs", "Signature", "Geofence", "Chat", "Schedule", "View on map", "Open in Maps", "±", " m away", "miles", "km"])
    assert.ok(!rendered.includes(`> ${text} <`) && !rendered.includes(`>${text}<`) && !rendered.includes(`"${text}"`), `Today must not render ${text}`);
  assert.doesNotMatch(map, /formatCoordinateLabel|latitude\.toFixed|longitude\.toFixed/);
});

test("map is a flexible rounded card with inset controls and conditional address", () => {
  const styles = read("src/styles.ts");
  const map = read("src/screens/LocationMap.native.tsx");
  const frame = styles.match(/locationMapFrame:\s*\{([^\n]+)\}/)?.[1] ?? "";
  const locate = styles.match(/locationMapLocateButton:\s*\{([^\n]+)\}/)?.[1] ?? "";
  assert.match(frame, /flex:\s*1/);
  assert.match(frame, /borderRadius:\s*radius\.md/);
  assert.match(frame, /overflow:\s*"hidden"/);
  assert.doesNotMatch(frame, /borderWidth/);
  assert.match(locate, /height:\s*todayLayout\.minimumTouchTarget/);
  assert.match(locate, /width:\s*todayLayout\.minimumTouchTarget/);
  assert.match(map, /showDetails && hasFix \? <View style=\{styles\.todayAddressChip\} testID="today-address-chip">/);
  assert.match(map, /numberOfLines=\{2\}/);
  assert.match(styles, /locationMapContent:\s*\{[^\n]*gap:\s*todayLayout\.gap/);
  assert.match(map, /provider=\{PROVIDER_GOOGLE\}/);
  assert.match(map, /mapType="standard"/);
  assert.match(map, /toolbarEnabled=\{false\}/);
});

test("clock button is the last full-width 56dp action and supports Clock out", () => {
  const styles = read("src/styles.ts");
  const home = read("src/screens/HomeScreen.tsx");
  const clock = styles.match(/todayClockButton:\s*\{([^\n]+)\}/)?.[1] ?? "";
  assert.match(clock, /height:\s*todayLayout\.clockButtonHeight/);
  assert.match(clock, /width:\s*"100%"/);
  assert.match(home, /isRunning \? "Clock out" : "Clock in"/);
  assert.match(home, /TODAY_SECTIONS\s*=\s*\[[^\]]*"clock"\]\s*as const/);
});

test("Today dimensions stay on the 8dp grid, allowing only 4dp half-steps", () => {
  const tokens = read("src/theme/tokens.ts");
  const block = tokens.match(/export const todayLayout = \{([\s\S]*?)\} as const/)?.[1] ?? "";
  const values = [...block.matchAll(/:\s*(-?\d+)/g)].map((match) => Number(match[1]));
  assert.ok(values.length >= 12);
  for (const value of values) assert.equal(Math.abs(value) % 4, 0, `${value} is off the 4dp half-grid`);
});
