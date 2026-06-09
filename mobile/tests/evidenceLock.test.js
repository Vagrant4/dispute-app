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

function loadEvidenceLock() {
  return createTsLoader()("src/evidence/evidenceLock.ts");
}

test("canonical stringify is stable regardless of object key order", () => {
  const { canonicalStringify } = loadEvidenceLock();

  const first = canonicalStringify({
    projectId: "project-a",
    evidence: { activity: "Install cabinet", minutes: 120 },
    tags: ["site", "progress"],
  });
  const second = canonicalStringify({
    tags: ["site", "progress"],
    evidence: { minutes: 120, activity: "Install cabinet" },
    projectId: "project-a",
  });

  assert.equal(first, second);
  assert.equal(
    first,
    '{"evidence":{"activity":"Install cabinet","minutes":120},"projectId":"project-a","tags":["site","progress"]}',
  );
});

test("hash changes when record content changes", async () => {
  const { createEvidenceLock } = loadEvidenceLock();

  const first = await createEvidenceLock(
    { id: "time-1", durationMinutes: 120 },
    "2026-06-09T08:00:00.000Z",
  );
  const second = await createEvidenceLock(
    { id: "time-1", durationMinutes: 121 },
    "2026-06-09T08:00:00.000Z",
  );

  assert.notEqual(first.hash, second.hash);
});

test("verifyEvidenceLock returns true for the same record and false for changed records", async () => {
  const { createEvidenceLock, verifyEvidenceLock } = loadEvidenceLock();
  const lock = await createEvidenceLock(
    { id: "photo-1", caption: "Ceiling board completed" },
    "2026-06-09T08:00:00.000Z",
  );

  assert.equal(
    await verifyEvidenceLock(
      { caption: "Ceiling board completed", id: "photo-1" },
      lock.hash,
    ),
    true,
  );
  assert.equal(
    await verifyEvidenceLock(
      { id: "photo-1", caption: "Ceiling board still pending" },
      lock.hash,
    ),
    false,
  );
});

test("createEvidenceLock uses the supplied locked timestamp", async () => {
  const { createEvidenceLock } = loadEvidenceLock();

  const lock = await createEvidenceLock(
    { id: "claim-1", amountCents: 45000 },
    "2026-06-09T08:30:00.000Z",
  );

  assert.equal(lock.lockedAt, "2026-06-09T08:30:00.000Z");
  assert.equal(lock.hash.length, 64);
});

test("createEvidenceLock uses an injected deterministic hash provider", async () => {
  const { createEvidenceLock } = loadEvidenceLock();
  const seen = [];

  const lock = await createEvidenceLock(
    { id: "claim-1", amountCents: 45000 },
    "2026-06-09T08:30:00.000Z",
    {
      hashProviders: [
        async (canonicalJson) => {
          seen.push(canonicalJson);
          return "deterministic-test-hash";
        },
      ],
    },
  );

  assert.equal(lock.hash, "deterministic-test-hash");
  assert.deepEqual(seen, ['{"amountCents":45000,"id":"claim-1"}']);
});

test("hash provider failure falls back to the next injected provider", async () => {
  const { createEvidenceLock } = loadEvidenceLock();
  const calls = [];

  const lock = await createEvidenceLock(
    { id: "claim-1" },
    "2026-06-09T08:30:00.000Z",
    {
      hashProviders: [
        async () => {
          calls.push("first");
          throw new Error("first provider unavailable");
        },
        async () => {
          calls.push("second");
          return "fallback-hash";
        },
      ],
    },
  );

  assert.equal(lock.hash, "fallback-hash");
  assert.deepEqual(calls, ["first", "second"]);
});

test("hash provider failures throw a clear error when no provider succeeds", async () => {
  const { createEvidenceLock } = loadEvidenceLock();

  await assert.rejects(
    () =>
      createEvidenceLock({ id: "claim-1" }, "2026-06-09T08:30:00.000Z", {
        hashProviders: [
          async () => {
            throw new Error("provider unavailable");
          },
        ],
      }),
    /SHA-256 hashing failed for all configured providers/,
  );
});
