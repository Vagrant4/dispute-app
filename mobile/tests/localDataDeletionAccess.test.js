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

test("expired access still permits deletion of owned time entries", () => {
  const source = readScreen("HomeScreen.tsx");
  const handler = between(
    source,
    "async function handleDeleteEntry",
    "  return (",
  );
  const deleteButton = between(
    source,
    "accessibilityLabel={`Delete time entry",
    "</Pressable>",
  );

  assert.doesNotMatch(handler, /hasCurrentCreateAccess/);
  assert.match(source, /const userId = account\.id \?\? account\.email/);
  assert.match(handler, /deleteEntry\(\{ userId, entryId \}\)/);
  assert.match(source, /getHomeState\(userId\)/);
  assert.match(source, /listProjects\(userId\)/);
  assert.doesNotMatch(deleteButton, /disabled={!access\.canCreateRecords}/);
  assert.doesNotMatch(deleteButton, /!access\.canCreateRecords && styles\.disabledButton/);
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
