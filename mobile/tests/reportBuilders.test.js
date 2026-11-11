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
      siteAddress: "10 Anson Road, Singapore 079903",
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
  assert.match(html, /Address: 10 Anson Road, Singapore 079903/);
  const noAddress = createSnapshot();
  noAddress.project.siteAddress = null;
  assert.match(buildProgressClaimHtml(noAddress), /Address: None/);

  for (const expected of [
    "Progress Claim Report",
    "Worker Profile",
    "Client / Company",
    "Project Details",
    "Claim Period",
    "Daily Work Log",
    "Photo Evidence",
    "Work sites",
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

test("former-lead project reports omit retired discovery labels and retain Address", () => {
  const { buildProgressClaimHtml } = createTsLoader()(
    "src/reports/progressClaimHtml.ts",
  );
  const html = buildProgressClaimHtml(createSnapshot());
  assert.match(html, /Address: 10 Anson Road, Singapore 079903/);
  assert.doesNotMatch(html, /Lead|Group/);
});

test("buildProgressClaimHtml renders the revised palette, dynamic overview, and print-safe page rules", () => {
  const { buildProgressClaimHtml } = createTsLoader()(
    "src/reports/progressClaimHtml.ts",
  );
  const snapshot = createSnapshot();
  snapshot.totals.totalClaimAmountCents = 98765;
  snapshot.totals.totalDaysWorked = 7;
  snapshot.claimPeriod = { start: "2026-07-01", end: "2026-07-31" };

  const html = buildProgressClaimHtml(snapshot);

  assert.match(html, /#102447/);
  assert.match(html, /#2f6fed/);
  assert.match(html, /#f2a900/);
  assert.match(html, /SGD 987\.65/);
  assert.match(html, />7<\/strong>/);
  assert.match(html, /1 Jul 2026 &ndash; 31 Jul 2026/);
  assert.match(html, /@page \{ margin: 18mm 14mm; size: A4; \}/);
  assert.match(html, /thead \{ display: table-header-group; \}/);
  assert.match(html, /page-break-inside: avoid/);
  assert.match(html, /\.long-token \{ overflow-wrap: break-word; word-break: normal/);
  assert.match(html, /tr, \.report-section \{[^}]*page-break-inside: avoid/);
});

test("buildProgressClaimHtml embeds printable photos and keeps unsupported references as placeholders", () => {
  const { buildProgressClaimHtml } = createTsLoader()(
    "src/reports/progressClaimHtml.ts",
  );
  const snapshot = createSnapshot();
  snapshot.photoEvidence.push({
    id: "photo-2",
    localUri: "https://example.invalid/photo.jpg",
    caption: "Remote reference",
  });
  snapshot.photoEvidence[0].printUri = "data:image/jpeg;base64,aW1hZ2U=";
  snapshot.photoEvidence[0].localUri = "data:image/jpeg;base64,aW1hZ2U=";

  const html = buildProgressClaimHtml(snapshot);

  assert.match(html, /src="data:image\/jpeg;base64,aW1hZ2U="/);
  assert.match(html, /alt="Photo evidence photo-1"/);
  assert.match(html, /Embedded image data/);
  assert.doesNotMatch(html, />data:image\/jpeg;base64,aW1hZ2U=<\/td>/);
  assert.match(html, /Photo file reference only/);
  assert.match(html, /\.photo-card \{[^}]*page-break-inside: avoid/s);
});

test("buildProgressClaimHtml never sends raw local photo URIs to the print WebView", () => {
  const { buildProgressClaimHtml } = createTsLoader()(
    "src/reports/progressClaimHtml.ts",
  );
  const snapshot = createSnapshot();
  snapshot.photoEvidence[0].printUri = undefined;

  const html = buildProgressClaimHtml(snapshot);

  assert.doesNotMatch(html, /src="file:\/\//);
  assert.doesNotMatch(html, /src="content:\/\//);
  assert.match(html, /Photo file reference only/);
});

test("buildProgressClaimHtml uses print-safe wrapping, local dates, and sealed phone labels", () => {
  const { buildProgressClaimHtml } = createTsLoader()("src/reports/progressClaimHtml.ts");
  const snapshot = createSnapshot();
  snapshot.generatedAt = "2026-11-11T15:04:00.000Z";
  snapshot.claimPeriod = { start: "2026-11-10", end: "2026-11-11" };
  snapshot.photoEvidence[0].localUri = "file:///private/photo.jpg";
  snapshot.photoEvidence[0].capturedAt = "2026-11-11T06:25:09.379Z";
  const html = buildProgressClaimHtml(snapshot);
  assert.doesNotMatch(html, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(html, /file:\/\//);
  assert.match(html, /10 Nov 2026/);
  assert.match(html, /Sealed photo on this phone/);
});

test("daily work log uses per-day cards and every report table declares widths", () => {
  const { buildProgressClaimHtml } = createTsLoader()("src/reports/progressClaimHtml.ts");
  const html = buildProgressClaimHtml(createSnapshot());
  assert.match(html, /class="daily-log-card"/);
  assert.match(html, /class="daily-log-date short-cell">1 Jun 2026/);
  assert.doesNotMatch(html, /<table\b[^>]*>(?!\s*<colgroup)/);
  assert.doesNotMatch(html, /overflow:\s*hidden|word-break:\s*break-all/);
  assert.doesNotMatch(html, />2026-\d{2}-\d{2}</);
});

test("report lunch deduction is report-time only and per-day cents remain the summary", () => {
  const { buildProgressClaimSnapshot } = createTsLoader()("src/reports/progressClaimSnapshot.ts");
  const snapshot = buildProgressClaimSnapshot({
    timeEntries: [
      { id: "full", workDate: "2026-11-11", startTime: "2026-11-11T08:00:00+08:00", endTime: "2026-11-11T17:00:00+08:00", durationMinutes: 540, activity: "full" },
      { id: "short", workDate: "2026-11-12", startTime: "2026-11-12T09:00:00+08:00", endTime: "2026-11-12T11:00:00+08:00", durationMinutes: 120, activity: "short" },
    ],
    pay: { rateBasis: "hourly", baseRateCents: 1000, hourlyRateCents: 1000, normalWorkStartTime: "08:00", normalWorkEndTime: "17:00", lunchMinutes: 60 },
  });
  assert.equal(snapshot.dailyWorkLog[0].normalHours, 8);
  assert.equal(snapshot.dailyWorkLog[0].lunchDeductedMinutes, 60);
  assert.equal(snapshot.dailyWorkLog[1].normalHours, 2);
  assert.equal(snapshot.dailyWorkLog[1].lunchDeductedMinutes, 0);
  assert.equal(snapshot.dailyWorkLog.reduce((sum, day) => sum + day.grossPayCents, 0), snapshot.totals.grossPayCents);
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


test("work sites group addresses by distinct day; GPS appendix retains both phases and refresh evidence", () => {
  const load = createTsLoader();
  const { buildProgressClaimSnapshot } = load("src/reports/progressClaimSnapshot.ts");
  const { buildProgressClaimHtml } = load("src/reports/progressClaimHtml.ts");
  const { buildProgressClaimCsv } = load("src/reports/progressClaimCsv.ts");
  const entry = {
    id: "first", workDate: "2026-10-26", durationMinutes: 60, activity: "Work",
    locationText: "Site <A>", clockOutLocationText: "Site <A>",
    clockInGpsLatitude: 1.2, clockInGpsLongitude: 103.4,
    clockOutGpsLatitude: 1.2, clockOutGpsLongitude: 103.4,
    clockInGpsAccuracyM: 5, clockOutGpsAccuracyM: 6,
    clockInLocationSource: "gps", clockOutLocationSource: "gps",
    clockInLocatedAt: "2026-10-26T01:00:00Z", clockOutLocatedAt: "2026-10-26T02:00:00Z",
    locationHistoryJson: JSON.stringify([{ phase: "start", source: "gps", address: "Site <A>", latitude: 1.3, longitude: 103.5, accuracy: 4, locatedAt: "2026-10-26T01:30:00Z" }]),
  };
  const snapshot = buildProgressClaimSnapshot({ timeEntries: [entry, { ...entry, id: "second", workDate: "2026-10-27", locationHistoryJson: null }] });
  const html = buildProgressClaimHtml(snapshot);
  assert.match(html, /<h2>Work sites<\/h2>/);
  assert.doesNotMatch(html, /Location Graphic|location-map|location-grid|maps\.google|openstreetmap/);
  assert.match(html, /<td>Site &lt;A&gt;<\/td><td class="short-cell">2<\/td><td class="short-cell">26 Oct 2026<\/td><td class="short-cell">27 Oct 2026<\/td>/);
  const workLog = html.split("<h2>Daily Work Log</h2>")[1].split("<h2>Work sites</h2>")[0];
  assert.doesNotMatch(workLog, /1\.20000|103\.40000|T01:00/);
  assert.match(workLog, /GPS ±5 m/);
  assert.match(html, /2026-10-26 · start · 1\.20000, 103\.40000 · ±5 m · gps/);
  assert.match(html, /2026-10-26 · stop · 1\.20000, 103\.40000 · ±6 m · gps/);
  assert.match(html, /2026-10-26 · start · 1\.30000, 103\.50000 · ±4 m · gps/);
  const csv = buildProgressClaimCsv(snapshot);
  assert.match(csv, /location_note,start_lat,start_lng,stop_lat,stop_lng/);
  assert.match(csv, /,1\.2,103\.4,1\.2,103\.4/);
  assert.doesNotMatch(csv, /Local Storage,Notice/);
});

test("report renders exact minute totals, print-safe photo timestamps, and local GPS evidence", () => {
  const load = createTsLoader();
  const { buildProgressClaimSnapshot } = load("src/reports/progressClaimSnapshot.ts");
  const { buildProgressClaimHtml } = load("src/reports/progressClaimHtml.ts");
  const snapshot = buildProgressClaimSnapshot({
    timeEntries: [
      { id: "shi-normal", workDate: "2026-11-10", startTime: "2026-11-10T08:00:00+08:00", endTime: "2026-11-10T08:02:00+08:00", durationMinutes: 2, activity: "Opening check", locationText: "10 Anson Road, Singapore 079903", clockOutLocationText: "10 Anson Road, Singapore 079903", clockInLocationSource: "gps", clockOutLocationSource: "gps", clockInGpsLatitude: 1.27651, clockInGpsLongitude: 103.84581, clockOutGpsLatitude: 1.27652, clockOutGpsLongitude: 103.84582, clockInGpsAccuracyM: 4.4, clockOutGpsAccuracyM: 6.2, clockInLocatedAt: "2026-11-10T08:58:00.000Z", clockOutLocatedAt: "2026-11-10T09:00:00.000Z" },
      { id: "shi-ot", workDate: "2026-11-11", startTime: "2026-11-11T17:00:00+08:00", endTime: "2026-11-11T20:10:00+08:00", durationMinutes: 190, activity: "Overtime repair", locationText: "10 Anson Road, Singapore 079903", clockInLocationSource: "gps", clockInGpsLatitude: 1.27651, clockInGpsLongitude: 103.84581, clockInGpsAccuracyM: 5, clockInLocatedAt: "2026-11-11T09:00:00.000Z" },
    ],
    photoEvidence: [{ id: "photo-123456789012345678", timeEntryId: "shi-normal", localUri: "file:///photo.jpg", evidenceType: "DURING_WORK", captureSource: "camera", capturedAt: "2026-11-11T06:25:09.379Z" }],
    pay: { rateBasis: "daily", baseRateCents: 15000, normalWorkStartTime: "08:00", normalWorkEndTime: "17:00", overtimeMultiplier: 1.5 },
  });
  const html = buildProgressClaimHtml(snapshot);

  assert.equal(snapshot.totals.totalNormalMinutes, 2);
  assert.equal(snapshot.totals.totalOvertimeMinutes, 190);
  assert.equal(snapshot.totals.basicPayCents, 56);
  assert.equal(snapshot.totals.overtimePayCents, 7917);
  for (const text of ["2 min", "3 h 10 min", "SGD 0.56", "SGD 79.17", "During work", "camera", "10 Nov 2026, 4:58 pm GMT+8"]) assert.match(html, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(html, /<td class="short-cell">11 Nov 2026,/);
  assert.match(html, /<col style="width:26%"><col style="width:20%"><col style="width:14%"><col style="width:20%"><col style="width:20%">/);
  assert.match(html, /1\.27651, 103\.84581 · ±4 m · gps · 10 Nov 2026, 4:58 pm GMT\+8/);
  assert.match(html, /<h2>Work sites<\/h2>[\s\S]*10 Anson Road, Singapore 079903/);

  for (const table of html.match(/<table>[\s\S]*?<\/table>/g) ?? []) {
    const widths = [...table.matchAll(/<col style="width:(\d+)%">/g)].map((match) => Number(match[1]));
    const cells = [...table.matchAll(/<td class="short-cell">([^<]*)<\/td>/g)];
    for (const cell of cells) {
      const before = table.slice(0, cell.index);
      const column = (before.match(/<t[dh][^>]*>/g) ?? []).length % widths.length;
      const characterBudget = Math.floor((690 * widths[column] / 100) / 6.5);
      assert.ok(cell[1].length <= characterBudget, `${cell[1]} exceeds ${characterBudget} characters in column ${column + 1}`);
    }
  }
});
