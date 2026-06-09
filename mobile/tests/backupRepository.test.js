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
  let transactionSnapshot = null;

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
      if (sql === "BEGIN IMMEDIATE TRANSACTION;") {
        transactionSnapshot = cloneTables(tables);
        return;
      }
      if (sql === "COMMIT;") {
        transactionSnapshot = null;
        return;
      }
      if (sql === "ROLLBACK;") {
        if (transactionSnapshot) {
          tables.clear();
          for (const [tableName, rows] of transactionSnapshot.entries()) {
            tables.set(
              tableName,
              rows.map((row) => ({ ...row })),
            );
          }
        }
        transactionSnapshot = null;
        return;
      }
      const deleteMatch = sql.match(/^DELETE FROM "([^"]+)"/i);
      if (deleteMatch) {
        tables.set(deleteMatch[1], []);
      }
    },
    async getAllAsync(sql) {
      calls.push({ method: "getAllAsync", sql });
      if (sql === "PRAGMA foreign_key_check;") {
        return [];
      }
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
      enforceFakeForeignKeys(tableName, row, tables);
      tables.set(tableName, [...(tables.get(tableName) ?? []), row]);
    },
  };
}

function cloneTables(tables) {
  return new Map(
    [...tables.entries()].map(([tableName, rows]) => [
      tableName,
      rows.map((row) => ({ ...row })),
    ]),
  );
}

function enforceFakeForeignKeys(tableName, row, tables) {
  if (tableName === "projects" && !hasOwnedRow(tables, "clients", row.client_id, row.user_id)) {
    throw new Error("FOREIGN KEY constraint failed: projects.client_id");
  }
  if (
    tableName === "time_entries" &&
    !hasOwnedRow(tables, "projects", row.project_id, row.user_id)
  ) {
    throw new Error("FOREIGN KEY constraint failed: time_entries.project_id");
  }
  if (
    tableName === "photo_evidence" &&
    !hasOwnedRow(tables, "projects", row.project_id, row.user_id)
  ) {
    throw new Error("FOREIGN KEY constraint failed: photo_evidence.project_id");
  }
  if (
    tableName === "photo_evidence" &&
    row.time_entry_id != null &&
    !hasOwnedRow(tables, "time_entries", row.time_entry_id, row.user_id)
  ) {
    throw new Error("FOREIGN KEY constraint failed: photo_evidence.time_entry_id");
  }
  if (
    tableName === "generated_documents" &&
    row.project_id != null &&
    !hasOwnedRow(tables, "projects", row.project_id, row.user_id)
  ) {
    throw new Error("FOREIGN KEY constraint failed: generated_documents.project_id");
  }
}

function hasOwnedRow(tables, tableName, id, userId) {
  return (tables.get(tableName) ?? []).some(
    (row) => row.id === id && row.user_id === userId,
  );
}

function createCompleteTables(overrides = {}) {
  return {
    app_settings: [],
    clients: [],
    projects: [],
    time_entries: [],
    photo_evidence: [],
    generated_documents: [],
    subscription_entitlements: [],
    ...overrides,
  };
}

test("BackupRepository exports all known local SQLite tables", async () => {
  const load = createTsLoader();
  const { BACKUP_TABLES } = load("src/backup/backupTypes.ts");
  const { BackupRepository } = load("src/backup/backupRepository.ts");
  const database = createFakeDatabase({
    schema_migrations: [{ version: 1, name: "phase_2_local_storage" }],
    app_settings: [{ id: "settings:user-a", user_id: "user-a" }],
    clients: [{ id: "client-a", user_id: "user-a", name: "Acme" }],
  });

  const repository = new BackupRepository(database);
  const tables = await repository.exportTables();

  for (const tableName of BACKUP_TABLES) {
    assert.ok(Array.isArray(tables[tableName]), `${tableName} exported`);
  }
  assert.equal(tables.schema_migrations, undefined);
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
    tables: createCompleteTables({
      clients: [{ id: "new-client", user_id: "user-a", name: "New Client" }],
      projects: [
        {
          id: "new-project",
          user_id: "user-a",
          client_id: "new-client",
          name: "New Project",
        },
      ],
    }),
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
  assert.ok(sqlCalls.includes("PRAGMA foreign_key_check;"));
  assert.ok(sqlCalls.includes("COMMIT;"));
  assert.equal(sqlCalls.includes("PRAGMA foreign_keys = OFF;"), false);
  assert.equal(sqlCalls.includes('DELETE FROM "schema_migrations"'), false);
});

test("importBackupJson restores through BackupRepository and fake LocalDatabase", async () => {
  const load = createTsLoader();
  const {
    BACKUP_APP_MARKER,
    BACKUP_SCHEMA_VERSION,
    importBackupJson,
  } = load("src/backup/backupService.ts");
  const { BackupRepository } = load("src/backup/backupRepository.ts");
  const database = createFakeDatabase({
    clients: [{ id: "old-client", user_id: "user-a", name: "Old Client" }],
    projects: [
      {
        id: "old-project",
        user_id: "user-a",
        client_id: "old-client",
        name: "Old Project",
      },
    ],
  });

  await importBackupJson(
    JSON.stringify({
      app: BACKUP_APP_MARKER,
      version: BACKUP_SCHEMA_VERSION,
      schema: 1,
      exportedAt: new Date().toISOString(),
      tables: createCompleteTables({
        clients: [{ id: "new-client", user_id: "user-a", name: "New Client" }],
        projects: [
          {
            id: "new-project",
            user_id: "user-a",
            client_id: "new-client",
            name: "New Project",
          },
        ],
      }),
    }),
    new BackupRepository(database),
    { mode: "overwrite" },
  );

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
});

test("importBackupJson rejects FK-invalid payloads and rolls back local records", async () => {
  const load = createTsLoader();
  const {
    BACKUP_APP_MARKER,
    BACKUP_SCHEMA_VERSION,
    importBackupJson,
  } = load("src/backup/backupService.ts");
  const { BackupRepository } = load("src/backup/backupRepository.ts");
  const database = createFakeDatabase({
    clients: [{ id: "old-client", user_id: "user-a", name: "Old Client" }],
    projects: [
      {
        id: "old-project",
        user_id: "user-a",
        client_id: "old-client",
        name: "Old Project",
      },
    ],
  });

  await assert.rejects(
    () =>
      importBackupJson(
        JSON.stringify({
          app: BACKUP_APP_MARKER,
          version: BACKUP_SCHEMA_VERSION,
          schema: 1,
          exportedAt: new Date().toISOString(),
          tables: createCompleteTables({
            clients: [],
            projects: [
              {
                id: "bad-project",
                user_id: "user-a",
                client_id: "missing-client",
                name: "Bad Project",
              },
            ],
          }),
        }),
        new BackupRepository(database),
        { mode: "overwrite" },
      ),
    /FOREIGN KEY constraint failed/,
  );

  assert.deepEqual(database.tables.get("clients"), [
    { id: "old-client", user_id: "user-a", name: "Old Client" },
  ]);
  assert.deepEqual(database.tables.get("projects"), [
    {
      id: "old-project",
      user_id: "user-a",
      client_id: "old-client",
      name: "Old Project",
    },
  ]);
  assert.ok(database.calls.some((call) => call.sql === "ROLLBACK;"));
});
