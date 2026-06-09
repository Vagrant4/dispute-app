const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const contentSource = readFileSync(
  path.join(__dirname, "..", "src", "screenContent.ts"),
  "utf8",
);

test("mobile scaffold declares required screen labels", () => {
  for (const label of [
    "Home",
    "Settings / Backup",
    "Privacy Notice",
    "Storage Diagnostics",
    "Subscription Status",
    "Evidence Lock",
  ]) {
    assert.match(contentSource, new RegExp(`\\b${label}\\b`));
  }
});

test("mobile scaffold keeps required backup warning and status copy", () => {
  assert.match(
    contentSource,
    /ClaimProof SG stores records locally on this device\. If you delete the app, change phone, or lose the device, your records may be lost unless you export or back them up\./,
  );
  assert.match(contentSource, /No analytics in V1/);
  assert.match(contentSource, /policy-gated/);

  for (const lockState of ["Draft", "Finalized", "Locked"]) {
    assert.match(contentSource, new RegExp(`\\b${lockState}\\b`));
  }
});
