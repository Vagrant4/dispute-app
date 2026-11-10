const test = require("node:test");
const assert = require("node:assert/strict");
const { source } = require("./locationTestHelpers");

test("Today replaces the responsive clock circle with a fixed 56dp full-width action", () => {
  const home = source("src/screens/HomeScreen.tsx");
  const styles = source("src/styles.ts");
  assert.doesNotMatch(home, /getTodayClockLayout|todayButtonFrame|todayHalo|todayRoundButton/);
  assert.doesNotMatch(styles, /todayButtonFrame|todayHalo|todayRoundButton|todayStopHalo/);
  assert.match(styles, /todayClockButton:\s*\{[^\n]*height: todayLayout\.clockButtonHeight[^\n]*width: "100%"/);
  assert.match(home, /accessibilityLabel=\{isRunning \? "Clock out" : "Clock in"\}/);
  assert.match(home, />\{isRunning \? "Clock out" : "Clock in"\}<\/Text>/);
});

test("Today reserves a sensible flexible map at compact phone sizes", () => {
  const tokens = source("src/theme/tokens.ts");
  const styles = source("src/styles.ts");
  assert.match(tokens, /mapMinHeight:\s*160/);
  assert.match(styles, /locationMapFrame:\s*\{[^\n]*flex:\s*1[^\n]*minHeight:\s*todayLayout\.mapMinHeight/);
  assert.match(styles, /todayScreen:\s*\{[^\n]*flex:\s*1/);
});
