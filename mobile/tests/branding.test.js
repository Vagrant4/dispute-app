const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("phone app uses the dispute display brand", () => {
  const appConfig = JSON.parse(
    readFileSync(path.join(__dirname, "..", "app.json"), "utf8"),
  );
  const appSource = readFileSync(
    path.join(__dirname, "..", "App.tsx"),
    "utf8",
  );
  const stylesSource = readFileSync(
    path.join(__dirname, "..", "src", "styles.ts"),
    "utf8",
  );

  assert.equal(appConfig.expo.name, "dispute");
  assert.match(appSource, />DISPUTE<\/Text>/);
  assert.doesNotMatch(appSource, />ClaimProof SG<\/Text>/);
  assert.doesNotMatch(
    stylesSource.match(/appName:\s*\{[\s\S]*?\n\s*\},/)?.[0] ?? "",
    /textTransform:\s*"uppercase"/,
  );
});

test("legacy app identifiers remain stable for local data and store continuity", () => {
  const appConfig = JSON.parse(
    readFileSync(path.join(__dirname, "..", "app.json"), "utf8"),
  );
  const schemaSource = readFileSync(
    path.join(__dirname, "..", "src", "db", "schema.ts"),
    "utf8",
  );

  assert.equal(appConfig.expo.ios.bundleIdentifier, "sg.claimproof.mobile");
  assert.equal(appConfig.expo.android.package, "sg.claimproof.mobile");
  assert.match(schemaSource, /claimproof-sg-local\.db/);
});
