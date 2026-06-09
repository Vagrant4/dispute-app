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
      if (sql.startsWith("INSERT INTO generated_documents")) {
        records.push({
          id: params[0],
          user_id: params[1],
          project_id: params[2],
          document_type: params[3],
          file_name: params[4],
          local_uri: params[5],
          file_hash: params[6],
          period_start: params[7],
          period_end: params[8],
          metadata_json: params[9],
          snapshot_json: params[10],
          status: params[11],
        });
      }
      if (sql.startsWith("DELETE FROM generated_documents")) {
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
      const [userId, limit] = params;
      return records
        .filter((row) => row.user_id === userId)
        .slice(0, limit)
        .map((row) => ({ ...row }));
    },
    async getFirstAsync(sql, params = []) {
      calls.push({ method: "getFirstAsync", sql, params });
      const [id, userId] = params;
      const row = records.find((record) => record.id === id && record.user_id === userId);
      return row ? { ...row } : null;
    },
  };
}

test("GeneratedDocumentRepository inserts archived document with snapshot and hash", async () => {
  const { GeneratedDocumentRepository } = createTsLoader()(
    "src/reports/generatedDocumentRepository.ts",
  );
  const database = createFakeDatabase();
  const repository = new GeneratedDocumentRepository(database);

  await repository.insertGeneratedDocument({
    id: "doc-1",
    userId: "user-a",
    projectId: "project-a",
    type: "progress_claim_pdf",
    fileName: "claim.pdf",
    filePath: "file:///claim.pdf",
    hash: "hash-1",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    metadata: { format: "pdf" },
    snapshot: { totalClaimAmountCents: 80000 },
    status: "finalized",
  });

  assert.match(database.calls[0].sql, /INSERT INTO generated_documents/);
  assert.deepEqual(database.calls[0].params, [
    "doc-1",
    "user-a",
    "project-a",
    "progress_claim_pdf",
    "claim.pdf",
    "file:///claim.pdf",
    "hash-1",
    "2026-06-01",
    "2026-06-30",
    JSON.stringify({ format: "pdf" }),
    JSON.stringify({ totalClaimAmountCents: 80000 }),
    "finalized",
  ]);
});

test("GeneratedDocumentRepository filters list get and delete by userId", async () => {
  const { GeneratedDocumentRepository } = createTsLoader()(
    "src/reports/generatedDocumentRepository.ts",
  );
  const database = createFakeDatabase([
    { id: "doc-1", user_id: "user-a", file_name: "a.pdf" },
    { id: "doc-1", user_id: "user-b", file_name: "b.pdf" },
    { id: "doc-2", user_id: "user-a", file_name: "c.csv" },
  ]);
  const repository = new GeneratedDocumentRepository(database);

  const rows = await repository.listRecentGeneratedDocuments({
    userId: "user-a",
    limit: 5,
  });
  const row = await repository.getGeneratedDocumentById({
    id: "doc-1",
    userId: "user-a",
  });
  await repository.deleteGeneratedDocument({ id: "doc-1", userId: "user-a" });

  assert.deepEqual(rows.map((item) => item.user_id), ["user-a", "user-a"]);
  assert.equal(row.file_name, "a.pdf");
  assert.match(database.calls[0].sql, /WHERE user_id = \?/);
  assert.deepEqual(database.calls[0].params, ["user-a", 5]);
  assert.match(database.calls[1].sql, /WHERE id = \? AND user_id = \?/);
  assert.deepEqual(database.calls[1].params, ["doc-1", "user-a"]);
  assert.match(database.calls[2].sql, /DELETE FROM generated_documents WHERE id = \? AND user_id = \?/);
  assert.deepEqual(database.records, [
    { id: "doc-1", user_id: "user-b", file_name: "b.pdf" },
    { id: "doc-2", user_id: "user-a", file_name: "c.csv" },
  ]);
});
