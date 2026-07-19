const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadAuthModule() {
  const sourcePath = path.join(__dirname, "..", "src", "auth", "localAuth.ts");
  const source = readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", compiled)(module.exports, module);
  return module.exports;
}

function createMemoryStorage(initialAccounts = []) {
  let storedAccounts = initialAccounts;
  return {
    storage: {
      async loadAccounts() {
        return storedAccounts;
      },
      async saveAccounts(accounts) {
        storedAccounts = accounts;
      },
    },
    getStoredAccounts() {
      return storedAccounts;
    },
  };
}

test("login does not create an account before registration", async () => {
  const { loginLocalAccount } = loadAuthModule();
  const { storage } = createMemoryStorage();

  const result = await loginLocalAccount(
    {
      email: "worker@example.com",
      password: "123456",
    },
    storage,
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /Create account first/);
});

test("local auth accepts practical phone-test passwords and saves mobile account", async () => {
  const { createLocalAccount } = loadAuthModule();
  const { storage, getStoredAccounts } = createMemoryStorage();

  const result = await createLocalAccount(
    {
      name: "Local Worker",
      email: "short-password@example.com",
      phone: "+65 9000 0000",
      password: "1234",
      confirmPassword: "1234",
    },
    storage,
  );

  assert.equal(result.ok, true);
  assert.equal(result.account.phone, "+65 9000 0000");
  assert.equal(getStoredAccounts().length, 1);
});

test("registered account can login from phone storage", async () => {
  const { loginLocalAccount } = loadAuthModule();
  const { storage } = createMemoryStorage([
    {
      name: "Registered Worker",
      email: "registered@example.com",
      phone: "+65 9888 0000",
      password: "123456",
    },
  ]);

  const result = await loginLocalAccount(
    {
      email: "registered@example.com",
      password: "123456",
    },
    storage,
  );

  assert.equal(result.ok, true);
  assert.equal(result.account.name, "Registered Worker");
});
