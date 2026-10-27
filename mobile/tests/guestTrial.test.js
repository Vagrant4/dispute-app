const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function load(file, stubs = {}) {
  const source = readFileSync(path.join(__dirname, "..", "src", ...file.split("/")), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", "require", "process", compiled)(module.exports, module, (name) => stubs[name] || require(name), process);
  return module.exports;
}

const trial = load("subscription/guestTrial.ts", { "expo-secure-store": {} });

test("guest trial counts thirty rolling days", () => {
  const start = Date.UTC(2026, 0, 1);
  const state = trial.startGuestTrial(start);
  assert.equal(trial.guestTrialStatus(state, start).daysLeft, 30);
  assert.equal(trial.guestTrialStatus(state, start + 29.5 * 86400000).daysLeft, 1);
  assert.equal(trial.guestTrialStatus(state, start + 30 * 86400000).expired, true);
});

test("clock rollback cannot extend trial and start never moves later", () => {
  const start = Date.UTC(2026, 0, 1);
  const observed = trial.observeClock(trial.startGuestTrial(start), start + 20 * 86400000);
  assert.equal(trial.guestTrialStatus(observed, start + 10 * 86400000).daysLeft, 10);
  assert.equal(trial.startGuestTrial(start + 5, observed).firstUseAt, start);
});

test("day 31 entitlement gates mutations and exports but keeps basic data", () => {
  const start = Date.UTC(2026, 0, 1);
  const entitlement = trial.buildGuestEntitlement(trial.startGuestTrial(start), start + 30 * 86400000);
  assert.equal(entitlement.canCreateRecords, false);
  assert.equal(entitlement.canExportReports, false);
  assert.equal(entitlement.canExportBasicData, true);
});

test("trial debug override defaults off", () => {
  const previous = process.env.EXPO_PUBLIC_TRIAL_DEBUG_OVERRIDE;
  delete process.env.EXPO_PUBLIC_TRIAL_DEBUG_OVERRIDE;
  assert.equal(trial.isTrialDebugOverrideEnabled(), false);
  if (previous !== undefined) process.env.EXPO_PUBLIC_TRIAL_DEBUG_OVERRIDE = previous;
});

test("clock-out and record viewing remain available after expiry", () => {
  const access = load("subscription/recordAccess.ts");
  const entitlement = trial.buildGuestEntitlement(trial.startGuestTrial(0), 31 * 86400000);
  assert.equal(access.canClockOut(true), true);
  assert.deepEqual(access.getRecordAccess(entitlement), { canView: true, canCreate: false, canExport: false });
});
