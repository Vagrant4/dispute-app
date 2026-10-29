const assert = require("node:assert/strict");
const test = require("node:test");
const { createLoader, fixture, source } = require("./locationTestHelpers");
for (const kind of ["web", "sqlite"]) {
  test(`${kind}: stop without GPS never inherits start coordinates`, async () => {
    const { store, userId, projectId } = await fixture(kind);
    const entry = await store.clockIn({ userId, projectId, clockInAt: new Date(Date.now() - 60_000), locationText: "A", gpsLatitude: 1.3, gpsLongitude: 103.8 });
    const stopped = await store.clockOut({ userId, entryId: entry.id });
    assert.equal(stopped.clockOutGpsLatitude, null);
    assert.equal(stopped.clockOutGpsLongitude, null);
    assert.equal(stopped.clockOutLocationSource, "none");
    assert.equal(stopped.locationText, "A");
  });
  test(`${kind}: separate stop address preserves start address`, async () => {
    const { store, userId, projectId } = await fixture(kind);
    const entry = await store.clockIn({ userId, projectId, clockInAt: new Date(Date.now() - 60_000), locationText: "A", gpsLatitude: 1.3, gpsLongitude: 103.8 });
    const stopped = await store.clockOut({ userId, entryId: entry.id, clockOutLocationText: "B", gpsLatitude: 1.4, gpsLongitude: 103.9, gpsAccuracyM: 12, locatedAt: new Date().toISOString() });
    assert.equal(stopped.locationText, "A");
    assert.equal(stopped.clockOutLocationText, "B");
    assert.equal(stopped.clockOutGpsLatitude, 1.4);
    assert.equal(stopped.clockOutGpsAccuracyM, 12);
  });
}
test("snapshot includes different start and stop sites, and either phase alone", () => {
  const build = createLoader()("src/reports/progressClaimSnapshot.ts").buildProgressClaimSnapshot;
  const entry = { id: "entry", workDate: "2026-10-29", durationMinutes: 60, activity: "Work" };
  const locations = (fixes) => build({ timeEntries: [{ ...entry, ...fixes }] }).dailyWorkLog[0].locations;
  assert.equal(locations({ locationText: "A", clockOutLocationText: "B", clockInGpsLatitude: 1, clockInGpsLongitude: 2, clockOutGpsLatitude: 3, clockOutGpsLongitude: 4 }).length, 2);
  assert.equal(locations({ locationText: "A", clockInGpsLatitude: 1, clockInGpsLongitude: 2 }).length, 1);
  assert.equal(locations({ clockOutLocationText: "B", clockOutGpsLatitude: 3, clockOutGpsLongitude: 4 }).length, 1);
  assert.equal(locations({ locationText: "A", clockOutLocationText: "A", clockInGpsLatitude: 1, clockInGpsLongitude: 2, clockOutGpsLatitude: 1, clockOutGpsLongitude: 2 }).length, 1);
});
test("Home stop only uses the fresh fix and a ten-second timeout", () => {
  const home = source("src/screens/HomeScreen.tsx").split("async function handleClockOut()")[1].split("async function handleDeleteEntry")[0];
  assert.doesNotMatch(home, /locationGps\.|\?\? locationText/);
  assert.match(home, /gpsLatitude: location\?\.latitude \?\? null/);
  assert.match(home, /getWorkLocationWithTimeout\(10_000/);
  assert.match(source("src/work/workLocation.ts"), /finally.*clearTimeout\(timer\)/);
});
