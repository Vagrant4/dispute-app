const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const expoCryptoMock = {
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_algorithm, data) => deterministicHexDigest(data),
};

function deterministicHexDigest(data) {
  let seed = 0;
  for (const char of data) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }

  return Array.from({ length: 64 }, (_, index) =>
    ((seed + index) % 16).toString(16),
  ).join("");
}

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
      if (request === "expo-crypto") {
        return expoCryptoMock;
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
    {
      id: "time-1",
      status: "draft",
      activity: "Install cabinet",
      durationMinutes: 120,
    },
    "2026-06-09T09:00:00.000Z",
  );

  assert.equal(update.status, "locked");
  assert.equal(update.lockedAt, "2026-06-09T09:00:00.000Z");
  assert.equal(update.lockHash.length, 64);
});

test("locked-record update guard rejects edits when status is locked in any casing", () => {
  const { assertCanUpdateUnlockedRecord } = loadEvidenceLockRepository();

  for (const status of ["locked", "LOCKED"]) {
    assert.throws(
      () =>
        assertCanUpdateUnlockedRecord({
          id: "time-1",
          status,
          lockHash: "abc",
          lockedAt: "2026-06-09T09:00:00.000Z",
        }),
      /Locked evidence records are read-only/,
    );
  }
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

test("locked-record update guard fails closed for missing status", () => {
  const { assertCanUpdateUnlockedRecord } = loadEvidenceLockRepository();

  assert.throws(
    () =>
      assertCanUpdateUnlockedRecord({
        id: "time-1",
      }),
    /Evidence record status is required/,
  );
});

test("locked-record update guard fails closed for unknown status", () => {
  const { assertCanUpdateUnlockedRecord } = loadEvidenceLockRepository();

  assert.throws(
    () =>
      assertCanUpdateUnlockedRecord({
        id: "time-1",
        status: "pending-review",
      }),
    /Unsupported evidence record status/,
  );
});

test("canonical evidence payload excludes unstable audit metadata", async () => {
  const { getLockableEvidencePayload } = loadEvidenceLockRepository();
  const { createEvidenceLock } = createTsLoader()("src/evidence/evidenceLock.ts");

  const firstPayload = getLockableEvidencePayload({
    id: "time-1",
    user_id: "user-a",
    activity: "Install cabinet",
    duration_minutes: 120,
    status: "draft",
    lock_hash: null,
    locked_at: null,
    created_at: "2026-06-09T08:00:00.000Z",
    updated_at: "2026-06-09T08:00:00.000Z",
  });
  const secondPayload = getLockableEvidencePayload({
    id: "time-1",
    user_id: "user-a",
    activity: "Install cabinet",
    duration_minutes: 120,
    status: "draft",
    lock_hash: null,
    locked_at: null,
    created_at: "2026-06-09T08:00:00.000Z",
    updated_at: "2026-06-10T08:00:00.000Z",
  });

  assert.deepEqual(firstPayload, {
    id: "time-1",
    user_id: "user-a",
    activity: "Install cabinet",
    duration_minutes: 120,
  });

  const firstLock = await createEvidenceLock(firstPayload, "2026-06-09T09:00:00.000Z");
  const secondLock = await createEvidenceLock(secondPayload, "2026-06-09T09:00:00.000Z");

  assert.equal(firstLock.hash, secondLock.hash);
});

test("evidence content changes still change lock payload hash", async () => {
  const { getLockableEvidencePayload } = loadEvidenceLockRepository();
  const { createEvidenceLock } = createTsLoader()("src/evidence/evidenceLock.ts");

  const firstLock = await createEvidenceLock(
    getLockableEvidencePayload({
      id: "time-1",
      status: "draft",
      activity: "Install cabinet",
      durationMinutes: 120,
      updatedAt: "2026-06-09T08:00:00.000Z",
    }),
    "2026-06-09T09:00:00.000Z",
  );
  const secondLock = await createEvidenceLock(
    getLockableEvidencePayload({
      id: "time-1",
      status: "draft",
      activity: "Install cabinet",
      durationMinutes: 121,
      updatedAt: "2026-06-09T08:00:00.000Z",
    }),
    "2026-06-09T09:00:00.000Z",
  );

  assert.notEqual(firstLock.hash, secondLock.hash);
});
