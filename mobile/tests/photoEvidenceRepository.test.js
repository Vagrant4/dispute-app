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

function createFakeDatabase(rows = []) {
  const calls = [];
  const records = rows.map((row) => ({ ...row }));

  return {
    calls,
    records,
    async runAsync(sql, params = []) {
      calls.push({ method: "runAsync", sql, params });
      if (sql.startsWith("INSERT INTO photo_evidence")) {
        records.push({
          id: params[0],
          user_id: params[1],
          project_id: params[2],
          time_entry_id: params[3],
          local_uri: params[4],
          caption: params[5],
          evidence_type: params[6],
          captured_at: params[7],
          gps_latitude: params[8],
          gps_longitude: params[9],
          gps_message: params[10],
          status: params[11],
        });
      }
      if (sql.startsWith("DELETE FROM photo_evidence")) {
        const [id, userId] = params;
        const index = records.findIndex(
          (row) => row.id === id && row.user_id === userId,
        );
        if (index >= 0) {
          records.splice(index, 1);
        }
      }
    },
    async getAllAsync(sql, params = []) {
      calls.push({ method: "getAllAsync", sql, params });
      if (!sql.startsWith("SELECT")) {
        throw new Error(`Unexpected SELECT: ${sql}`);
      }
      const [userId, limit] = params;
      return records
        .filter((row) => row.user_id === userId)
        .slice(0, limit)
        .map((row) => ({ ...row }));
    },
  };
}

test("PhotoEvidenceRepository inserts owned photo evidence SQL parameters", async () => {
  const { PhotoEvidenceRepository } = createTsLoader()(
    "src/photos/photoEvidenceRepository.ts",
  );
  const database = createFakeDatabase();
  const repository = new PhotoEvidenceRepository(database);

  await repository.insertPhotoEvidence({
    id: "photo-1",
    userId: "user-a",
    projectId: "project-a",
    timeEntryId: "time-1",
    timeEntryProjectId: "project-a",
    localUri: "file:///photo.jpg",
    caption: "Before work",
    evidenceType: "BEFORE_WORK",
    capturedAt: "2026-06-09T10:00:00.000Z",
    gpsLatitude: 1.3,
    gpsLongitude: 103.8,
    gpsMessage: "Location attached by device permission.",
    status: "draft",
  });

  const call = database.calls[0];
  assert.equal(call.method, "runAsync");
  assert.match(call.sql, /INSERT INTO photo_evidence/);
  assert.deepEqual(call.params, [
    "photo-1",
    "user-a",
    "project-a",
    "time-1",
    "file:///photo.jpg",
    "Before work",
    "BEFORE_WORK",
    "2026-06-09T10:00:00.000Z",
    1.3,
    103.8,
    "Location attached by device permission.",
    "draft",
  ]);
});

test("PhotoEvidenceRepository lists recent user photo evidence only", async () => {
  const { PhotoEvidenceRepository } = createTsLoader()(
    "src/photos/photoEvidenceRepository.ts",
  );
  const database = createFakeDatabase([
    { id: "photo-1", user_id: "user-a", project_id: "project-a" },
    { id: "photo-2", user_id: "user-b", project_id: "project-b" },
  ]);
  const repository = new PhotoEvidenceRepository(database);

  const rows = await repository.listRecentPhotoEvidence({
    userId: "user-a",
    limit: 5,
  });

  assert.deepEqual(rows, [
    { id: "photo-1", user_id: "user-a", project_id: "project-a" },
  ]);
  assert.deepEqual(database.calls[0].params, ["user-a", 5]);
  assert.match(database.calls[0].sql, /WHERE user_id = \?/);
});

test("PhotoEvidenceRepository deletes owned photo evidence row", async () => {
  const { PhotoEvidenceRepository } = createTsLoader()(
    "src/photos/photoEvidenceRepository.ts",
  );
  const database = createFakeDatabase([
    { id: "photo-1", user_id: "user-a", project_id: "project-a" },
    { id: "photo-1", user_id: "user-b", project_id: "project-b" },
  ]);
  const repository = new PhotoEvidenceRepository(database);

  await repository.deletePhotoEvidence({ id: "photo-1", userId: "user-a" });

  assert.deepEqual(database.calls[0].params, ["photo-1", "user-a"]);
  assert.match(database.calls[0].sql, /DELETE FROM photo_evidence WHERE id = \? AND user_id = \?/);
  assert.deepEqual(database.records, [
    { id: "photo-1", user_id: "user-b", project_id: "project-b" },
  ]);
});

test("PhotoEvidenceRepository rejects cross-project timeEntry inserts before SQL", async () => {
  const { PhotoEvidenceRepository } = createTsLoader()(
    "src/photos/photoEvidenceRepository.ts",
  );
  const database = createFakeDatabase();
  const repository = new PhotoEvidenceRepository(database);

  await assert.rejects(
    () =>
      repository.insertPhotoEvidence({
        id: "photo-1",
        userId: "user-a",
        projectId: "project-a",
        timeEntryId: "time-1",
        timeEntryProjectId: "project-b",
        localUri: "file:///photo.jpg",
      }),
    /timeEntryId must belong to the same projectId/,
  );
  assert.equal(database.calls.length, 0);
});
