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

function loadEvidenceLockRepository() {
  return createTsLoader()("src/evidence/evidenceLockRepository.ts");
}

test("buildEvidenceLockUpdate produces local row lock fields", async () => {
  const { buildEvidenceLockUpdate } = loadEvidenceLockRepository();

  const update = await buildEvidenceLockUpdate(
    { id: "time-1", activity: "Install cabinet", durationMinutes: 120 },
    "2026-06-09T09:00:00.000Z",
  );

  assert.equal(update.status, "LOCKED");
  assert.equal(update.lockedAt, "2026-06-09T09:00:00.000Z");
  assert.equal(update.lockHash.length, 64);
});

test("locked-record update guard rejects edits when status is LOCKED", () => {
  const { assertCanUpdateUnlockedRecord } = loadEvidenceLockRepository();

  assert.throws(
    () =>
      assertCanUpdateUnlockedRecord({
        id: "time-1",
        status: "LOCKED",
        lockHash: "abc",
        lockedAt: "2026-06-09T09:00:00.000Z",
      }),
    /Locked evidence records are read-only/,
  );
});

test("locked-record update guard allows draft edits", () => {
  const { assertCanUpdateUnlockedRecord } = loadEvidenceLockRepository();

  assert.doesNotThrow(() =>
    assertCanUpdateUnlockedRecord({
      id: "time-1",
      status: "draft",
      lockHash: null,
      lockedAt: null,
    }),
  );
});
