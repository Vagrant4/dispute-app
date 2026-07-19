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

test("embedPhotoEvidenceForPrint converts local photo URIs to printable data URIs", async () => {
  const { embedPhotoEvidenceForPrint } = createTsLoader()(
    "src/reports/reportPhotoEmbedding.ts",
  );
  const snapshot = {
    photoEvidence: [
      {
        id: "photo-1",
        localUri: "file:///documents/photo-1.jpg",
      },
    ],
  };

  const printable = await embedPhotoEvidenceForPrint(snapshot, {
    EncodingType: { Base64: "base64" },
    readAsStringAsync: async () => "aW1hZ2U=",
  });

  assert.equal(
    printable.photoEvidence[0].printUri,
    "data:image/jpeg;base64,aW1hZ2U=",
  );
  assert.equal(printable.photoEvidence[0].localUri, "file:///documents/photo-1.jpg");
});

test("embedPhotoEvidenceForPrint keeps report generation non-blocking when a photo cannot be read", async () => {
  const { embedPhotoEvidenceForPrint } = createTsLoader()(
    "src/reports/reportPhotoEmbedding.ts",
  );
  const snapshot = {
    photoEvidence: [
      {
        id: "photo-1",
        localUri: "file:///documents/missing.jpg",
      },
    ],
  };

  const printable = await embedPhotoEvidenceForPrint(snapshot, {
    readAsStringAsync: async () => {
      throw new Error("missing");
    },
  });

  assert.equal(printable.photoEvidence[0].printUri, undefined);
  assert.equal(printable.photoEvidence[0].localUri, "file:///documents/missing.jpg");
});
