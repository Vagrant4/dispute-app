const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const contentSource = readFileSync(
  path.join(__dirname, "..", "src", "screenContent.ts"),
  "utf8",
);

test("mobile production navigation declares simplified field-work destinations", () => {
  for (const label of [
    "Time",
    "Evidence",
    "Export",
    "Settings",
  ]) {
    assert.match(contentSource, new RegExp(`\\b${label}\\b`));
  }
  assert.doesNotMatch(contentSource, /label: "Today"/);
  assert.doesNotMatch(contentSource, /label: "Work"/);
  assert.doesNotMatch(contentSource, /label: "Reports"/);
  assert.doesNotMatch(contentSource, /label: "Trial"/);
  assert.doesNotMatch(contentSource, /label: "Storage"/);
});

test("mobile scaffold declares real user trial readiness copy", () => {
  for (const requiredCopy of [
    "New users verify their email, receive a 3-day trial",
    "Export a backup before uninstalling, changing phone, clearing app data",
    "Account registration and subscription status are stored securely by the Dispute server",
    "Do not enter real FIN/NRIC unless comfortable",
    "no CPF/MOM automation",
  ]) {
    assert.match(contentSource, new RegExp(requiredCopy));
  }
});

test("mobile scaffold keeps required backup warning and status copy", () => {
  assert.match(
    contentSource,
    /dispute stores records locally on this device\. If you delete the app, change phone, or lose the device, your records may be lost unless you export or back them up\./,
  );
  assert.match(contentSource, /No analytics in V1/);
  assert.match(contentSource, /policy-gated/);

  for (const lockState of ["Draft", "Finalized", "Locked"]) {
    assert.match(contentSource, new RegExp(`\\b${lockState}\\b`));
  }
});

test("mobile subscription screen copy declares 3-day trial and store billing", () => {
  for (const requiredCopy of [
    "New verified users receive a 3-day trial",
    "subscribe to export PDF and CSV reports",
    "SGD 4.99/month",
    "Apple App Store or Google Play billing",
    "Stripe checkout is not used inside the app",
  ]) {
    assert.match(contentSource, new RegExp(requiredCopy));
  }
});
