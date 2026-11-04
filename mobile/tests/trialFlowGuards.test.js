const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const src = (rel) => readFileSync(path.join(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");
function load(rel, stubs = {}) {
  const compiled = ts.transpileModule(src(rel), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => (request in stubs ? stubs[request] : require(request));
  new Function("exports", "module", "require", "process", compiled)(module.exports, module, localRequire, process);
  return module.exports;
}
const DAY = 86400000;
const trial = load("src/subscription/guestTrial.ts", { "expo-secure-store": {} });
const access = load("src/subscription/recordAccess.ts");

function memoryStorage() {
  const map = new Map();
  return {
    map,
    async getItemAsync(k) { return map.has(k) ? map.get(k) : null; },
    async setItemAsync(k, v) { map.set(k, v); },
  };
}

test("trial day count: day 1 shows 30 days left, day 30 shows 1, day 31 is expired", () => {
  const start = Date.UTC(2026, 9, 27, 1);
  const s = trial.startGuestTrial(start);
  assert.equal(trial.guestTrialStatus(s, start).daysLeft, 30);
  assert.equal(trial.guestTrialStatus(s, start).daysUsed, 1);
  assert.equal(trial.guestTrialStatus(s, start + 29 * DAY + 1).daysLeft, 1);
  assert.equal(trial.guestTrialStatus(s, start + 29 * DAY + 1).expired, false);
  assert.equal(trial.guestTrialStatus(s, start + 30 * DAY).expired, true);
  assert.equal(trial.guestTrialStatus(s, start + 30 * DAY).daysLeft, 0);
});

test("clock rollback through persisted storage gains no time", async () => {
  const storage = memoryStorage();
  const start = Date.UTC(2026, 9, 1);
  await trial.saveGuestTrial(trial.startGuestTrial(start), storage);
  // Day 20: app observed the real clock.
  let s = trial.observeClock(await trial.loadGuestTrial(storage), start + 20 * DAY);
  await trial.saveGuestTrial(s, storage);
  assert.equal(trial.guestTrialStatus(s, start + 20 * DAY).daysLeft, 10);
  // User turns the phone clock back 15 days.
  const rolledBack = start + 5 * DAY;
  s = trial.observeClock(await trial.loadGuestTrial(storage), rolledBack);
  assert.equal(trial.guestTrialStatus(s, rolledBack).daysLeft, 10);
  // Clock set before the trial start: still no gain, and start never moves later.
  const restarted = trial.startGuestTrial(start + 20 * DAY, s);
  assert.equal(restarted.firstUseAt, start);
  assert.equal(trial.guestTrialStatus(restarted, start - 3 * DAY).daysLeft, 10);
  // At the real day 31 (or the high-water mark beyond it) the trial is over.
  s = trial.observeClock(s, start + 31 * DAY);
  assert.equal(trial.guestTrialStatus(s, start).expired, true);
});

test("day-31 gating: guest entitlement blocks new records and exports, keeps basic data", () => {
  const s = trial.startGuestTrial(0);
  const day30 = trial.buildGuestEntitlement(s, 29 * DAY);
  assert.equal(day30.status, "TRIALING");
  assert.equal(day30.canCreateRecords, true);
  assert.equal(day30.canExportReports, true);
  const day31 = trial.buildGuestEntitlement(s, 30 * DAY + 1);
  assert.equal(day31.status, "EXPIRED");
  assert.equal(day31.canCreateRecords, false);
  assert.equal(day31.canExportReports, false);
  assert.equal(day31.canExportBasicData, true);
});

test("records stay viewable for every entitlement state", () => {
  for (const status of ["TRIALING", "ACTIVE", "EXPIRED", "CANCELED", "PAST_DUE", "NONE"]) {
    assert.equal(access.getRecordAccess({ status, canCreateRecords: false, canExportReports: false }).canView, true);
  }
  assert.equal(access.getRecordAccess(null).canView, true);
});

test("mid-shift exemption: TIME OUT has no entitlement check and stays enabled during an open shift", () => {
  const home = src("src/screens/HomeScreen.tsx");
  const start = home.indexOf("async function handleClockOut()");
  const end = home.indexOf("\n  }\n", start);
  const body = home.slice(start, end);
  assert.ok(start > 0);
  assert.doesNotMatch(body, /access\.|hasCurrentCreateAccess|canCreateRecords/);
  assert.match(home, /const startDisabled = isRunning \? stopping : !access.canCreateRecords/);
  assert.match(home, /disabled=\{startDisabled\}/);
  assert.match(home, /isRunning \? handleClockOut\(\) : handleClockIn\(\)/);
  const repo = src("src/work/workRepository.ts");
  const clockOut = repo.slice(repo.indexOf("async clockOut("), repo.indexOf("async clockOut(") + 2500);
  assert.doesNotMatch(clockOut, /entitlement|subscription|canCreate/i);
});

test("migration on sign-up: verify and login from a guest claim local-user rows in place (no deletes)", async () => {
  const app = src("App.tsx");
  assert.equal((app.match(/claimLegacyLocalRepositoriesForUser\(/g) || []).length >= 2, true);
  const ownership = load("src/db/localDataOwnership.ts", { "./settingsValidation": { DEFAULT_USER_ID: "local-user" } });
  const statements = [];
  const db = {
    async execAsync(sql) { statements.push(sql); },
    async getFirstAsync(sql, params) {
      const table = /FROM ([a-z_]+)/.exec(sql)?.[1];
      const counts = { "time_entries:local-user": 5, "projects:local-user": 1, "photo_evidence:local-user": 2 };
      return { count: counts[`${table}:${params[0]}`] ?? 0 };
    },
    async getAllAsync() { return []; },
    async runAsync(sql, params) { statements.push(`${sql} ${JSON.stringify(params)}`); },
  };
  assert.equal(await ownership.claimLegacyLocalDataForUser(db, "flowtest-guest@example.com"), true);
  assert.ok(statements.some((s) => /UPDATE time_entries SET user_id/.test(s)));
  assert.ok(statements.some((s) => /UPDATE photo_evidence SET user_id/.test(s)));
  assert.equal(statements.some((s) => /DELETE/i.test(s)), false);
});

test("sign-up starts the local trial only after account creation succeeds", () => {
  const create = src("src/screens/CreateAccountScreen.tsx");
  const success = create.slice(create.indexOf("if (result.ok)"));
  assert.match(success, /saveGuestTrial\(startGuestTrial\(Date\.now\(\)\)\)/);
  assert.doesNotMatch(create.slice(create.indexOf("export function"), create.indexOf("if (result.ok)")), /startGuestTrial|saveGuestTrial/);
  assert.doesNotMatch(create, /firstUseAt:/);
  assert.doesNotMatch(create, /Confirm account password/);
});

test("signed-in settings has no guest-only trial clock panel", () => {
  assert.doesNotMatch(src("src/screens/SettingsScreen.tsx"), /Debug: trial clock|account\.isGuest/);
});

test("TIME OUT never re-prompts for location permission", () => {
  const home = src("src/screens/HomeScreen.tsx");
  const out = home.slice(home.indexOf("async function handleClockOut()"));
  assert.match(out, /getWorkLocationWithTimeout\(10_000, \{ prompt: false \}\)/);
  assert.match(src("src/work/workLocation.ts"), /getForegroundPermissionsAsync/);
});
