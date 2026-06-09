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

function loadBackupService() {
  const load = createTsLoader();
  return load("src/backup/backupService.ts");
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

test("createBackupEnvelope wraps table data with ClaimProof SG marker and version", () => {
  const {
    BACKUP_APP_MARKER,
    BACKUP_SCHEMA_VERSION,
    createBackupEnvelope,
  } = loadBackupService();

  const envelope = createBackupEnvelope(createCompleteTables({
    app_settings: [{ id: "settings:user-a", user_id: "user-a" }],
  }));

  assert.equal(envelope.app, BACKUP_APP_MARKER);
  assert.equal(envelope.version, BACKUP_SCHEMA_VERSION);
  assert.equal(envelope.schema, 2);
  assert.equal(typeof envelope.exportedAt, "string");
  assert.deepEqual(envelope.tables.app_settings, [
    { id: "settings:user-a", user_id: "user-a" },
  ]);
});

test("parseBackupJson rejects malformed JSON with a clear error", () => {
  const { parseBackupJson } = loadBackupService();

  assert.throws(
    () => parseBackupJson("{not-json"),
    /Backup JSON is malformed/,
  );
});

test("parseBackupJson rejects wrong app marker and unsupported version", () => {
  const { BACKUP_APP_MARKER, BACKUP_SCHEMA_VERSION, parseBackupJson } =
    loadBackupService();

  assert.throws(
    () =>
      parseBackupJson(
        JSON.stringify({
          app: "Other App",
          version: BACKUP_SCHEMA_VERSION,
          schema: 1,
          exportedAt: new Date().toISOString(),
          tables: createCompleteTables(),
        }),
      ),
    /not a ClaimProof SG mobile backup/,
  );

  assert.throws(
    () =>
      parseBackupJson(
        JSON.stringify({
          app: BACKUP_APP_MARKER,
          version: BACKUP_SCHEMA_VERSION + 1,
          schema: 1,
          exportedAt: new Date().toISOString(),
          tables: createCompleteTables(),
        }),
      ),
    /Unsupported backup version/,
  );
});

test("parseBackupJson rejects known table payloads that are not arrays", () => {
  const { BACKUP_APP_MARKER, BACKUP_SCHEMA_VERSION, parseBackupJson } =
    loadBackupService();

  assert.throws(
    () =>
      parseBackupJson(
        JSON.stringify({
          app: BACKUP_APP_MARKER,
          version: BACKUP_SCHEMA_VERSION,
          schema: 1,
          exportedAt: new Date().toISOString(),
          tables: createCompleteTables({
            clients: { id: "client-a" },
          }),
        }),
      ),
    /Backup table clients must be an array/,
  );
});

test("parseBackupJson rejects partial destructive restore table payloads", () => {
  const { BACKUP_APP_MARKER, BACKUP_SCHEMA_VERSION, parseBackupJson } =
    loadBackupService();

  assert.throws(
    () =>
      parseBackupJson(
        JSON.stringify({
          app: BACKUP_APP_MARKER,
          version: BACKUP_SCHEMA_VERSION,
          schema: 1,
          exportedAt: new Date().toISOString(),
          tables: { clients: [] },
        }),
      ),
    /Backup is missing required table app_settings/,
  );
});

test("parseBackupJson rejects schema migration table payloads", () => {
  const { BACKUP_APP_MARKER, BACKUP_SCHEMA_VERSION, parseBackupJson } =
    loadBackupService();

  assert.throws(
    () =>
      parseBackupJson(
        JSON.stringify({
          app: BACKUP_APP_MARKER,
          version: BACKUP_SCHEMA_VERSION,
          schema: 1,
          exportedAt: new Date().toISOString(),
          tables: createCompleteTables({
            schema_migrations: [{ version: 999, name: "untrusted" }],
          }),
        }),
      ),
    /schema_migrations cannot be restored from backup/,
  );
});

test("importBackupJson requires explicit overwrite mode", async () => {
  const {
    BACKUP_APP_MARKER,
    BACKUP_SCHEMA_VERSION,
    importBackupJson,
  } = loadBackupService();
  const repository = {
    applyBackup: async () => {
      throw new Error("applyBackup should not run");
    },
  };

  await assert.rejects(
    () =>
      importBackupJson(
        JSON.stringify({
          app: BACKUP_APP_MARKER,
          version: BACKUP_SCHEMA_VERSION,
          schema: 1,
          exportedAt: new Date().toISOString(),
          tables: createCompleteTables(),
        }),
        repository,
      ),
    /explicit overwrite mode/,
  );
});

test("importBackupJson applies a valid backup when overwrite mode is explicit", async () => {
  const {
    BACKUP_APP_MARKER,
    BACKUP_SCHEMA_VERSION,
    importBackupJson,
  } = loadBackupService();
  const applied = [];
  const repository = {
    async applyBackup(envelope) {
      applied.push(envelope);
    },
  };

  const result = await importBackupJson(
    JSON.stringify({
      app: BACKUP_APP_MARKER,
      version: BACKUP_SCHEMA_VERSION,
      schema: 1,
      exportedAt: new Date().toISOString(),
      tables: createCompleteTables({
        clients: [{ id: "client-a", user_id: "user-a" }],
      }),
    }),
    repository,
    { mode: "overwrite" },
  );

  assert.equal(applied.length, 1);
  assert.deepEqual(result.importedTableCounts, {
    app_settings: 0,
    clients: 1,
    projects: 0,
    time_entries: 0,
    photo_evidence: 0,
    generated_documents: 0,
    subscription_entitlements: 0,
  });
});
