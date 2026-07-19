const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function createTsLoader() {
  const cache = new Map();

  function load(relativePath) {
    const normalized = relativePath.replaceAll("\\", "/");
    if (cache.has(normalized)) {
      return cache.get(normalized).exports;
    }

    const sourcePath = path.join(__dirname, "..", normalized);
    const source = readFileSync(sourcePath, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    const module = { exports: {} };
    cache.set(normalized, module);

    function localRequire(request) {
      if (request.startsWith(".")) {
        const nextPath = path
          .join(path.dirname(normalized), `${request}.ts`)
          .replaceAll("\\", "/");
        return load(nextPath);
      }
      return require(request);
    }

    new Function("exports", "module", "require", compiled)(
      module.exports,
      module,
      localRequire,
    );
    return module.exports;
  }

  return load;
}

function createFakeDatabase() {
  const rows = new Map();
  const calls = [];

  function toRow(settings) {
    return {
      id: settings.id,
      user_id: settings.userId,
      currency: settings.currency,
      daily_hours: settings.dailyHours,
      weekly_hours: settings.weeklyHours,
      normal_work_start_time: settings.normalWorkStartTime,
      normal_work_end_time: settings.normalWorkEndTime,
      overtime_multiplier: settings.overtimeMultiplier,
      off_day_multiplier: settings.offDayMultiplier,
      holiday_multiplier: settings.holidayMultiplier,
      status: settings.status,
      lock_hash: settings.lockHash,
      locked_at: settings.lockedAt,
    };
  }

  return {
    calls,
    rows,
    async execAsync(sql) {
      calls.push({ method: "execAsync", sql });
    },
    async getFirstAsync(sql, params = []) {
      calls.push({ method: "getFirstAsync", sql, params });
      if (/COUNT\(\*\).*app_settings/i.test(sql)) {
        return { count: rows.size };
      }
      if (/COUNT\(\*\).*generated_documents/i.test(sql)) {
        return { count: 0 };
      }
      const id = params[0];
      const userId = params[1];
      const row = rows.get(id);
      return row && row.userId === userId ? toRow(row) : null;
    },
    async runAsync(sql, params = []) {
      calls.push({ method: "runAsync", sql, params });
      if (/INSERT OR IGNORE INTO app_settings/i.test(sql)) {
        const [
          id,
          userId,
          currency,
          dailyHours,
          weeklyHours,
          normalWorkStartTime,
          normalWorkEndTime,
          overtimeMultiplier,
          offDayMultiplier,
          holidayMultiplier,
          status,
          lockHash,
          lockedAt,
        ] = params;
        if (!rows.has(id)) {
          rows.set(id, {
            id,
            userId,
            currency,
            dailyHours,
            weeklyHours,
            normalWorkStartTime,
            normalWorkEndTime,
            overtimeMultiplier,
            offDayMultiplier,
            holidayMultiplier,
            status,
            lockHash,
            lockedAt,
          });
        }
      }
      if (/UPDATE app_settings/i.test(sql)) {
        const [
          currency,
          dailyHours,
          weeklyHours,
          normalWorkStartTime,
          normalWorkEndTime,
          overtimeMultiplier,
          offDayMultiplier,
          holidayMultiplier,
          id,
          userId,
        ] = params;
        const row = rows.get(id);
        if (row && row.userId === userId) {
          rows.set(id, {
            ...row,
            currency,
            dailyHours,
            weeklyHours,
            normalWorkStartTime,
            normalWorkEndTime,
            overtimeMultiplier,
            offDayMultiplier,
            holidayMultiplier,
          });
        }
      }
    },
  };
}

test("getSettings inserts defaults idempotently then reselects by deterministic id and user", async () => {
  const load = createTsLoader();
  const { SettingsRepository } = load("src/db/settingsRepository.ts");
  const database = createFakeDatabase();
  const repository = new SettingsRepository(database);

  const first = await repository.getSettings("user-a");
  const second = await repository.getSettings("user-a");

  assert.equal(first.id, "settings:user-a");
  assert.deepEqual(second, first);
  assert.equal(database.rows.size, 1);
  assert.equal(
    database.calls.filter((call) => /INSERT OR IGNORE INTO app_settings/i.test(call.sql))
      .length,
    2,
  );
  assert.ok(
    database.calls.some(
      (call) =>
        call.method === "getFirstAsync" &&
        /WHERE id = \? AND user_id = \?/i.test(call.sql) &&
        call.params[0] === "settings:user-a" &&
        call.params[1] === "user-a",
    ),
  );
});

test("getSettings creates distinct default rows for different users", async () => {
  const load = createTsLoader();
  const { SettingsRepository } = load("src/db/settingsRepository.ts");
  const database = createFakeDatabase();
  const repository = new SettingsRepository(database);

  const first = await repository.getSettings("user-a");
  const second = await repository.getSettings("user-b");

  assert.equal(first.id, "settings:user-a");
  assert.equal(second.id, "settings:user-b");
  assert.equal(database.rows.size, 2);
});

test("updateSettings uses id and user scoped update parameters", async () => {
  const load = createTsLoader();
  const { SettingsRepository } = load("src/db/settingsRepository.ts");
  const database = createFakeDatabase();
  const repository = new SettingsRepository(database);

  await repository.updateSettings(
    {
      dailyHours: 9,
      weeklyHours: 45,
      normalWorkStartTime: "09:00",
      normalWorkEndTime: "18:00",
      offDayMultiplier: 2.25,
      holidayMultiplier: 3,
    },
    "user-a",
  );

  const update = database.calls.find((call) => /UPDATE app_settings/i.test(call.sql));
  assert.deepEqual(update.params, [
    "SGD",
    9,
    45,
    "09:00",
    "18:00",
    1.5,
    2.25,
    3,
    "settings:user-a",
    "user-a",
  ]);
});

test("repository health queries settings and generated document counts", async () => {
  const load = createTsLoader();
  const { SettingsRepository } = load("src/db/settingsRepository.ts");
  const database = createFakeDatabase();
  const repository = new SettingsRepository(database);

  await repository.getSettings("user-a");
  const health = await repository.getHealth();

  assert.deepEqual(health, {
    settingsCount: 1,
    generatedDocumentsCount: 0,
  });
});
