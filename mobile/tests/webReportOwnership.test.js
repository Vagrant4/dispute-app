const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function createTsLoader() {
  const cache = new Map();
  function load(relativePath) {
    const normalized = relativePath.replaceAll("\\", "/");
    if (cache.has(normalized)) return cache.get(normalized).exports;
    const source = readFileSync(path.join(__dirname, "..", normalized), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const module = { exports: {} };
    cache.set(normalized, module);
    function localRequire(request) {
      if (!request.startsWith(".")) return require(request);
      if (request === "./generatedDocumentArchiveService") {
        return { createGeneratedDocumentId: () => "web-document" };
      }
      if (request === "./progressClaimCsv") {
        return { buildProgressClaimCsv: () => "" };
      }
      if (request === "./progressClaimHtml") {
        return { buildProgressClaimHtml: () => "" };
      }
      if (request === "../work/webWorkStore") {
        return {
          buildWebWorkProgressClaimSnapshot: () => ({}),
          webWorkStore: {},
        };
      }
      if (request === "../reports/progressClaimSnapshot") {
        return { buildProgressClaimSnapshot: (value) => value };
      }
      return load(
        path
          .join(path.dirname(normalized), `${request}.ts`)
          .replaceAll("\\", "/"),
      );
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

test("web report archive requires explicit approval before claiming legacy rows", async () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
  values.set(
    "claimproof-sg-web-generated-documents",
    JSON.stringify([
      {
        id: "legacy-report",
        user_id: "local-user",
        file_name: "legacy.pdf",
      },
    ]),
  );

  const {
    claimLegacyWebGeneratedDocuments,
    getWebProgressClaimRepositories,
  } = createTsLoader()(
    "src/reports/webReportAdapters.ts",
  );
  const repositories = getWebProgressClaimRepositories();
  const beforeApproval = await repositories.generatedDocuments.listRecentGeneratedDocuments({
    userId: "user-a",
  });
  assert.deepEqual(beforeApproval, []);
  assert.equal(claimLegacyWebGeneratedDocuments("user-a"), true);
  const rows = await repositories.generatedDocuments.listRecentGeneratedDocuments({
    userId: "user-a",
  });

  assert.deepEqual(rows.map((row) => row.user_id), ["user-a"]);
  assert.match(
    values.get("claimproof-sg-web-generated-documents"),
    /"user_id":"user-a"/,
  );
  delete globalThis.localStorage;
});

test("web work data requires explicit approval before legacy claim", async () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
  values.set(
    "claimproof-sg-web-work-state",
    JSON.stringify({
      clients: [],
      projects: [{ id: "legacy-project", name: "Legacy" }],
      project: { id: "legacy-project", name: "Legacy" },
      entries: [],
    }),
  );

  const {
    claimLegacyWebWorkData,
    webWorkStore,
  } = createTsLoader()("src/work/webWorkStore.ts");
  assert.deepEqual(await webWorkStore.listProjects("user-b"), []);
  assert.equal(claimLegacyWebWorkData("user-b"), true);
  assert.deepEqual(
    (await webWorkStore.listProjects("user-b")).map((project) => project.id),
    ["legacy-project"],
  );
  delete globalThis.localStorage;
});
