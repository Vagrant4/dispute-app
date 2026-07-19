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

test("downloadGeneratedPdfToUserFolder copies PDF bytes to a user-selected Android folder", async () => {
  const { downloadGeneratedPdfToUserFolder } = loadTsModule(
    "src/reports/reportDownload.ts",
  );
  const writes = [];

  const result = await downloadGeneratedPdfToUserFolder({
    filePath: "file:///app/report.pdf",
    fileName: "Project A Report.pdf",
    fileSystem: {
      EncodingType: { Base64: "base64" },
      readAsStringAsync: async () => "JVBERi0xLjQ=",
      StorageAccessFramework: {
        requestDirectoryPermissionsAsync: async () => ({
          granted: true,
          directoryUri: "content://downloads/tree",
        }),
        createFileAsync: async (directoryUri, fileName, mimeType) => {
          assert.equal(directoryUri, "content://downloads/tree");
          assert.equal(fileName, "Project-A-Report");
          assert.equal(mimeType, "application/pdf");
          return "content://downloads/report.pdf";
        },
        writeAsStringAsync: async (uri, contents, options) => {
          writes.push({ uri, contents, options });
        },
      },
    },
  });

  assert.equal(result.downloaded, true);
  assert.equal(result.destinationUri, "content://downloads/report.pdf");
  assert.equal(result.message, "PDF downloaded to the folder you selected on this phone.");
  assert.deepEqual(writes, [
    {
      uri: "content://downloads/report.pdf",
      contents: "JVBERi0xLjQ=",
      options: { encoding: "base64" },
    },
  ]);
});

test("downloadGeneratedPdfToUserFolder reports cancellation when no folder is selected", async () => {
  const { downloadGeneratedPdfToUserFolder } = loadTsModule(
    "src/reports/reportDownload.ts",
  );

  const result = await downloadGeneratedPdfToUserFolder({
    filePath: "file:///app/report.pdf",
    fileName: "Report.pdf",
    fileSystem: {
      readAsStringAsync: async () => {
        throw new Error("should not read");
      },
      StorageAccessFramework: {
        requestDirectoryPermissionsAsync: async () => ({ granted: false }),
        createFileAsync: async () => {
          throw new Error("should not create");
        },
        writeAsStringAsync: async () => {
          throw new Error("should not write");
        },
      },
    },
  });

  assert.equal(result.downloaded, false);
  assert.match(result.message, /Download cancelled/);
});
