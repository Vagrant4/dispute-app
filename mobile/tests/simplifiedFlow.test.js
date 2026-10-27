const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function load(relativePath) {
  const source = readFileSync(path.join(__dirname, "..", "src", ...relativePath.split("/")), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", "require", compiled)(module.exports, module, require);
  return module.exports;
}

test("empty project rate is accepted while malformed rates still fail", () => {
  const rates = load("work/projectRates.ts");
  assert.equal(rates.parseSgdHourlyRateCents(""), 0);
  assert.equal(rates.parseSgdHourlyRateCents("25.50"), 2550);
  assert.throws(() => rates.parseSgdHourlyRateCents("25 dollars"));
});

test("automatic project name uses Job 1 and Singapore-style day month", () => {
  const draft = load("work/projectDraft.ts");
  assert.equal(draft.buildAutomaticProjectName(new Date(2026, 9, 27)), "Job 1 · 27 Oct");
});

test("registration validation does not require confirm password", () => {
  const auth = load("auth/remoteAuth.ts");
  const result = auth.validateRegistrationInput({ name: "Worker", email: "worker@example.com", phone: "+65 90000000", password: "Password123!" });
  assert.equal(result.ok, true);
});
