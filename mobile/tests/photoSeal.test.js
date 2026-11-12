const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createLoader, sqliteDatabase } = require("./locationTestHelpers");
const { createHash } = require("node:crypto");
const load = createLoader({ "expo-crypto": {}, "expo-file-system/legacy": {} });
const { photoCaptureMetadata, parseExifDateTimeOriginal, sealPhoto, photoSealBadge, photoTimeLabel } = load("src/photos/photoSeal.ts");

test("photo save writes the injected SHA-256 seal and seal time", async () => {
  const { PhotoEvidenceRepository } = load("src/photos/photoEvidenceRepository.ts");
  let record;
  const seal = await sealPhoto({ localUri: "file:///photo.jpg", capturedAt: "2026-10-29T01:00:00Z", gps: { coordinates: { latitude: 1.3, longitude: 103.8 } } }, {
    readBase64: async () => "cGhvdG8=",
    hashProviders: [(data) => { record = JSON.parse(data); return createHash("sha256").update(data).digest("hex"); }],
  });
  let saved;
  await new PhotoEvidenceRepository({ runAsync: async (sql, values) => { saved = { sql, values }; } }).insertPhotoEvidence({ id: "p", userId: "u", projectId: "job", localUri: "file:///photo.jpg", timestamp: record.captured_at, captureSource: "camera", captureTimeSource: "device_clock", ...seal });
  assert.equal(record.fileBase64, "cGhvdG8=");
  assert.equal(record.latitude, 1.3);
  assert.equal(record.longitude, 103.8);
  assert.match(saved.sql, /lock_hash/);
  assert.equal(saved.values[15], seal.lockHash);
  assert.match(saved.values[15], /^[a-f0-9]{64}$/);
  assert.equal(saved.values[16], seal.lockedAt);
  const changed = await sealPhoto({ localUri: "file:///photo.jpg", capturedAt: null, gps: null }, { readBase64: async () => "different", hashProviders: [(s) => createHash("sha256").update(s).digest("hex")] });
  assert.notEqual(changed.lockHash, seal.lockHash);
});

test("gallery imports reject current GPS and preserve EXIF or unknown capture time", async () => {
  const { PhotoEvidenceRepository } = load("src/photos/photoEvidenceRepository.ts");
  for (const exif of [undefined, { DateTimeOriginal: "2024:02:29 09:12:34" }]) {
    const metadata = photoCaptureMetadata("gallery", exif);
    let values;
    await new PhotoEvidenceRepository({ runAsync: async (_sql, params) => { values = params; } }).insertPhotoEvidence({ id: "p", userId: "u", projectId: "job", localUri: "file:///old.jpg", timestamp: metadata.capturedAt, ...metadata, gps: { coordinates: { latitude: 1, longitude: 2, accuracy: 3 }, message: "Current GPS" } });
    assert.equal(values[7], metadata.capturedAt);
    assert.equal(values[8], null);
    assert.equal(values[9], null);
    assert.equal(values[10], "Gallery import: no GPS attached");
    assert.equal(values[11], null);
    assert.equal(values[13], "gallery");
    assert.equal(values[14], exif ? "exif" : "unknown");
    assert.equal(photoTimeLabel({ captured_at: metadata.capturedAt, capture_source: "gallery" }).includes("from file"), !!exif);
  }
});

test("EXIF DateTimeOriginal parser rejects invalid and missing dates", () => {
  for (const value of [null, {}, { DateTimeOriginal: "bad" }, { DateTimeOriginal: "2025:02:29 10:00:00" }, { DateTimeOriginal: "2026:13:01 10:00:00" }, { DateTimeOriginal: "2026:10:29 24:00:00" }]) assert.equal(parseExifDateTimeOriginal(value), null);
  const time = new Date(parseExifDateTimeOriginal({ DateTimeOriginal: "2024:02:29 10:11:12" }));
  assert.equal(time.getDate(), 29);
  assert.equal(time.getHours(), 10);
});

test("photo badges describe local seals honestly for every source and GPS state", () => {
  for (const capture_source of ["camera", "gallery", null]) for (const capture_time_source of ["exif", "device_clock", "unknown"]) for (const lock_hash of [null, "a".repeat(64)]) for (const gps_latitude of [null, 1]) {
    const badge = photoSealBadge({ capture_source, capture_time_source, lock_hash, gps_latitude, gps_longitude: gps_latitude });
    assert.doesNotMatch(badge, /tamper|verified/i);
    if (capture_source === "gallery" && capture_time_source !== "exif") assert.equal(badge, "Gallery · time unknown");
    if (capture_source === "camera" && lock_hash) assert.equal(badge.includes("GPS"), gps_latitude != null);
  }
});

test("file read or hash failure leaves the photo unsealed", async () => {
  const result = await sealPhoto({ localUri: "missing", capturedAt: null, gps: null }, { readBase64: async () => { throw Error("missing"); } });
  assert.deepEqual(result, { lockHash: null, lockedAt: null });
});

test("photo capture columns exist in fresh schema and additive migration and round trip through backup", async () => {
  const { MOBILE_SCHEMA_SQL, LOCAL_MIGRATIONS, CURRENT_SCHEMA_VERSION } = load("src/db/schema.ts");
  const { BackupRepository } = load("src/backup/backupRepository.ts");
  for (const column of ["capture_source", "capture_time_source"]) {
    assert.match(MOBILE_SCHEMA_SQL, new RegExp(column + " TEXT"));
    assert.match(LOCAL_MIGRATIONS.find((migration) => migration.version === 9).sql, new RegExp("ALTER TABLE photo_evidence ADD COLUMN " + column));
  }
  assert.equal(LOCAL_MIGRATIONS.at(-1).version, CURRENT_SCHEMA_VERSION);
  const row = { id: "photo-1", user_id: "u", project_id: "job", local_uri: "file:///photo.jpg", capture_source: "gallery", capture_time_source: "exif", lock_hash: "a".repeat(64), locked_at: "2026-10-29T00:00:00Z" };
  const db = sqliteDatabase();
  db.sqlite.exec("PRAGMA foreign_keys = ON;");
  for (const migration of LOCAL_MIGRATIONS.slice(0, -1)) db.sqlite.exec(migration.sql);
  db.sqlite.exec(`INSERT INTO clients (id,user_id,name) VALUES ('client','u','Client');
    INSERT INTO projects (id,user_id,client_id,name) VALUES ('job','u','client','Project');
    INSERT INTO photo_evidence (id,user_id,project_id,local_uri) VALUES ('legacy','u','job','file:///old.jpg');`);
  db.sqlite.exec(LOCAL_MIGRATIONS.at(-1).sql);
  const legacy = db.sqlite.prepare("SELECT * FROM photo_evidence WHERE id = 'legacy' AND user_id = 'u'").get();
  assert.equal(legacy.capture_source, null);
  assert.equal(legacy.capture_time_source, null);
  assert.equal(legacy.lock_hash, null);
  const fresh = sqliteDatabase();
  fresh.sqlite.exec(MOBILE_SCHEMA_SQL);
  const columns = (database) => database.sqlite.prepare("PRAGMA table_info(photo_evidence)").all().map((column) => column.name).sort();
  assert.deepEqual(columns(db), columns(fresh));
  await new (load("src/photos/photoEvidenceRepository.ts").PhotoEvidenceRepository)(db).insertPhotoEvidence({ id: row.id, userId: "u", projectId: "job", localUri: row.local_uri, timestamp: null, captureSource: "gallery", captureTimeSource: "exif", lockHash: row.lock_hash, lockedAt: row.locked_at });
  const repository = new BackupRepository(db);
  const tables = await repository.exportTables("u");
  await repository.applyBackup({ tables }, "u");
  const restored = (await repository.exportTables("u")).photo_evidence.find((photo) => photo.id === row.id);
  assert.equal(restored.captured_at, null);
  db.sqlite.close();
  fresh.sqlite.close();
  assert.equal(restored.capture_source, row.capture_source);
  assert.equal(restored.capture_time_source, row.capture_time_source);
  assert.equal(restored.lock_hash, row.lock_hash);
  assert.equal(restored.locked_at, row.locked_at);
});

test("Photos TextInput is confined to the capture sheet and gallery requests EXIF", () => {
  const source = readFileSync(path.join(__dirname, "../src/screens/PhotoEvidenceScreen.tsx"), "utf8");
  const sheetStart = source.indexOf("<SwipeDownSheet visible={captureSheetOpen}");
  const sheetEnd = source.indexOf("</SwipeDownSheet>", sheetStart);
  assert.ok(sheetStart > 0);
  assert.equal((source.match(/<TextInput\b/g) || []).length, 1);
  assert.ok(source.indexOf("<TextInput") > sheetStart && source.indexOf("<TextInput") < sheetEnd);
  assert.match(source, /captureSheetOpen \? <TextInput/);
  assert.match(source, /launchImageLibraryAsync\(\{[^}]*exif: true/);
  assert.match(source, /action === "camera"\s*\? await getOptionalPhotoGps\(\)/);
  assert.doesNotMatch(source.slice(0, sheetStart), /<Text[^>]*>Delete<\/Text>/);
});

test("PDF photo cards print source, time source and only the short seal hash", () => {
  const source = readFileSync(path.join(__dirname, "../src/reports/progressClaimHtml.ts"), "utf8");
  assert.match(source, /\["Source", photo.captureSource/);
  assert.match(source, /\["Time source", photo.captureTimeSource/);
  assert.match(source, /photo.lockHash\?\.slice\(0, 12\)/);
});
