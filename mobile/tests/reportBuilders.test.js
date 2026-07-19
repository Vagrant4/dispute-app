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

function createSnapshot() {
  return {
    title: "Progress Claim Report",
    generatedAt: "2026-06-09T12:00:00.000Z",
    claimPeriod: { start: "2026-06-01", end: "2026-06-30" },
    worker: { name: "Asha Lim" },
    client: { name: "Acme, Pte Ltd" },
    project: {
      id: "project-1",
      name: "Shop \"A\" renovation",
      currency: "SGD",
      hourlyRateCents: 5000,
    },
    rateCalculation: {
      currency: "SGD",
      hourlyRateCents: 5000,
      dailyNormalMinutes: 480,
      normalWorkStartTime: "08:00",
      normalWorkEndTime: "17:00",
      overtimeMultiplier: 1.5,
      offDayMultiplier: 2,
      holidayMultiplier: 2,
    },
    totals: {
      totalDaysWorked: 1,
      totalNormalHours: 8,
      totalOvertimeHours: 1.5,
      totalOffDayHours: 0,
      totalHolidayHours: 0,
      basicPayCents: 40000,
      overtimePayCents: 11250,
      offDayPayCents: 0,
      holidayPayCents: 0,
      allowancesCents: 0,
      deductionsCents: 0,
      grossPayCents: 51250,
      netPayCents: 51250,
      totalClaimAmountCents: 51250,
    },
    dailyWorkLog: [
      {
        workDate: "2026-06-01",
        activity: "Installed cable, tested line\nready",
        normalHours: 8,
        overtimeHours: 1.5,
        offDayHours: 0,
        holidayHours: 0,
        dayTypes: ["normal"],
        locations: [
          {
            address: "10 Anson Road, Singapore 079903",
            latitude: 1.2765,
            longitude: 103.8458,
          },
        ],
        photoEvidenceIds: ["photo-1"],
      },
    ],
    photoEvidence: [
      {
        id: "photo-1",
        timeEntryId: "time-1",
        localUri: "file:///photo.jpg",
        caption: "Before, after, and \"done\"",
        evidenceType: "PROGRESS",
        capturedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
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

test("buildProgressClaimHtml includes clean report sections without signature or deductions", () => {
  const { buildProgressClaimHtml } = createTsLoader()(
    "src/reports/progressClaimHtml.ts",
  );

  const html = buildProgressClaimHtml(createSnapshot());

  for (const expected of [
    "Progress Claim Report",
    "Worker Profile",
    "Client / Company",
    "Project Details",
    "Claim Period",
    "Daily Work Log",
    "Photo Evidence",
    "Location Graphic",
    "10 Anson Road, Singapore 079903",
    "Rate Calculation",
    "Normal working time",
    "OT starts after 17:00",
    "Off day multiplier",
    "Holiday multiplier",
    "Pay Summary",
    "Photo Evidence ID",
    "Linked Time Entry ID",
    "time-1",
    "This app helps you record work, time, pay, and evidence for reference.",
    "It does not replace legal, accounting, or MOM advice.",
    "Generated report files are stored locally on this device",
  ]) {
    assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(html, /<h2>Signature<\/h2>/);
  assert.doesNotMatch(html, /Deductions/);
});

test("buildProgressClaimCsv escapes commas quotes and line breaks", () => {
  const { buildProgressClaimCsv } = createTsLoader()(
    "src/reports/progressClaimCsv.ts",
  );

  const csv = buildProgressClaimCsv(createSnapshot());

  assert.match(csv, /^Section,Field,Value/m);
  assert.match(csv, /Project,Name,"Shop ""A"" renovation"/);
  assert.match(csv, /Client,Name,"Acme, Pte Ltd"/);
  assert.match(csv, /Rate,Normal Work Start,08:00/);
  assert.match(csv, /Rate,Normal Work End,17:00/);
  assert.match(csv, /2026-06-01,normal,"Installed cable, tested line\nready","10 Anson Road, Singapore 079903 \(1.27650, 103.84580\)",8,1.5,0,0,photo-1/);
  assert.match(csv, /Photo Evidence,photo-1,time-1,"Before, after, and ""done"""/);
  assert.doesNotMatch(csv, /Deductions Cents/);
});
