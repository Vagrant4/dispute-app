const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadOwnershipModule() {
  const source = readFileSync(
    path.join(__dirname, "..", "src", "db", "localDataOwnership.ts"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  function localRequire(request) {
    if (request === "./settingsValidation") {
      return { DEFAULT_USER_ID: "local-user" };
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

function createDatabase(counts) {
  const execCalls = [];
  const updateCalls = [];
  return {
    execCalls,
    updateCalls,
    async execAsync(sql) {
      execCalls.push(sql);
    },
    async getFirstAsync(sql, params) {
      const table = /FROM ([a-z_]+)/.exec(sql)?.[1];
      return { count: counts[`${table}:${params[0]}`] ?? 0 };
    },
    async getAllAsync() {
      return [];
    },
    async runAsync(sql, params) {
      updateCalls.push({ sql, params });
    },
  };
}

test("legacy local data is claimed once by the authenticated account", async () => {
  const { claimLegacyLocalDataForUser } = loadOwnershipModule();
  const database = createDatabase({ "time_entries:local-user": 2 });

  assert.equal(
    await claimLegacyLocalDataForUser(database, "account-a"),
    true,
  );
  assert.deepEqual(database.execCalls, [
    "BEGIN IMMEDIATE TRANSACTION;",
    "PRAGMA defer_foreign_keys = ON;",
    "COMMIT;",
  ]);
  assert.equal(database.updateCalls.length, 7);
  for (const call of database.updateCalls) {
    assert.match(call.sql, /^UPDATE [a-z_]+ SET user_id = \? WHERE user_id = \?$/);
    assert.deepEqual(call.params, ["account-a", "local-user"]);
  }
});

test("legacy data is not merged into an account that already owns local rows", async () => {
  const { claimLegacyLocalDataForUser } = loadOwnershipModule();
  const database = createDatabase({
    "time_entries:local-user": 2,
    "time_entries:account-b": 1,
  });

  assert.equal(
    await claimLegacyLocalDataForUser(database, "account-b"),
    false,
  );
  assert.deepEqual(database.updateCalls, []);
  assert.deepEqual(database.execCalls, []);
});

test("default account settings do not block an explicit legacy work-data claim", async () => {
  const { claimLegacyLocalDataForUser } = loadOwnershipModule();
  const database = createDatabase({
    "time_entries:local-user": 2,
    "app_settings:account-a": 1,
  });

  assert.equal(
    await claimLegacyLocalDataForUser(database, "account-a"),
    true,
  );
  assert.ok(
    database.updateCalls.some((call) =>
      call.sql.startsWith("UPDATE time_entries "),
    ),
  );
  assert.equal(
    database.updateCalls.some((call) =>
      call.sql.startsWith("UPDATE app_settings "),
    ),
    false,
  );
});
