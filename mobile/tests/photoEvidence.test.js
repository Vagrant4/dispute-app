const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function createTsLoader(stubs = {}) {
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
      if (stubs[request]) {
        return stubs[request];
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

test("evidence types validate the approved Phase 5 list", () => {
  const { EVIDENCE_TYPES, isPhotoEvidenceType, assertPhotoEvidenceType } =
    createTsLoader()("src/photos/photoEvidenceTypes.ts");

  assert.deepEqual(EVIDENCE_TYPES, [
    "BEFORE_WORK",
    "DURING_WORK",
    "AFTER_WORK",
    "DEFECT",
    "COMPLETED_WORK",
    "MATERIAL_DELIVERY",
    "VARIATION_WORK",
    "OTHER",
  ]);
  assert.equal(isPhotoEvidenceType("DEFECT"), true);
  assert.equal(isPhotoEvidenceType("GPS_VERIFIED"), false);
  assert.throws(() => assertPhotoEvidenceType("GPS_VERIFIED"), /Unsupported photo evidence type/);
});

test("buildPhotoEvidenceInput requires projectId", () => {
  const { buildPhotoEvidenceInput } = createTsLoader()(
    "src/photos/photoEvidenceTypes.ts",
  );

  assert.throws(
    () =>
      buildPhotoEvidenceInput({
        id: "photo-1",
        userId: "user-a",
        projectId: "",
        localUri: "file:///photo.jpg",
      }),
    /projectId is required/,
  );
});

test("buildPhotoEvidenceInput defaults capturedAt and evidenceType without claiming GPS verification", () => {
  const { buildPhotoEvidenceInput } = createTsLoader()(
    "src/photos/photoEvidenceTypes.ts",
  );

  const input = buildPhotoEvidenceInput({
    id: "photo-1",
    userId: "user-a",
    projectId: "project-a",
    localUri: "file:///photo.jpg",
    timestamp: "2026-06-09T10:00:00.000Z",
    gps: {
      coordinates: { latitude: 1.3521, longitude: 103.8198 },
      message: "Location attached by device permission.",
    },
  });

  assert.equal(input.evidenceType, "OTHER");
  assert.equal(input.capturedAt, "2026-06-09T10:00:00.000Z");
  assert.equal(input.gpsLatitude, 1.3521);
  assert.equal(input.gpsLongitude, 103.8198);
  assert.match(input.gpsMessage, /Location attached/);
  assert.doesNotMatch(input.gpsMessage, /verified/i);
});

test("buildPhotoEvidenceInput rejects cross-project timeEntry payloads", () => {
  const { buildPhotoEvidenceInput } = createTsLoader()(
    "src/photos/photoEvidenceTypes.ts",
  );

  assert.throws(
    () =>
      buildPhotoEvidenceInput({
        id: "photo-1",
        userId: "user-a",
        projectId: "project-a",
        timeEntryId: "time-1",
        timeEntryProjectId: "project-b",
        localUri: "file:///photo.jpg",
      }),
    /timeEntryId must belong to the same projectId/,
  );
});

test("local photo destination builder is stable and path-safe", () => {
  const { buildEvidencePhotoPath } = createTsLoader({
    "expo-file-system/legacy": {
      documentDirectory: "file:///app-documents/",
    },
  })("src/photos/photoFileStorage.ts");

  assert.equal(
    buildEvidencePhotoPath({
      userId: "user/a",
      projectId: "../project:a",
      photoId: "photo 1",
      timestamp: "2026-06-09T10:05:06",
      extension: "jpeg",
    }),
    "file:///app-documents/evidence-photos/user-a/project-a/2026-06-09_10-05-06.jpeg",
  );
});

test("local photo destination builder falls back to safe id without timestamp", () => {
  const { buildEvidencePhotoPath } = createTsLoader({
    "expo-file-system/legacy": {
      documentDirectory: "file:///app-documents/",
    },
  })("src/photos/photoFileStorage.ts");

  assert.equal(
    buildEvidencePhotoPath({
      userId: "user/a",
      projectId: "../project:a",
      photoId: "photo 1",
      extension: "jpg",
    }),
    "file:///app-documents/evidence-photos/user-a/project-a/photo-1.jpg",
  );
});

test("GPS denied result is non-blocking", async () => {
  const { getOptionalPhotoGps } = createTsLoader({
    "expo-location": {
      PermissionStatus: { GRANTED: "granted", DENIED: "denied" },
      requestForegroundPermissionsAsync: async () => ({ status: "denied" }),
    },
  })("src/photos/photoGps.ts");

  const result = await getOptionalPhotoGps();

  assert.equal(result.coordinates, null);
  assert.equal(result.blocked, false);
  assert.match(result.message, /Location permission was not granted/);
});
