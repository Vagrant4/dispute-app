const assert = require("node:assert/strict");
const test = require("node:test");
const { createLoader, fixture, source, sqliteDatabase } = require("./locationTestHelpers");
test("Home has a GPS chip without typed location input", () => {
  const home = source("src/screens/HomeScreen.tsx");
  for (const input of home.matchAll(/<TextInput[\s\S]*?\/>/g)) assert.doesNotMatch(input[0], /value=\{location|setLocationText|site address/i);
  assert.doesNotMatch(home, /TextInput/);
  assert.doesNotMatch(home, /formatLocationRow\(locationFix,/);
  assert.doesNotMatch(home, /GPS attached:|toFixed\(5\)/);
  assert.ok(home.indexOf("await store.clockIn(") < home.indexOf("await getWorkLocationWithTimeout(20_000)"));
});
for (const kind of ["sqlite", "web"]) {
  test(`${kind}: no fix means none and no address, late start fix cannot change a stopped entry`, async () => {
    const { store, userId, projectId } = await fixture(kind);
    const entry = await store.clockIn({ userId, projectId, clockInAt: new Date(Date.now() - 60_000), locationText: "Typed address" });
    assert.equal(entry.clockInLocationSource, "none");
    assert.ok(!entry.locationText);
    await store.clockOut({ userId, entryId: entry.id });
    assert.equal(await store.completeStartLocation({ userId, entryId: entry.id, gpsLatitude: 1, gpsLongitude: 2 }), false);
  });
  test(`${kind}: initial GPS patch records source accuracy time and refresh appends without overwriting`, async () => {
    const { store, userId, projectId } = await fixture(kind);
    const entry = await store.clockIn({ userId, projectId });
    const first = new Date().toISOString();
    assert.equal(await store.completeStartLocation({ userId, entryId: entry.id, locationText: "A", gpsLatitude: 1, gpsLongitude: 2, gpsAccuracyM: 8, locatedAt: first }), true);
    await store.refreshLocation({ userId, entryId: entry.id, phase: "start", locationText: "B", gpsLatitude: 3, gpsLongitude: 4, gpsAccuracyM: 60, locatedAt: first });
    await store.refreshLocation({ userId, entryId: entry.id, phase: "start" });
    const saved = (await store.getHomeState(userId)).activeEntry;
    assert.equal(saved.locationText, "A");
    assert.equal(saved.clockInLocationSource, "gps");
    assert.equal(saved.clockInGpsAccuracyM, 8);
    assert.equal(saved.clockInLocatedAt, first);
    const history = JSON.parse(saved.locationHistoryJson);
    assert.equal(history.length, 2);
    assert.equal(history[0].address, "B");
    assert.equal(history[1].source, "none");
    await store.saveLocationNote({ userId, entryId: entry.id, note: "Worker note" });
    assert.equal((await store.getHomeState(userId)).activeEntry.locationNote, "Worker note");
  });
  test(`${kind}: refresh is scoped by owner and current phase and expires after ten minutes`, async () => {
    const { store, userId, projectId } = await fixture(kind);
    const entry = await store.clockIn({ userId, projectId, clockInAt: new Date(Date.now() - 1_200_000) });
    await assert.rejects(() => store.refreshLocation({ userId: "other", entryId: entry.id, phase: "start" }));
    await assert.rejects(() => store.refreshLocation({ userId, entryId: entry.id, phase: "stop" }));
    await store.clockOut({ userId, entryId: entry.id, clockOutAt: new Date(Date.now() - 660_000) });
    await assert.rejects(() => store.refreshLocation({ userId, entryId: entry.id, phase: "stop" }));
  });
}
test("PDF labels GPS, no-fix, legacy and worker notes; CSV appends the five columns", () => {
  const load = createLoader();
  const snapshot = load("src/reports/progressClaimSnapshot.ts").buildProgressClaimSnapshot({ timeEntries: [
    { id: "a", workDate: "2026-10-29", activity: "Work", durationMinutes: 60, clockInLocationSource: "none", clockOutLocationSource: "gps", clockOutLocationText: "Site B", clockOutGpsLatitude: 1, clockOutGpsLongitude: 2, clockOutGpsAccuracyM: 75, locationNote: "Closed gate <outside>", locationHistoryJson: JSON.stringify([{ phase: "start", source: "gps", address: "Site A", latitude: 3, longitude: 4, accuracy: 8, locatedAt: "2026-10-29T01:00:00Z" }]) },
    { id: "b", workDate: "2026-10-28", activity: "Older", durationMinutes: 60, locationText: "Old site" },
  ] });
  const html = load("src/reports/progressClaimHtml.ts").buildProgressClaimHtml(snapshot);
  assert.match(html, /Typed by worker, not GPS: Closed gate &lt;outside&gt;/);
  assert.match(html, /No GPS fix/);
  assert.match(html, /Source not recorded \(older record\)/);
  assert.match(html, /GPS ±75 m · approximate/);
  assert.match(html, /Site A/);
  const csv = load("src/reports/progressClaimCsv.ts").buildProgressClaimCsv(snapshot);
  const header = csv.split("\n").find((line) => line.startsWith("Work Log,Date"));
  assert.ok(header.endsWith("start_source,stop_source,start_accuracy_m,stop_accuracy_m,location_note,start_lat,start_lng,stop_lat,stop_lng"));
  assert.match(csv, /none,gps,,75,Closed gate <outside>/);
});
test("fresh schema and every migration have matching columns; legacy and backup round trip retain provenance", async () => {
  const load = createLoader();
  const schema = load("src/db/schema.ts");
  const fresh = sqliteDatabase();
  fresh.sqlite.exec(schema.MOBILE_SCHEMA_SQL);
  const migrated = sqliteDatabase();
  for (const migration of schema.LOCAL_MIGRATIONS.slice(0, -1)) migrated.sqlite.exec(migration.sql);
  migrated.sqlite.exec(`INSERT INTO clients (id,user_id,name) VALUES ('c','u','Client');
    INSERT INTO projects (id,user_id,client_id,name) VALUES ('p','u','c','Project');
    INSERT INTO time_entries (id,user_id,project_id,work_date,duration_minutes,activity,location_text) VALUES ('old','u','p','2026-10-29',60,'Work','Older site');`);
  migrated.sqlite.exec(schema.LOCAL_MIGRATIONS.at(-1).sql);
  const legacy = migrated.sqlite.prepare("SELECT * FROM time_entries WHERE id = 'old' AND user_id = 'u'").get();
  assert.equal(legacy.location_text, "Older site");
  assert.equal(legacy.clock_in_location_source, "legacy");
  assert.equal(legacy.clock_out_location_source, "legacy");
  const columns = (db) => db.sqlite.prepare("PRAGMA table_info(time_entries)").all().map((c) => c.name).sort();
  assert.deepEqual(columns(fresh), columns(migrated));
  for (const column of ["clock_out_location_text", "clock_in_location_source", "clock_out_location_source", "clock_in_gps_accuracy_m", "clock_out_gps_accuracy_m", "clock_in_located_at", "clock_out_located_at", "location_note", "location_history_json"]) {
    assert.ok(columns(fresh).includes(column));
    assert.match(schema.LOCAL_MIGRATIONS.find((migration) => migration.name === "location_evidence").sql, new RegExp(column));
  }
  const { database, store, userId, projectId } = await fixture();
  const entry = await store.clockIn({ userId, projectId, clockInAt: new Date(Date.now() - 60_000), locationText: "Site", gpsLatitude: 1, gpsLongitude: 2, gpsAccuracyM: 9 });
  await store.refreshLocation({ userId, entryId: entry.id, phase: "start", gpsLatitude: 3, gpsLongitude: 4 });
  await store.saveLocationNote({ userId, entryId: entry.id, note: "Worker note" });
  await store.clockOut({ userId, entryId: entry.id, clockOutLocationText: "Stop site", gpsLatitude: 5, gpsLongitude: 6, gpsAccuracyM: 15, locatedAt: new Date().toISOString() });
  await new (load("src/photos/photoEvidenceRepository.ts").PhotoEvidenceRepository)(database).insertPhotoEvidence({ id: "photo", userId, projectId, localUri: "file:///photo.jpg", gps: { coordinates: { latitude: 1, longitude: 2, accuracy: 12 }, message: "GPS", blocked: false } });
  const { BackupRepository } = load("src/backup/backupRepository.ts");
  const backup = new BackupRepository(database);
  const before = await backup.exportTables(userId);
  const service = load("src/backup/backupService.ts");
  const envelope = service.createBackupEnvelope(before);
  await backup.applyBackup(envelope, userId);
  const after = await backup.exportTables(userId);
  assert.deepEqual(after.time_entries, before.time_entries);
  assert.deepEqual(after.photo_evidence.map((row) => ({ ...row })), before.photo_evidence.map((row) => ({ ...row, local_uri: "backup-metadata-only://photo" })));
  assert.equal(after.time_entries[0].clock_out_location_text, "Stop site");
  assert.equal(after.photo_evidence[0].gps_accuracy_m, 12);
  assert.equal(after.time_entries[0].clock_in_location_source, "gps");
  assert.equal(after.time_entries[0].location_note, "Worker note");
});
test("chip covers locating, GPS time without an on-screen accuracy readout, and no GPS", () => {
  const { formatLocationChip } = createLoader()("src/work/locationEvidence.ts");
  assert.equal(formatLocationChip(null, true), "Locating…");
  assert.equal(formatLocationChip(null), "No GPS · Turn on location");
  const fix = { source: "gps", address: "Site", accuracy: 51, locatedAt: "2026-10-29T01:00:00Z" };
  assert.match(formatLocationChip(fix), /Site · .+ ⟳/);
  assert.doesNotMatch(formatLocationChip(fix), /±|approximate|51 m/);
});
test("GPS captures high accuracy and records sensor accuracy/time without inventing an address", async () => {
  let options;
  const load = createLoader({ "expo-location": { Accuracy: { High: "high" }, PermissionStatus: { GRANTED: "granted" }, requestForegroundPermissionsAsync: async () => ({ status: "granted" }), getCurrentPositionAsync: async (value) => { options = value; return { coords: { latitude: 1, longitude: 2, accuracy: 7 }, timestamp: 1000 }; } } });
  const result = await load("src/work/workLocation.ts").getOptionalWorkLocationAddress();
  assert.equal(options.accuracy, "high");
  assert.equal(result.address, null);
  assert.equal(result.accuracy, 7);
  assert.equal(result.timestamp, new Date(1000).toISOString());
  const photo = await load("src/photos/photoGps.ts").getOptionalPhotoGps();
  assert.equal(photo.coordinates.accuracy, 7);
});

test("gallery imports do not collect current phone GPS", () => {
  assert.match(source("src/screens/PhotoEvidenceScreen.tsx"), /action === "camera"\s*\? await getOptionalPhotoGps\(\)\s*:/);
});
