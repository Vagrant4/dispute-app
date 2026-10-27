const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("release configuration never enables device-only test flags", () => {
  for (const file of ["eas.json", "app.json"]) {
    const contents = readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.doesNotMatch(contents, /EXPO_PUBLIC_(?:FLOW_TEST_MOCK|TRIAL_DEBUG_OVERRIDE)/);
  }
});
