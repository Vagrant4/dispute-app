const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function load(relativePath) {
  const source = readFileSync(path.join(__dirname, "..", relativePath), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", compiled)(module.exports, module);
  return module.exports;
}

test("own pay rate converts daily, monthly and hourly bases and rejects unset or invalid hours", () => {
  const { ownRateToHourlyCents } = load("src/work/ownRateConversion.ts");
  assert.equal(ownRateToHourlyCents({ rateBasis: "hourly", baseRateCents: 2500, dailyHours: 8, weeklyHours: 40 }), 2500);
  assert.equal(ownRateToHourlyCents({ rateBasis: "daily", baseRateCents: 20000, dailyHours: 8, weeklyHours: 40 }), 2500);
  assert.equal(ownRateToHourlyCents({ rateBasis: "monthly", baseRateCents: 520000, dailyHours: 8, weeklyHours: 40 }), 3000);
  assert.equal(ownRateToHourlyCents({ rateBasis: "daily", baseRateCents: 20000, dailyHours: 0, weeklyHours: 40 }), 0);
  assert.equal(ownRateToHourlyCents({ rateBasis: "monthly", baseRateCents: 520000, dailyHours: 8, weeklyHours: 0 }), 0);
  assert.equal(ownRateToHourlyCents({ rateBasis: "hourly", baseRateCents: 0, dailyHours: 8, weeklyHours: 40 }), 0);
});

test("Settings pay rate owns only the user's rate and waits for explicit Save", () => {
  const source = readFileSync(path.join(__dirname, "..", "src/screens/SettingsScreen.tsx"), "utf8");
  assert.doesNotMatch(source, /ProjectPickerSheet|rateProjectId|handleSaveProjectRate|Project hourly rate/);
  assert.match(source, /testID="pay-rate-own-rate"/);
  for (const label of ["Daily", "Monthly", "Hourly", "Daily rate", "Monthly rate", "Hourly rate"]) assert.match(source, new RegExp(label));
  assert.doesNotMatch(source, /onBlur=\{\(\) => void handleSaveWorkHours\(\)\}/);
  assert.doesNotMatch(source, /setTimeout\(\(\) => void handleSaveWorkHours\(\), 600\)/);
  assert.match(source, /testID="settings-pay-rate-save"/);
  assert.match(source, /disabled=\{!isPayRateDirty\(\)\}/);
  assert.match(source, />Save<\/Text>/);
});
