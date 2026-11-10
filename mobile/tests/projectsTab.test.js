const assert = require("node:assert/strict");
const test = require("node:test");
const { createLoader, fixture, source, sqliteDatabase } = require("./locationTestHelpers");

for (const kind of ["sqlite", "web"]) {
  test(`${kind}: project summaries include weekly totals, latest GPS, photos, working and archived projects with owner isolation`, async () => {
    const { store, userId, projectId, database } = await fixture(kind);
    const client = (await store.listClients(userId))[0];
    const empty = await store.createProject({ userId, clientId: client.id, name: "Empty", hourlyRateCents: 0 });
    const finished = await store.createProject({ userId, clientId: client.id, name: "Finished", hourlyRateCents: 0 });
    await store.setProjectStatus(userId, finished.id, "archived");
    const otherClient = await store.createClient({ userId: "other", name: "Other" });
    const otherProject = await store.createProject({ userId: "other", clientId: otherClient.id, name: "Hidden", hourlyRateCents: 0 });
    for (const [start, stop] of [["2026-10-25T08:00:00Z", "2026-10-25T09:00:00Z"], ["2026-10-26T08:00:00Z", "2026-10-26T10:00:00Z"], ["2026-11-02T08:00:00Z", "2026-11-02T09:00:00Z"]]) {
      const entry = await store.clockIn({ userId, projectId, clockInAt: new Date(start), locationText: "Start site", gpsLatitude: 1.3, gpsLongitude: 103.8 });
      await store.clockOut({ userId, entryId: entry.id, clockOutAt: new Date(stop), locationText: "Stop site", gpsLatitude: 1.4, gpsLongitude: 103.9 });
    }
    const active = await store.clockIn({ userId, projectId, clockInAt: new Date("2026-11-03T08:00:00Z"), locationText: "Latest GPS site", gpsLatitude: 1.5, gpsLongitude: 104 });
    if (kind === "sqlite") {
      await database.runAsync("INSERT INTO photo_evidence (id,user_id,project_id,local_uri) VALUES (?, ?, ?, ?)", ["photo", userId, projectId, "file:///photo"]);
      await database.runAsync("INSERT INTO photo_evidence (id,user_id,project_id,local_uri) VALUES (?, ?, ?, ?)", ["foreign-photo", "other", otherProject.id, "file:///foreign"]);
    } else {
      global.localStorage.setItem(`dispute-web-saved-photo-evidence:${encodeURIComponent(userId)}`, JSON.stringify([{ project_id: projectId }]));
      global.localStorage.setItem("dispute-web-saved-photo-evidence:other", JSON.stringify([{ project_id: projectId }]));
    }
    const rows = await store.listProjectSummaries(userId, "2026-10-26");
    assert.equal(rows.length, 3);
    const summary = rows.find((row) => row.id === projectId);
    assert.equal(summary.minutesThisWeek, 120);
    assert.equal(summary.lastSiteAddress, "Latest GPS site");
    assert.equal(summary.lastWorkedAt, "2026-11-03T08:00:00.000Z");
    assert.equal(summary.photoCount, 1);
    assert.equal(summary.isActive, true);
    assert.equal(summary.status, "active");
    assert.equal(rows.find((row) => row.id === empty.id).minutesThisWeek, 0);
    assert.equal(rows.find((row) => row.id === empty.id).lastWorkedAt, null);
    assert.equal(rows.find((row) => row.id === finished.id).status, "archived");
    assert.equal((await store.listProjectEntries("other", projectId)).length, 0);
    await assert.rejects(() => store.setProjectStatus(userId, projectId, "archived"), /Stop work/);
    await store.clockOut({ userId, entryId: active.id, clockOutAt: new Date("2026-11-03T09:00:00Z") });
    await store.setProjectStatus(userId, projectId, "archived");
    await store.setProjectStatus(userId, projectId, "active");
    assert.equal((await store.listProjects(userId)).find((row) => row.id === projectId).status, "active");
  });
}

test("project navigation, site sheet, Today picker and one primary PDF action", () => {
  const today = source("src/screens/HomeScreen.tsx");
  for (const input of today.matchAll(/<TextInput[\s\S]*?\/>/g)) assert.doesNotMatch(input[0], /projectName|projectDescription|projectHourlyRate|Project name|Project description|Project hourly rate/);
  assert.match(today, /ProjectNameSheet/);
  assert.match(today, />Project<\/Text>[\s\S]*Choose a project/);
  assert.match(today, /accessibilityState=\{\{ disabled: isRunning \}\}/);
  assert.doesNotMatch(today, /TextInput/);
  assert.equal((source("src/screens/ProjectNameSheet.tsx").match(/<TextInput\b/g) || []).length, 2);
  const projects = source("src/screens/ProjectsScreen.tsx");
  assert.match(projects, /openProjectId/);
  assert.match(projects, /ProjectDetailScreen/);
  assert.match(projects, /\+ Add group/);
  const detail = source("src/screens/ProjectDetailScreen.tsx");
  assert.equal((detail.match(/Create &amp; share PDF/g) || []).length, 1);
  assert.match(detail, /ProgressClaimReportsScreen/);
  assert.match(detail, /testID="project-picker"/);
  assert.doesNotMatch(detail, /Project complete|Rename project|Reopen|onSeePhotos/);
  const reports = source("src/screens/ProgressClaimReportsScreen.tsx");
  assert.match(reports, /Earlier reports/);
  assert.match(reports, /payStep \? <ProjectPayCard/);
  assert.doesNotMatch(reports, /archived files|export formats|>Create PDF</);
  assert.doesNotMatch(reports, /handleGenerate\("progress_claim_pdf", project\.id\)/);
  assert.match(source("App.tsx"), /<ProjectsScreen/);
  assert.match(source("src/screens/PhotoEvidenceScreen.tsx"), /initialProjectId/);
});

test("tab ids remain stable and labels become Today Photos Projects Settings", () => {
  const { tabs } = createLoader()("src/screenContent.ts");
  assert.deepEqual(tabs.map((tab) => tab.id), ["home", "evidence", "reports", "settings"]);
  assert.deepEqual(tabs.map((tab) => tab.label), ["Today", "Photos", "Projects", "Settings"]);
});

test("Projects uses bundled back and filter glyphs and title-case statuses", () => {
  const projects = source("src/screens/ProjectsScreen.tsx");
  const detail = source("src/screens/ProjectDetailScreen.tsx");
  assert.match(projects, /name="arrow-back"/);
  assert.match(projects, /name="tune"/);
  for (const label of ["Lead", "Active", "Completed"]) assert.ok(detail.includes(label));
});

test("needsPayStep only asks when both rate and saved work hours are absent", () => {
  const { needsPayStep, currentWeekStart } = createLoader({ "react-native": { Platform: { OS: "web" } } })("src/work/projectScreenStore.ts");
  assert.equal(needsPayStep({ hourlyRateCents: 0, hasWorkHours: false }), true);
  for (const values of [{ hourlyRateCents: 2000, hasWorkHours: false }, { hourlyRateCents: 0, hasWorkHours: true }, { hourlyRateCents: 2000, hasWorkHours: true }]) assert.equal(needsPayStep(values), false);
  assert.equal(currentWeekStart(new Date("2026-10-25T16:00:00Z")), "2026-10-26");
  assert.equal(currentWeekStart(new Date("2026-10-25T15:59:00Z")), "2026-10-19");
});

test("pay preferences distinguish default reads from saves, survive backup and remain scoped", async () => {
  const load = createLoader();
  const db = sqliteDatabase();
  const { MOBILE_SCHEMA_SQL, LOCAL_MIGRATIONS } = load("src/db/schema.ts");
  db.sqlite.exec(MOBILE_SCHEMA_SQL);
  const settings = new (load("src/db/settingsRepository.ts").SettingsRepository)(db);
  await settings.getSettings("a");
  assert.deepEqual(await settings.getReportPreferences("a"), { hasWorkHours: false, reportName: "" });
  await settings.updateSettings({ normalWorkStartTime: "09:00" }, "a");
  await settings.saveReportPreferences("a", "Report Worker");
  assert.deepEqual(await settings.getReportPreferences("a"), { hasWorkHours: true, reportName: "Report Worker" });
  assert.deepEqual(await settings.getReportPreferences("b"), { hasWorkHours: false, reportName: "" });
  const backup = new (load("src/backup/backupRepository.ts").BackupRepository)(db);
  const tables = await backup.exportTables("a");
  await backup.applyBackup({ tables }, "a");
  assert.equal((await settings.getReportPreferences("a")).reportName, "Report Worker");
  const migrated = sqliteDatabase();
  for (const migration of LOCAL_MIGRATIONS) migrated.sqlite.exec(migration.sql);
  const columns = (database) => database.sqlite.prepare("PRAGMA table_info(app_settings)").all().map((column) => column.name).sort();
  assert.deepEqual(columns(db), columns(migrated));
});

test("web shared work-hours save persists multipliers and the saved report name", async () => {
  const values = new Map();
  global.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const load = createLoader({ "react-native": { Platform: { OS: "web" } } });
  const { loadWorkHours, saveWorkHours } = load("src/work/workHoursSettings.ts");
  assert.equal((await loadWorkHours("a")).hasWorkHours, false);
  await saveWorkHours("a", { normalWorkStartTime: "09:00", overtimeMultiplier: 1.75 }, "Alice");
  assert.equal((await loadWorkHours("a")).hasWorkHours, true);
  assert.equal((await loadWorkHours("a")).settings.overtimeMultiplier, 1.75);
  assert.equal((await loadWorkHours("b")).hasWorkHours, false);
  const { webWorkStore, buildWebWorkProgressClaimSnapshot } = load("src/work/webWorkStore.ts");
  const client = await webWorkStore.createClient({ userId: "a", name: "Client" });
  const project = await webWorkStore.createProject({ userId: "a", clientId: client.id, name: "Job", hourlyRateCents: 2000 });
  assert.equal(buildWebWorkProgressClaimSnapshot({ userId: "a", projectId: project.id }).worker.name, "Alice");
  assert.match(source("src/screens/SettingsScreen.tsx"), /saveWorkHours\(userId/);
  assert.match(source("src/screens/ProgressClaimReportsScreen.tsx"), /accountName: account\.isGuest \? undefined : account\.name/);
});


test("weekly project reports share the calculation utility, scope sessions/photos and prefer account then report name", () => {
  const { buildProjectWeekReport } = createLoader()("src/reports/projectWeekReport.ts");
  const input = { project: { id: "job", hourlyRateCents: 2000 }, timeEntries: [
    { id: "old", workDate: "2026-10-25", durationMinutes: 60, activity: "Before week" },
    { id: "in", workDate: "2026-10-26", durationMinutes: 600, activity: "This week" },
    { id: "next", workDate: "2026-11-02", durationMinutes: 60, activity: "Next week" },
  ], photoEvidence: [{ id: "old", localUri: "old", capturedAt: "2026-10-25T00:00:00Z" }, { id: "in", localUri: "in", capturedAt: "2026-10-26T00:00:00Z" }], pay: { hourlyRateCents: 2000, dailyNormalMinutes: 480 } };
  const make = (accountName, reportName) => buildProjectWeekReport({ input, weekStart: "2026-10-26", accountName, reportName });
  const report = make(" Account ", "Saved");
  assert.equal(report.worker.name, "Account");
  assert.equal(make("", "Saved").worker.name, "Saved");
  assert.equal(make("", "").worker.name, "Worker");
  assert.deepEqual(report.claimPeriod, { start: "2026-10-26", end: "2026-11-01" });
  assert.equal(report.dailyWorkLog.length, 1);
  assert.equal(report.photoEvidence.length, 1);
  assert.equal(report.totals.totalNormalHours, 8);
  assert.equal(report.totals.totalOvertimeHours, 2);
  assert.equal(report.totals.totalClaimAmountCents, 22000);
});

test("native report source uses the saved report name and project archives filter before their limit", async () => {
  const { load, database, store, userId, projectId } = await fixture("sqlite");
  const settings = new (load("src/db/settingsRepository.ts").SettingsRepository)(database);
  await settings.getSettings(userId);
  await settings.saveReportPreferences(userId, "Saved Worker");
  const sourceRepository = new (load("src/reports/progressClaimSourceRepository.ts").ProgressClaimSourceRepository)(database);
  assert.equal((await sourceRepository.buildLatestProgressClaimSnapshot({ userId, projectId })).worker.name, "Saved Worker");
  const client = (await store.listClients(userId))[0];
  const other = await store.createProject({ userId, clientId: client.id, name: "Another job", hourlyRateCents: 0 });
  for (let index = 0; index < 12; index++) {
    await database.runAsync("INSERT INTO generated_documents (id,user_id,project_id,document_type,file_name,created_at) VALUES (?, ?, ?, ?, ?, ?)", ["doc-" + index, userId, index === 0 ? projectId : other.id, "progress_claim_pdf", "report.pdf", `2026-10-${String(index + 1).padStart(2, "0")}`]);
  }
  const repository = new (load("src/reports/generatedDocumentRepository.ts").GeneratedDocumentRepository)(database);
  const rows = await repository.listRecentGeneratedDocuments({ userId, projectId, limit: 1 });
  assert.deepEqual(rows.map((row) => row.id), ["doc-0"]);
  assert.equal((await repository.listRecentGeneratedDocuments({ userId: "other", projectId, limit: 1 })).length, 0);
});

test("Projects exposes search and status/group filters", () => {
  const projects = source("src/screens/ProjectsScreen.tsx");
  assert.match(projects, /Search name or address/);
  assert.match(projects, /statusFilter/);
  assert.match(projects, /groupFilter/);
});

test("Projects main title is skipped for minimal detail", () => {
  const projects = source("src/screens/ProjectsScreen.tsx");
  assert.ok(projects.indexOf("if (openProjectId) return <ProjectDetailScreen") < projects.indexOf(">Projects</Text>"));
  assert.match(projects, /<Text style=\{styles.screenTitle\}>Projects<\/Text>/);
  const detail = source("src/screens/ProjectDetailScreen.tsx");
  assert.match(detail, /testID="project-picker"[\s\S]*project\?\.name/);
  assert.doesNotMatch(detail, /styles.screenTitle/);
  assert.doesNotMatch(detail, /projectRenameButton|toggleFinished/);
});
