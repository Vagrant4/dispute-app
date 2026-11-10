const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobile = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(mobile, name), "utf8");

test("Today renders project, clock, map in a one-line reorderable sequence", () => {
  const home = read("src/screens/HomeScreen.tsx");
  assert.match(home, /TODAY_SECTIONS\s*=\s*\["project",\s*"clock",\s*"map"\]\s*as const/);
  assert.match(home, /TODAY_SECTIONS\.map/);
  assert.match(home, /project:\s*renderProjectSection/);
  assert.match(home, /clock:\s*renderClockSection/);
  assert.match(home, /map:\s*renderMapSection/);
  for (const id of ["today-project-section", "today-add-project", "today-clock-section", "today-map"]) assert.ok(home.includes(`testID="${id}"`));
  assert.doesNotMatch(home, /todayButtonFrame|todayHalo|todayRoundButton|getTodayClockLayout/);
});

test("Today button and project row meet geometry and clean-edge requirements", () => {
  const styles = read("src/styles.ts");
  const clock = styles.match(/todayClockButton:\s*\{([^\n]+)\}/)?.[1] ?? "";
  const row = styles.match(/todayEvidenceRow:\s*\{([^\n]+)\}/)?.[1] ?? "";
  const add = styles.match(/todayAddProjectButton:\s*\{([^\n]+)\}/)?.[1] ?? "";
  assert.match(clock, /height:\s*todayLayout\.clockButtonHeight/);
  assert.match(clock, /width:\s*"100%"/);
  assert.doesNotMatch(row, /borderTopWidth|borderBottomWidth/);
  assert.match(add, /minHeight:\s*todayLayout\.minimumTouchTarget/);
  assert.doesNotMatch(add, /borderWidth|borderColor/);
});

test("Today map fills remaining edge-to-edge space with inset controls", () => {
  const styles = read("src/styles.ts");
  const map = read("src/screens/LocationMap.native.tsx");
  const frame = styles.match(/locationMapFrame:\s*\{([^\n]+)\}/)?.[1] ?? "";
  const locate = styles.match(/locationMapLocateButton:\s*\{([^\n]+)\}/)?.[1] ?? "";
  assert.match(frame, /flex:\s*1/);
  assert.doesNotMatch(frame, /borderWidth|borderRadius/);
  assert.match(locate, /height:\s*todayLayout\.minimumTouchTarget/);
  assert.match(locate, /width:\s*todayLayout\.minimumTouchTarget/);
  assert.match(locate, /right:\s*todayLayout\.mapInset/);
  assert.match(locate, /top:\s*todayLayout\.mapInset/);
  assert.match(map, /toolbarEnabled=\{false\}/);
  assert.match(map, /mapPadding=\{\{[^}]*bottom:\s*todayLayout\.mapPaddingBottom/);
});

test("address is a two-line overlay chip shown only after crosshair detail reveal", () => {
  const map = read("src/screens/LocationMap.native.tsx");
  assert.match(map, /showDetails && hasFix \? <View style=\{styles\.todayAddressChip\} testID="today-address-chip">/);
  assert.match(map, /numberOfLines=\{2\}/);
  assert.doesNotMatch(map, /locationMapDetails/);
  assert.doesNotMatch(map, /View on map|Open in Maps|[±]\$\{|formatCoordinateLabel/);
});

test("Today layout dimensions use the shared 8dp grid", () => {
  const tokens = read("src/theme/tokens.ts");
  const block = tokens.match(/export const todayLayout = \{([\s\S]*?)\} as const/)?.[1] ?? "";
  const values = [...block.matchAll(/:\s*(-?\d+)/g)].map((match) => Number(match[1]));
  assert.ok(values.length >= 8);
  for (const value of values) assert.equal(Math.abs(value) % 8, 0, `${value} is off the 8dp grid`);
});
