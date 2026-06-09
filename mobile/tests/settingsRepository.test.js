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

test("default app settings are valid and Singapore-oriented", () => {
  const { DEFAULT_APP_SETTINGS, validateAppSettings } = loadTsModule(
    "src/db/settingsValidation.ts",
  );

  assert.deepEqual(validateAppSettings(DEFAULT_APP_SETTINGS), DEFAULT_APP_SETTINGS);
  assert.equal(DEFAULT_APP_SETTINGS.currency, "SGD");
  assert.equal(DEFAULT_APP_SETTINGS.dailyHours, 8);
  assert.equal(DEFAULT_APP_SETTINGS.weeklyHours, 44);
  assert.equal(DEFAULT_APP_SETTINGS.overtimeMultiplier, 1.5);
});

test("default app settings use distinct ids for different users", () => {
  const { createDefaultAppSettings } = loadTsModule(
    "src/db/settingsValidation.ts",
  );

  const first = createDefaultAppSettings("user-a");
  const second = createDefaultAppSettings("user-b");

  assert.equal(first.id, "settings:user-a");
  assert.equal(second.id, "settings:user-b");
  assert.notEqual(first.id, second.id);
});

test("settings updates reject unsafe limits and invalid currency", () => {
  const { DEFAULT_APP_SETTINGS, validateSettingsPatch } = loadTsModule(
    "src/db/settingsValidation.ts",
  );

  for (const patch of [
    { dailyHours: 0 },
    { dailyHours: 25 },
    { weeklyHours: 0 },
    { weeklyHours: 169 },
    { dailyHours: 12, weeklyHours: 10 },
    { overtimeMultiplier: 0.99 },
    { overtimeMultiplier: 5.01 },
    { currency: "sgd" },
    { currency: "US" },
    { currency: "EURO" },
  ]) {
    assert.throws(
      () => validateSettingsPatch(DEFAULT_APP_SETTINGS, patch),
      /Invalid app settings/,
      JSON.stringify(patch),
    );
  }
});

test("settings updates merge valid patches", () => {
  const { DEFAULT_APP_SETTINGS, validateSettingsPatch } = loadTsModule(
    "src/db/settingsValidation.ts",
  );

  assert.deepEqual(
    validateSettingsPatch(DEFAULT_APP_SETTINGS, {
      dailyHours: 9,
      weeklyHours: 45,
      overtimeMultiplier: 2,
      currency: "USD",
    }),
    {
      ...DEFAULT_APP_SETTINGS,
      dailyHours: 9,
      weeklyHours: 45,
      overtimeMultiplier: 2,
      currency: "USD",
    },
  );
});
