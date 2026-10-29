const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../src/work/defaultDayType.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function("exports", "module", compiled)(loaded.exports, loaded);
const { defaultDayType } = loaded.exports;

test("Singapore day defaults cover Sundays, holidays, substitute days and weekdays", () => {
  for (const [date, expected] of [
    ["2026-10-25", "off_day"], ["2027-01-01", "holiday"], ["2026-10-29", "normal"],
    ["2026-06-01", "holiday"], ["2026-08-10", "holiday"], ["2026-11-09", "holiday"],
    ["2027-02-08", "holiday"], ["2027-10-28", "holiday"], ["2026-08-09", "off_day"],
  ]) assert.equal(defaultDayType(new Date(`${date}T12:00:00+08:00`)), expected, date);
  assert.equal(defaultDayType(new Date("2026-12-31T17:00:00Z")), "holiday");
  assert.match(source, /update yearly/);
});

test("Today has one Start/Stop toggle, automatic day type and profile details live in Settings", () => {
  const home = fs.readFileSync(path.join(__dirname, "../src/screens/HomeScreen.tsx"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "../App.tsx"), "utf8");
  const profile = fs.readFileSync(path.join(__dirname, "../src/screens/ProfileSettingsPanel.tsx"), "utf8");
  assert.equal((home.match(/"Stop work" : "Start work"/g) || []).length, 1);
  assert.match(home, /"Working" : "Not started"/);
  assert.doesNotMatch(home, /styles.dayTypeRow/);
  assert.match(home, /useState<WorkDayType>\(\(\) => defaultDayType\(new Date\(\)\)\)/);
  assert.match(home, /setDayType\(defaultDayType\(nextClockOut\)\)/);
  assert.doesNotMatch(home, /Use Existing Phone Records|Loading local work records|Local work records are ready/);
  assert.doesNotMatch(app, /Signed in as|Email verified|On this phone · no account yet/);
  assert.match(profile, /Signed in as/);
  assert.match(profile, /Email verified/);
});
