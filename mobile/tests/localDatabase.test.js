const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTsModule(relativePath) {
  const sourcePath = path.join(__dirname, "..", relativePath);
  const source = readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", compiled)(module.exports, module);
  return module.exports;
}

test("mobile SQLite schema includes required local tables and evidence fields", () => {
  const { MOBILE_SCHEMA_SQL, MOBILE_TABLES } = loadTsModule("src/db/schema.ts");

  for (const tableName of [
    "schema_migrations",
    "app_settings",
    "clients",
    "projects",
    "time_entries",
    "photo_evidence",
    "generated_documents",
    "subscription_entitlements",
  ]) {
    assert.ok(MOBILE_TABLES.includes(tableName), `${tableName} is listed`);
    assert.match(
      MOBILE_SCHEMA_SQL,
      new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName}\\b`),
      `${tableName} DDL exists`,
    );
  }

  for (const fieldName of ["user_id", "lock_hash", "locked_at", "status"]) {
    assert.match(MOBILE_SCHEMA_SQL, new RegExp(`\\b${fieldName}\\b`));
  }
});

test("repository diagnostics SQL counts settings and generated documents", () => {
  const { REPOSITORY_HEALTH_SQL } = loadTsModule("src/db/schema.ts");

  assert.match(REPOSITORY_HEALTH_SQL.settingsCount, /COUNT\(\*\).*app_settings/i);
  assert.match(
    REPOSITORY_HEALTH_SQL.generatedDocumentsCount,
    /COUNT\(\*\).*generated_documents/i,
  );
});

test("mobile SQLite schema enforces one settings row per user", () => {
  const { MOBILE_SCHEMA_SQL } = loadTsModule("src/db/schema.ts");

  assert.match(
    MOBILE_SCHEMA_SQL,
    /CREATE UNIQUE INDEX IF NOT EXISTS ux_app_settings_user_id ON app_settings\(user_id\)/,
  );
});

test("mobile SQLite schema uses composite ownership keys and foreign keys", () => {
  const { MOBILE_SCHEMA_SQL } = loadTsModule("src/db/schema.ts");

  for (const expectedSql of [
    "UNIQUE (id, user_id)",
    "FOREIGN KEY (client_id, user_id) REFERENCES clients(id, user_id)",
    "FOREIGN KEY (project_id, user_id) REFERENCES projects(id, user_id)",
    "FOREIGN KEY (time_entry_id, project_id, user_id) REFERENCES time_entries(id, project_id, user_id)",
  ]) {
    assert.match(MOBILE_SCHEMA_SQL, new RegExp(expectedSql.replace(/[()]/g, "\\$&")));
  }
});

test("mobile SQLite schema requires photo evidence project ownership", () => {
  const { MOBILE_SCHEMA_SQL } = loadTsModule("src/db/schema.ts");

  assert.match(
    MOBILE_SCHEMA_SQL,
    /CREATE TABLE IF NOT EXISTS photo_evidence \([\s\S]*\bproject_id TEXT NOT NULL\b/,
  );
});

test("local migration service keeps migration table DDL in one schema constant", () => {
  const { SCHEMA_MIGRATIONS_TABLE_SQL, MOBILE_SCHEMA_SQL } = loadTsModule(
    "src/db/schema.ts",
  );

  assert.ok(SCHEMA_MIGRATIONS_TABLE_SQL.includes("schema_migrations"));
  assert.ok(MOBILE_SCHEMA_SQL.includes(SCHEMA_MIGRATIONS_TABLE_SQL.trim()));
});

test("local migration service applies migration SQL and version row atomically", () => {
  const source = readFileSync(
    path.join(__dirname, "..", "src", "db", "localDatabase.ts"),
    "utf8",
  );

  assert.match(source, /BEGIN IMMEDIATE TRANSACTION/);
  assert.match(source, /INSERT OR IGNORE INTO schema_migrations/);
  assert.match(source, /COMMIT/);
  assert.match(source, /ROLLBACK/);
});
