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
  new Function("exports", "module", "require", compiled)(
    module.exports,
    module,
    require,
  );
  return module.exports;
}

test("viewGeneratedDocument opens supported report file paths", async () => {
  const { viewGeneratedDocument } = loadTsModule("src/reports/reportViewing.ts");
  const opened = [];

  const result = await viewGeneratedDocument({
    filePath: "file:///documents/reports/report.pdf",
    viewer: {
      canOpenURL: async () => true,
      openURL: async (url) => opened.push(url),
    },
  });

  assert.equal(result.opened, true);
  assert.equal(result.message, "Report opened for viewing.");
  assert.deepEqual(opened, ["file:///documents/reports/report.pdf"]);
});

test("viewGeneratedDocument opens the converted content URI when supplied", async () => {
  const { viewGeneratedDocument } = loadTsModule("src/reports/reportViewing.ts");
  const opened = [];

  const result = await viewGeneratedDocument({
    filePath: "file:///documents/reports/report.pdf",
    viewer: {
      canOpenURL: async (url) => url.startsWith("content://"),
      getViewableUri: async () => "content://sg.claimproof.mobile/report.pdf",
      openURL: async (url) => opened.push(url),
    },
  });

  assert.equal(result.opened, true);
  assert.deepEqual(opened, ["content://sg.claimproof.mobile/report.pdf"]);
});

test("viewGeneratedDocument can open without preflight when the platform viewer does not support canOpenURL", async () => {
  const { viewGeneratedDocument } = loadTsModule("src/reports/reportViewing.ts");
  const opened = [];

  const result = await viewGeneratedDocument({
    filePath: "file:///documents/reports/report.pdf",
    viewer: {
      getViewableUri: async () => "content://sg.claimproof.mobile/report.pdf",
      openURL: async (url) => opened.push(url),
    },
  });

  assert.equal(result.opened, true);
  assert.deepEqual(opened, ["content://sg.claimproof.mobile/report.pdf"]);
});

test("viewGeneratedDocument gives a clear fallback when direct viewing is unavailable", async () => {
  const { viewGeneratedDocument } = loadTsModule("src/reports/reportViewing.ts");

  const result = await viewGeneratedDocument({
    filePath: "file:///documents/reports/report.pdf",
    viewer: {
      canOpenURL: async () => false,
      openURL: async () => {
        throw new Error("should not open");
      },
    },
  });

  assert.equal(result.opened, false);
  assert.match(result.message, /Use Email \/ Share/);
});
