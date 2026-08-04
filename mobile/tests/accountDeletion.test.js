const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadCoreModule() {
  const sourcePath = path.join(
    __dirname,
    "..",
    "src",
    "account",
    "accountDeletionCore.ts",
  );
  const source = readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", compiled)(module.exports, module);
  return module.exports;
}

test("clearLocalAccountData deletes database rows, app files, and auth data", async () => {
  const { clearLocalAccountData, DELETE_LOCAL_ACCOUNT_DATA_SQL } = loadCoreModule();
  const calls = [];
  await clearLocalAccountData({
    database: {
      async execAsync(sql) {
        calls.push(["sql", sql]);
      },
    },
    fileSystem: {
      async deleteAsync(filePath, options) {
        calls.push(["file", filePath, options]);
      },
    },
    directories: ["evidence-photos", "generated-documents", "backups"],
    async clearAuthData() {
      calls.push(["auth"]);
    },
  });

  assert.match(DELETE_LOCAL_ACCOUNT_DATA_SQL, /DELETE FROM photo_evidence/);
  assert.match(DELETE_LOCAL_ACCOUNT_DATA_SQL, /DELETE FROM subscription_entitlements/);
  assert.equal(calls.filter(([type]) => type === "file").length, 3);
  assert.equal(calls.some(([type]) => type === "auth"), true);
});
