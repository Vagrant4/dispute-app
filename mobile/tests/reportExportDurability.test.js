const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function createTsLoader(mocks = {}) {
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
      if (Object.hasOwn(mocks, request)) {
        return mocks[request];
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

function createSnapshot() {
  return {
    title: "Progress Claim Report",
    generatedAt: "2026-06-09T12:00:00.000Z",
    claimPeriod: { start: "2026-06-01", end: "2026-06-30" },
    worker: { name: "Asha Lim" },
    client: { name: "Acme Pte Ltd" },
    project: {
      id: "project-1",
      name: "Shop renovation",
      currency: "SGD",
      hourlyRateCents: 5000,
    },
    rateCalculation: {
      currency: "SGD",
      hourlyRateCents: 5000,
      dailyNormalMinutes: 480,
      overtimeMultiplier: 1.5,
    },
    totals: {
      totalDaysWorked: 1,
      totalNormalHours: 8,
      totalOvertimeHours: 0,
      basicPayCents: 40000,
      overtimePayCents: 0,
      allowancesCents: 0,
      deductionsCents: 0,
      grossPayCents: 40000,
      netPayCents: 40000,
      totalClaimAmountCents: 40000,
    },
    dailyWorkLog: [],
    photoEvidence: [],
    signature: {
      workerSignature: "",
      clientAcknowledgement: "",
      signedAt: "",
    },
    disclaimer:
      "This app helps you record work, time, pay, and evidence for reference. It does not replace legal, accounting, or MOM advice.",
    localStorageNotice:
      "Generated report files are stored locally on this device and can be shared manually.",
  };
}

test("saveProgressClaimCsv rejects when durable app-owned storage is unavailable", async () => {
  const { saveProgressClaimCsv } = createTsLoader({
    "expo-file-system/legacy": {
      documentDirectory: "file:///documents/",
      EncodingType: { UTF8: "utf8" },
    },
  })("src/reports/reportCsvExport.ts");

  await assert.rejects(
    () =>
      saveProgressClaimCsv({
        snapshot: createSnapshot(),
        userId: "user-a",
        documentId: "doc-1",
      }),
    /Durable report storage is unavailable/,
  );
});

test("saveProgressClaimCsv rejects when documentDirectory is unavailable", async () => {
  const writes = [];
  const { saveProgressClaimCsv } = createTsLoader({
    "expo-file-system/legacy": {
      documentDirectory: null,
      EncodingType: { UTF8: "utf8" },
      makeDirectoryAsync: async () => {},
      writeAsStringAsync: async (filePath) => {
        writes.push(filePath);
      },
      getInfoAsync: async () => ({ exists: true }),
    },
  })("src/reports/reportCsvExport.ts");

  await assert.rejects(
    () =>
      saveProgressClaimCsv({
        snapshot: createSnapshot(),
        userId: "user-a",
        documentId: "doc-1",
      }),
    /app-owned local report storage is unavailable/,
  );
  assert.deepEqual(writes, []);
});

test("saveProgressClaimCsv rejects when durable file verification fails after write", async () => {
  const writes = [];
  const { saveProgressClaimCsv } = createTsLoader({
    "expo-file-system/legacy": {
      documentDirectory: "file:///documents/",
      EncodingType: { UTF8: "utf8" },
      makeDirectoryAsync: async () => {},
      writeAsStringAsync: async (filePath) => {
        writes.push(filePath);
      },
      getInfoAsync: async () => ({ exists: false }),
    },
  })("src/reports/reportCsvExport.ts");

  await assert.rejects(
    () =>
      saveProgressClaimCsv({
        snapshot: createSnapshot(),
        userId: "user-a",
        documentId: "doc-1",
      }),
    /verification failed/,
  );
  assert.equal(writes.length, 1);
});

test("saveProgressClaimPdf rejects instead of archiving Expo print cache URI when copy is unavailable", async () => {
  const printCalls = [];
  const { saveProgressClaimPdf } = createTsLoader({
    "expo-file-system/legacy": {
      documentDirectory: "file:///documents/",
    },
    "expo-print": {
      printToFileAsync: async (params) => {
        printCalls.push(params);
        return { uri: "file:///cache/temporary-print-output.pdf" };
      },
    },
  })("src/reports/reportPdfExport.ts");

  await assert.rejects(
    () =>
      saveProgressClaimPdf({
        snapshot: createSnapshot(),
        userId: "user-a",
        documentId: "doc-1",
      }),
    /Durable report storage is unavailable/,
  );
  assert.equal(printCalls.length, 1);
});

test("saveProgressClaimPdf rejects when documentDirectory is blank before copying print cache URI", async () => {
  const copies = [];
  const { saveProgressClaimPdf } = createTsLoader({
    "expo-file-system/legacy": {
      documentDirectory: "   ",
      makeDirectoryAsync: async () => {},
      copyAsync: async (params) => {
        copies.push(params);
      },
      getInfoAsync: async () => ({ exists: true }),
    },
    "expo-print": {
      printToFileAsync: async () => ({ uri: "file:///cache/temporary-print-output.pdf" }),
    },
  })("src/reports/reportPdfExport.ts");

  await assert.rejects(
    () =>
      saveProgressClaimPdf({
        snapshot: createSnapshot(),
        userId: "user-a",
        documentId: "doc-1",
      }),
    /app-owned local report storage is unavailable/,
  );
  assert.deepEqual(copies, []);
});

test("saveProgressClaimPdf rejects when copied file verification fails", async () => {
  const copies = [];
  const { saveProgressClaimPdf } = createTsLoader({
    "expo-file-system/legacy": {
      documentDirectory: "file:///documents/",
      makeDirectoryAsync: async () => {},
      copyAsync: async (params) => {
        copies.push(params);
      },
      getInfoAsync: async () => ({ exists: false }),
    },
    "expo-print": {
      printToFileAsync: async () => ({ uri: "file:///cache/temporary-print-output.pdf" }),
    },
  })("src/reports/reportPdfExport.ts");

  await assert.rejects(
    () =>
      saveProgressClaimPdf({
        snapshot: createSnapshot(),
        userId: "user-a",
        documentId: "doc-1",
      }),
    /verification failed/,
  );
  assert.equal(copies.length, 1);
});

test("generateAndArchiveProgressClaim does not insert archive row when durable export rejects", async () => {
  const inserted = [];
  const { generateAndArchiveProgressClaim } = createTsLoader({
    "expo-file-system/legacy": {
      documentDirectory: "file:///documents/",
      EncodingType: { UTF8: "utf8" },
    },
    "expo-print": {
      printToFileAsync: async () => ({ uri: "file:///cache/report.pdf" }),
    },
  })("src/reports/progressClaimReportArchive.ts");

  await assert.rejects(
    () =>
      generateAndArchiveProgressClaim({
        type: "progress_claim_csv",
        userId: "user-a",
        repositories: {
          progressClaims: {
            buildLatestProgressClaimSnapshot: async () => createSnapshot(),
          },
          generatedDocuments: {
            insertGeneratedDocument: async (row) => {
              inserted.push(row);
            },
          },
        },
        createDocumentId: () => "doc-1",
        saveCsv: async () => {
          throw new Error("Durable report storage is unavailable.");
        },
      }),
    /Durable report storage is unavailable/,
  );
  assert.deepEqual(inserted, []);
});
