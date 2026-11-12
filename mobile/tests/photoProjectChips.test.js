const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (file) => readFileSync(path.join(__dirname, "..", file), "utf8");

test("photo project selectors share fixed two-column grid chips", () => {
  const screen = read("src/screens/PhotoEvidenceScreen.tsx");
  const styles = read("src/styles.ts");
  const grid = styles.match(/photoProjectGrid:\s*\{([^}]+)\}/)?.[1] ?? "";
  const chip = styles.match(/photoProjectChip:\s*\{([^}]+)\}/)?.[1] ?? "";

  assert.match(screen, /style=\{styles\.photoProjectGrid\}/);
  assert.equal((screen.match(/styles\.photoProjectGrid/g) ?? []).length, 2);
  assert.match(chip, /flexBasis:\s*"48%"/);
  assert.match(chip, /height:\s*48/);
  assert.match(chip, /flexGrow:\s*0/);
  assert.match(grid, /flexWrap:\s*"wrap"/);
  assert.match(grid, /gap:\s*space\.sm/);
});

test("photo project chip names truncate and selected chips use the photo selection style", () => {
  const screen = read("src/screens/PhotoEvidenceScreen.tsx");

  assert.equal((screen.match(/ellipsizeMode="tail" numberOfLines=\{1\}/g) ?? []).length, 2);
  assert.equal((screen.match(/styles\.photoProjectChipSelected\b/g) ?? []).length, 2);
  assert.equal((screen.match(/styles\.photoProjectChipSelectedText/g) ?? []).length, 2);
});
