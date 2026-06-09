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

function createFakeDatabase(initialRows = {}) {
  const tables = new Map();
  const calls = [];

  for (const [tableName, rows] of Object.entries(initialRows)) {
    tables.set(
      tableName,
      rows.map((row) => ({ ...row })),
    );
  }

  return {
    calls,
    tables,
    async execAsync(sql) {
      calls.push({ method: "execAsync", sql });
      const deleteMatch = sql.match(/^DELETE FROM "([^"]+)"/i);
      if (deleteMatch) {
        tables.set(deleteMatch[1], []);
      }
    },
    async getAllAsync(sql) {
      calls.push({ method: "getAllAsync", sql });
      const selectMatch = sql.match(/^SELECT \* FROM "([^"]+)"/i);
      if (!selectMatch) {
        throw new Error(`Unexpected SELECT: ${sql}`);
      }
      return (tables.get(selectMatch[1]) ?? []).map((row) => ({ ...row }));
    },
    async runAsync(sql, params = []) {
      calls.push({ method: "runAsync", sql, params });
      const insertMatch = sql.match(/^INSERT INTO "([^"]+)"/i);
      if (!insertMatch) {
        return;
      }
      const tableName = insertMatch[1];
      const columns = [...sql.matchAll(/"([^"]+)"/g)]
        .slice(1)
        .map((match) => match[1]);
      const row = Object.fromEntries(
        columns.map((columnName, index) => [columnName, params[index]]),
      );
      tables.set(tableName, [...(tables.get(tableName) ?? []), row]);
    },
  };
}

test("BackupRepository exports all known local SQLite tables", async () => {
  const load = createTsLoader();
  const { MOBILE_TABLES } = load("src/db/schema.ts");
  const { BackupRepository } = load("src/backup/backupRepository.ts");
  const database = createFakeDatabase({
    app_settings: [{ id: "settings:user-a", user_id: "user-a" }],
    clients: [{ id: "client-a", user_id: "user-a", name: "Acme" }],
  });

  const repository = new BackupRepository(database);
  const tables = await repository.exportTables();

  for (const tableName of MOBILE_TABLES) {
    assert.ok(Array.isArray(tables[tableName]), `${tableName} exported`);
  }
  assert.deepEqual(tables.clients, [
    { id: "client-a", user_id: "user-a", name: "Acme" },
  ]);
});

test("BackupRepository overwrites local records in dependency-safe table order", async () => {
  const load = createTsLoader();
  const { BackupRepository } = load("src/backup/backupRepository.ts");
  const database = createFakeDatabase({
    clients: [{ id: "old-client", user_id: "user-a" }],
    projects: [{ id: "old-project", user_id: "user-a" }],
  });
  const repository = new BackupRepository(database);

  await repository.applyBackup({
    app: "ClaimProof SG Mobile",
    version: 1,
    schema: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      clients: [{ id: "new-client", user_id: "user-a", name: "New Client" }],
      projects: [
        {
          id: "new-project",
          user_id: "user-a",
          client_id: "new-client",
          name: "New Project",
        },
      ],
    },
  });

  assert.deepEqual(database.tables.get("clients"), [
    { id: "new-client", user_id: "user-a", name: "New Client" },
  ]);
  assert.deepEqual(database.tables.get("projects"), [
    {
      id: "new-project",
      user_id: "user-a",
      client_id: "new-client",
      name: "New Project",
    },
  ]);

  const sqlCalls = database.calls.map((call) => call.sql);
  assert.ok(
    sqlCalls.indexOf('DELETE FROM "photo_evidence"') <
      sqlCalls.indexOf('DELETE FROM "projects"'),
  );
  assert.ok(
    sqlCalls.indexOf('DELETE FROM "projects"') <
      sqlCalls.indexOf('DELETE FROM "clients"'),
  );
  assert.ok(sqlCalls.includes("BEGIN IMMEDIATE TRANSACTION;"));
  assert.ok(sqlCalls.includes("COMMIT;"));
});
