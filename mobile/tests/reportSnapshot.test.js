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

test("buildProgressClaimSnapshot calculates short normal time and overtime from configured rates", () => {
  const { buildProgressClaimSnapshot } = createTsLoader()(
    "src/reports/progressClaimSnapshot.ts",
  );

  const shortTimeSnapshot = buildProgressClaimSnapshot({
    generatedAt: "2026-10-08T12:00:00.000Z",
    project: {
      name: "Six minute task",
      hourlyRateCents: 2500,
      currency: "SGD",
    },
    timeEntries: [
      {
        id: "time-short",
        workDate: "2026-10-08",
        startTime: "2026-10-08T08:00:00",
        endTime: "2026-10-08T08:06:00",
        durationMinutes: 6,
        activity: "Short task",
      },
    ],
    pay: {
      hourlyRateCents: 2500,
      normalWorkStartTime: "08:00",
      normalWorkEndTime: "16:00",
      overtimeMultiplier: 1.5,
    },
  });

  assert.equal(shortTimeSnapshot.totals.totalNormalHours, 0.1);
  assert.equal(shortTimeSnapshot.totals.basicPayCents, 250);
  assert.equal(shortTimeSnapshot.totals.totalClaimAmountCents, 250);

  const overtimeSnapshot = buildProgressClaimSnapshot({
    generatedAt: "2026-10-08T12:00:00.000Z",
    project: {
      name: "Overtime task",
      hourlyRateCents: 2500,
      currency: "SGD",
    },
    timeEntries: [
      {
        id: "time-overtime",
        workDate: "2026-10-08",
        startTime: "2026-10-08T08:00:00",
        endTime: "2026-10-08T17:30:00",
        durationMinutes: 570,
        activity: "Overtime task",
      },
    ],
    pay: {
      hourlyRateCents: 2500,
      normalWorkStartTime: "08:00",
      normalWorkEndTime: "16:00",
      overtimeMultiplier: 1.5,
    },
  });

  assert.equal(overtimeSnapshot.totals.totalNormalHours, 8);
  assert.equal(overtimeSnapshot.totals.totalOvertimeHours, 1.5);
  assert.equal(overtimeSnapshot.totals.basicPayCents, 20000);
  assert.equal(overtimeSnapshot.totals.overtimePayCents, 5625);
  assert.equal(overtimeSnapshot.totals.totalClaimAmountCents, 25625);
});

test("ProgressClaimSourceRepository builds hours with a zero-rate project", async () => {
  const { ProgressClaimSourceRepository } = createTsLoader()(
    "src/reports/progressClaimSourceRepository.ts",
  );
  const repository = new ProgressClaimSourceRepository(
    new FakeProgressClaimSourceDatabase(),
  );

  const snapshot = await repository.buildLatestProgressClaimSnapshot({
    userId: "rate-user",
    projectId: "project-zero",
    generatedAt: "2026-10-08T12:00:00.000Z",
  });
  assert.equal(snapshot.rateCalculation.hourlyRateCents, 0);
  assert.ok(snapshot.totals.totalNormalHours >= 0);
});

class FakeProgressClaimSourceDatabase {
  async getFirstAsync(sql) {
    if (/FROM app_settings/i.test(sql)) {
      return {
        currency: "SGD",
        daily_hours: 8,
        normal_work_start_time: "08:00",
        normal_work_end_time: "16:00",
        overtime_multiplier: 1.5,
        off_day_multiplier: 2,
        holiday_multiplier: 2,
      };
    }

    if (/FROM projects/i.test(sql)) {
      return {
        id: "project-zero",
        name: "Zero Rate Project",
        description: null,
        hourly_rate_cents: 0,
        currency: "SGD",
        client_id: "client-zero",
      };
    }

    if (/FROM clients/i.test(sql)) {
      return {
        name: "Demo Client",
        contact_name: null,
        contact_email: null,
      };
    }

    return null;
  }

  async getAllAsync(sql) {
    if (/FROM time_entries/i.test(sql)) {
      return [
        {
          id: "time-zero",
          work_date: "2026-10-08",
          start_time: "2026-10-08T08:00:00",
          end_time: "2026-10-08T08:06:00",
          duration_minutes: 6,
          activity: "Short task",
          day_type: "normal",
          location_text: null,
          clock_in_gps_latitude: null,
          clock_in_gps_longitude: null,
          clock_out_gps_latitude: null,
          clock_out_gps_longitude: null,
        },
      ];
    }
    return [];
  }
}
