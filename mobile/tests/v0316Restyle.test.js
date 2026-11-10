const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("Settings uses a real profile card, grouped rows, and outlined logout", () => {
  const screen = read("src/screens/SettingsScreen.tsx");
  const styles = read("src/styles.ts");
  assert.match(screen, /styles\.settingsProfile/);
  assert.match(screen, /account\.email/);
  assert.match(screen, /styles\.settingsLogout/);
  const row = styles.match(/settingsRow: \{([^}]+)\}/)?.[1] || "";
  assert.doesNotMatch(row, /borderTopWidth|borderBottomWidth/);
});

test("Projects layout exposes real tabs, search, filters and groups without a dead mic", () => {
  const screen = read("src/screens/ProjectsScreen.tsx");
  assert.match(screen, /Search name or address/);
  assert.match(screen, /Filter projects/);
  assert.match(screen, /\+ Add group/);
  assert.match(screen, /listProjectGroups/);
  assert.match(screen, /Search projects by voice/);
  assert.match(screen, /requestPermissionsAsync/);
  assert.match(screen, /isRecognitionAvailable/);
});

test("Photos layout keeps proof labels and uses a floating camera action", () => {
  const screen = read("src/screens/PhotoEvidenceScreen.tsx");
  assert.match(screen, /photoSealBadge/);
  assert.match(screen, /styles\.photoFab/);
});
