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
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
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

test("buildProgressClaimSnapshot totals days hours overtime and claim amount", () => {
  const { buildProgressClaimSnapshot } = createTsLoader()(
    "src/reports/progressClaimSnapshot.ts",
  );

  const snapshot = buildProgressClaimSnapshot({
    generatedAt: "2026-06-09T12:00:00.000Z",
    claimPeriod: {
      start: "2026-06-01",
      end: "2026-06-30",
    },
    worker: {
      name: "Asha Lim",
      email: "asha@example.com",
      phone: "+65 8123 4567",
    },
    client: {
      name: "Acme Pte Ltd",
      contactName: "Tan Manager",
      contactEmail: "tan@example.com",
    },
    project: {
      id: "project-1",
      name: "Shop renovation",
      description: "Electrical and finishing work",
      hourlyRateCents: 5000,
      currency: "SGD",
    },
    timeEntries: [
      {
        id: "time-1",
        workDate: "2026-06-01",
        startTime: "2026-06-01T08:00:00",
        endTime: "2026-06-01T19:00:00",
        durationMinutes: 600,
        activity: "Installed lighting, quoted \"Phase A\"",
        locationText: "10 Anson Road, Singapore 079903",
        clockInGpsLatitude: 1.2765,
        clockInGpsLongitude: 103.8458,
      },
      {
        id: "time-2",
        workDate: "2026-06-02",
        startTime: "2026-06-02T09:00:00",
        endTime: "2026-06-02T13:00:00",
        durationMinutes: 240,
        activity: "Testing and cleanup",
      },
    ],
    photoEvidence: [
      {
        id: "photo-1",
        timeEntryId: "time-1",
        localUri: "file:///photos/progress.jpg",
        caption: "Progress photo",
        evidenceType: "PROGRESS",
        capturedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
    pay: {
      dailyNormalMinutes: 480,
      normalWorkStartTime: "08:00",
      normalWorkEndTime: "17:00",
      overtimeMultiplier: 1.5,
      offDayMultiplier: 2,
      holidayMultiplier: 2,
      allowancesCents: 10000,
      deductionsCents: 5000,
    },
  });

  assert.equal(snapshot.title, "Progress Claim Report");
  assert.equal(snapshot.totals.totalDaysWorked, 2);
  assert.equal(snapshot.totals.totalNormalHours, 12);
  assert.equal(snapshot.totals.totalOvertimeHours, 2);
  assert.equal(snapshot.totals.totalOffDayHours, 0);
  assert.equal(snapshot.totals.totalHolidayHours, 0);
  assert.equal(snapshot.totals.basicPayCents, 60000);
  assert.equal(snapshot.totals.overtimePayCents, 15000);
  assert.equal(snapshot.totals.offDayPayCents, 0);
  assert.equal(snapshot.totals.holidayPayCents, 0);
  assert.equal(snapshot.totals.grossPayCents, 85000);
  assert.equal(snapshot.totals.netPayCents, 80000);
  assert.equal(snapshot.totals.totalClaimAmountCents, 80000);
  assert.equal(snapshot.dailyWorkLog.length, 2);
  assert.equal(snapshot.dailyWorkLog[0].normalHours, 8);
  assert.equal(snapshot.dailyWorkLog[0].overtimeHours, 2);
  assert.deepEqual(snapshot.dailyWorkLog[0].dayTypes, ["normal"]);
  assert.deepEqual(snapshot.dailyWorkLog[0].locations, [
    {
      address: "10 Anson Road, Singapore 079903",
      latitude: 1.2765,
      longitude: 103.8458,
    },
  ]);
  assert.equal(snapshot.rateCalculation.normalWorkStartTime, "08:00");
  assert.equal(snapshot.rateCalculation.normalWorkEndTime, "17:00");
  assert.equal(snapshot.dailyWorkLog[0].photoEvidenceIds[0], "photo-1");
  assert.match(snapshot.disclaimer, /does not replace legal, accounting, or MOM advice/);
  assert.deepEqual(snapshot.signature, {
    workerSignature: "",
    clientAcknowledgement: "",
    signedAt: "",
  });
});

test("buildProgressClaimSnapshot applies off day and holiday multipliers to marked entries", () => {
  const { buildProgressClaimSnapshot } = createTsLoader()(
    "src/reports/progressClaimSnapshot.ts",
  );

  const snapshot = buildProgressClaimSnapshot({
    generatedAt: "2026-06-09T12:00:00.000Z",
    project: {
      name: "Special rate work",
      hourlyRateCents: 5000,
      currency: "SGD",
    },
    timeEntries: [
      {
        id: "time-off",
        workDate: "2026-06-06",
        startTime: "2026-06-06T08:00:00",
        endTime: "2026-06-06T12:00:00",
        durationMinutes: 240,
        activity: "Off day urgent work",
        dayType: "off_day",
      },
      {
        id: "time-holiday",
        workDate: "2026-06-07",
        startTime: "2026-06-07T08:00:00",
        endTime: "2026-06-07T11:00:00",
        durationMinutes: 180,
        activity: "Holiday repair work",
        dayType: "holiday",
      },
    ],
    pay: {
      hourlyRateCents: 5000,
      offDayMultiplier: 2,
      holidayMultiplier: 3,
    },
  });

  assert.equal(snapshot.totals.totalNormalHours, 0);
  assert.equal(snapshot.totals.totalOvertimeHours, 0);
  assert.equal(snapshot.totals.totalOffDayHours, 4);
  assert.equal(snapshot.totals.totalHolidayHours, 3);
  assert.equal(snapshot.totals.offDayPayCents, 40000);
  assert.equal(snapshot.totals.holidayPayCents, 45000);
  assert.equal(snapshot.totals.grossPayCents, 85000);
  assert.equal(snapshot.totals.totalClaimAmountCents, 85000);
  assert.deepEqual(snapshot.dailyWorkLog[0].dayTypes, ["off_day"]);
  assert.deepEqual(snapshot.dailyWorkLog[1].dayTypes, ["holiday"]);
});
