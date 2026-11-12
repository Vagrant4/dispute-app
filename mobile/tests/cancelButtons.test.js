const assert = require("node:assert/strict");
const test = require("node:test");
const { source } = require("./locationTestHelpers");

test("New project sheet uses primary Save and full-size secondary Cancel", () => {
  const sheet = source("src/screens/ProjectNameSheet.tsx");
  assert.match(sheet, /onPress=\{\(\) => void save\(\)\}[\s\S]*style=\{\[styles\.actionButton,/);
  assert.match(sheet, /onPress=\{onClose\}[\s\S]*style=\{styles\.actionButtonSecondary\}[\s\S]*style=\{styles\.actionButtonSecondaryText\}>Cancel/);
  assert.doesNotMatch(sheet, /<Text style=\{styles\.muted\}>Cancel<\/Text>/);
});
