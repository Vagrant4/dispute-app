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
