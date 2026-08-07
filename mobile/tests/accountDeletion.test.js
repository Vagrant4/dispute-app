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
  const {
    clearLocalAccountData,
    DELETE_LOCAL_ACCOUNT_DATA_SQL,
    listOwnedLocalFileUris,
  } = loadCoreModule();
  const calls = [];
  await clearLocalAccountData({
    database: {
      async execAsync(sql) {
        calls.push(["sql", sql]);
      },
      async runAsync(sql, params) {
        calls.push(["delete", sql, params]);
      },
    },
    fileSystem: {
      async deleteAsync(filePath, options) {
        calls.push(["file", filePath, options]);
      },
    },
    directories: ["evidence-photos", "generated-documents", "backups"],
    userId: "user-a",
    async clearAuthData() {
      calls.push(["auth"]);
    },
  });

  assert.equal(calls.filter(([type]) => type === "file").length, 3);
  assert.equal(calls.some(([type]) => type === "auth"), true);
  assert.ok(DELETE_LOCAL_ACCOUNT_DATA_SQL.every((sql) => /WHERE user_id = \?/.test(sql)));
  assert.equal(calls.filter(([type]) => type === "delete").length, 7);
  assert.ok(
    calls
      .filter(([type]) => type === "delete")
      .every(([, , params]) => params[0] === "user-a"),
  );

  const ownedFiles = await listOwnedLocalFileUris(
    {
      async getAllAsync(sql, params) {
        assert.deepEqual(params, ["user-a"]);
        return sql.includes("photo_evidence")
          ? [
              { local_uri: "file:///app/evidence-photos/local-user/photo.jpg" },
              { local_uri: "file:///app/evidence-photos/user-b/other.jpg" },
              { local_uri: "file:///app/evidence-photos/user-a/%2e%2e/user-b/secret.jpg" },
              { local_uri: "file:///app/evidence-photos/user-a/%2Fauth/secret.json" },
              { local_uri: "file:///app/evidence-photos/user-a/%5Cauth/secret.json" },
            ]
          : [
              { local_uri: "file:///app/generated-documents/local-user/report.pdf" },
              { local_uri: "file:///app/auth/local-accounts.json" },
              { local_uri: "file:///unrelated/generated-documents/user-a/report.pdf" },
            ];
      },
    },
    "user-a",
    "file:///app/",
  );
  assert.deepEqual(ownedFiles, [
    "file:///app/evidence-photos/local-user/photo.jpg",
    "file:///app/generated-documents/local-user/report.pdf",
  ]);
});
