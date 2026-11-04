const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTsModule(relativePath, overrides = {}, cache = new Map()) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (cache.has(normalized)) return cache.get(normalized).exports;
  const source = readFileSync(path.join(__dirname, "..", normalized), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  cache.set(normalized, module);
  const localRequire = (request) => {
    if (overrides[request]) return overrides[request];
    if (request.startsWith(".")) return loadTsModule(path.join(path.dirname(normalized), `${request}.ts`), overrides, cache);
    return require(request);
  };
  new Function("exports", "module", "require", compiled)(module.exports, module, localRequire);
  return module.exports;
}

function migratedSettingsDatabase() {
  const row = {
    id: "settings:local-user", user_id: "acct-1", currency: "SGD", rate_basis: "daily",
    base_rate_cents: 0, daily_hours: 8, weekly_hours: 44, normal_work_start_time: "08:00",
    normal_work_end_time: "17:00", overtime_multiplier: 1.5, off_day_multiplier: 2,
    holiday_multiplier: 2, status: "active", lock_hash: null, locked_at: null,
  };
  return {
    row,
    async runAsync(sql, params) {
      if (/INSERT OR IGNORE/i.test(sql)) return;
      if (/UPDATE app_settings/i.test(sql) && params.at(-1) === row.user_id && params.at(-2) === row.id) {
        [row.currency, row.rate_basis, row.base_rate_cents, row.daily_hours, row.weekly_hours,
          row.normal_work_start_time, row.normal_work_end_time, row.overtime_multiplier,
          row.off_day_multiplier, row.holiday_multiplier] = params;
      }
    },
    async getFirstAsync(sql, params) {
      return /FROM app_settings WHERE user_id = \?/i.test(sql) && params[0] === row.user_id ? { ...row } : null;
    },
  };
}

test("settings repository heals a claimed row whose legacy id was retained", async () => {
  const { SettingsRepository } = loadTsModule("src/db/settingsRepository.ts");
  const database = migratedSettingsDatabase();
  const repository = new SettingsRepository(database);
  assert.equal((await repository.getSettings("acct-1")).id, "settings:local-user");
  const updated = await repository.updateSettings({
    rateBasis: "daily", baseRateCents: 15000, normalWorkStartTime: "08:00",
    normalWorkEndTime: "17:00", dailyHours: 9, weeklyHours: 44,
    overtimeMultiplier: 1.5, offDayMultiplier: 2, holidayMultiplier: 2,
  }, "acct-1");
  assert.equal(updated.baseRateCents, 15000);
  assert.equal(database.row.base_rate_cents, 15000);
});

test("legacy ownership claim rewrites the settings id for the account", async () => {
  const { claimLegacyLocalDataForUser } = loadTsModule("src/db/localDataOwnership.ts");
  const updates = [];
  const database = {
    async execAsync() {},
    async getFirstAsync(sql, params) {
      const table = /FROM ([a-z_]+)/.exec(sql)?.[1];
      return { count: table === "time_entries" && params[0] === "local-user" ? 1 : 0 };
    },
    async runAsync(sql, params) { updates.push({ sql, params }); },
  };
  assert.equal(await claimLegacyLocalDataForUser(database, "acct-1"), true);
  assert.deepEqual(updates.find(({ sql }) => sql.startsWith("UPDATE app_settings ")), {
    sql: "UPDATE app_settings SET id = ?, user_id = ? WHERE user_id = ?",
    params: ["settings:acct-1", "acct-1", "local-user"],
  });
});
