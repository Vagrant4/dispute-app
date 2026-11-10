const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sourceRoot = path.resolve(__dirname, "../src");

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return entry.isFile() && /\.[jt]sx$/.test(entry.name) ? [target] : [];
  });
}

test("KeyboardAwareScroll inside SwipeDownSheet is non-fill or the sheet has an explicit height", () => {
  const violations = [];
  for (const file of sourceFiles(sourceRoot)) {
    const source = fs.readFileSync(file, "utf8");
    const sheets = source.matchAll(/<SwipeDownSheet\b([\s\S]*?)<\/SwipeDownSheet>/g);
    for (const match of sheets) {
      if (!match[0].includes("<KeyboardAwareScroll")) continue;
      const usesNonFill = /<KeyboardAwareScroll\b[^>]*\bfill=\{false\}/.test(match[0]);
      const sheetStyle = match[1].match(/sheetStyle=\{([^}]*)\}/)?.[1] ?? "";
      const hasExplicitHeight = /photoSheet/.test(sheetStyle);
      if (!usesNonFill && !hasExplicitHeight) violations.push(path.relative(sourceRoot, file));
    }
  }
  assert.deepEqual(violations, []);
});
