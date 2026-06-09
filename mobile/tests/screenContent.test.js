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
    "Trial Readiness",
    "Privacy Notice",
    "Storage Diagnostics",
    "Subscription Status",
    "Evidence Lock",
  ]) {
    assert.match(contentSource, new RegExp(`\\b${label}\\b`));
  }
});

test("mobile scaffold declares real user trial readiness copy", () => {
  for (const requiredCopy of [
    "2-week trial with 5 freelancers, 3 subcontractors, and 2 site supervisors",
    "Export a backup before uninstalling, changing phone, clearing app data",
    "There is no cloud sync, analytics, account collection, or backend upload",
    "Do not enter real FIN/NRIC unless comfortable",
    "no CPF/MOM automation",
  ]) {
    assert.match(contentSource, new RegExp(requiredCopy));
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
