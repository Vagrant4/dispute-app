const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("local account model contains display identity only and no credential", () => {
  const source = readFileSync(
    path.join(__dirname, "..", "src", "auth", "localAuth.ts"),
    "utf8",
  );

  assert.match(source, /export type LocalAccount/);
  assert.doesNotMatch(source, /password\s*:/);
  assert.doesNotMatch(source, /loginLocalAccount|createLocalAccount/);
});
