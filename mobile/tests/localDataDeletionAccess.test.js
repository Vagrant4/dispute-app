const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readScreen(name) {
  return readFileSync(
    path.join(__dirname, "..", "src", "screens", name),
    "utf8",
  );
}

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

for (const kind of ["sqlite", "web"]) test(`${kind}: owned time entries can be deleted without subscription access`, async () => {
  const { fixture } = require("./locationTestHelpers");
  const { store, userId, projectId } = await fixture(kind);
  const entry = await store.clockIn({ userId, projectId, clockInAt: new Date("2026-10-29T08:00:00+08:00") });
  await store.clockOut({ userId, entryId: entry.id, clockOutAt: new Date("2026-10-29T09:00:00+08:00") });
  await assert.rejects(() => store.deleteEntry({ userId: "other-user", entryId: entry.id }));
  assert.ok((await store.getHomeState(userId)).recentEntries.some((row) => row.id === entry.id));
  await store.deleteEntry({ userId, entryId: entry.id });
  assert.ok(!(await store.getHomeState(userId)).recentEntries.some((row) => row.id === entry.id));
  assert.doesNotMatch(readScreen("HomeScreen.tsx"), /Delete time entry|Confirm Delete/);
});

test("expired access still permits deletion of owned generated reports", () => {
  const source = readScreen("ProgressClaimReportsScreen.tsx");
  const handler = between(
    source,
    "async function handleDelete(document",
    "  return (",
  );
  const deleteButton = between(
    source,
    "onPress={() => void handleDelete(document)}",
    "</Pressable>",
  );

  assert.doesNotMatch(handler, /hasCurrentFullAccess/);
  assert.match(source, /const userId = account\.id \?\? account\.email/);
  assert.match(handler, /getGeneratedDocumentById\(\{[\s\S]*userId/);
  assert.match(source, /listRecentGeneratedDocuments\(\{[\s\S]*userId/);
  assert.doesNotMatch(source, /const LOCAL_USER_ID = "local-user"/);
  assert.doesNotMatch(deleteButton, /subscription\?\.canCreateRecords/);
  assert.doesNotMatch(deleteButton, /disabledButton/);
});
