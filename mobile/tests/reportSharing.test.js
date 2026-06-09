const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTsModule(relativePath) {
  const sourcePath = path.join(__dirname, "..", relativePath);
  const source = readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", compiled)(module.exports, module);
  return module.exports;
}

test("shareGeneratedDocument returns non-blocking file path when sharing is unavailable", async () => {
  const { shareGeneratedDocument } = loadTsModule("src/reports/reportSharing.ts");

  const result = await shareGeneratedDocument({
    filePath: "file:///claim.pdf",
    mimeType: "application/pdf",
    sharing: {
      isAvailableAsync: async () => false,
      shareAsync: async () => {
        throw new Error("should not be called");
      },
    },
  });

  assert.equal(result.shared, false);
  assert.equal(result.filePath, "file:///claim.pdf");
  assert.match(result.message, /Sharing is unavailable/);
});
