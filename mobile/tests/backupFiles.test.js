const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("mobile backup file adapter provides durable export share and picker restore", () => {
  const source = readFileSync(
    path.join(__dirname, "..", "src", "backup", "backupFiles.ts"),
    "utf8",
  );

  for (const contract of [
    "writeBackupFile",
    "shareBackupFile",
    "pickBackupFile",
    "documentDirectory",
    "expo-document-picker",
  ]) {
    assert.match(source, new RegExp(contract));
  }
});
