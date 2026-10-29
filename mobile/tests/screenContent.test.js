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
    "Today",
    "Photos",
    "Projects",
    "Settings",
  ]) {
    assert.match(contentSource, new RegExp(`\\b${label}\\b`));
  }
  assert.match(contentSource, /label: "Today"/);
  assert.doesNotMatch(contentSource, /label: "Work"/);
  assert.doesNotMatch(contentSource, /label: "Reports"/);
  assert.doesNotMatch(contentSource, /label: "Trial"/);
  assert.doesNotMatch(contentSource, /label: "Storage"/);
});

test("mobile scaffold declares real user trial readiness copy", () => {
  for (const requiredCopy of [
    "New users receive a 30-day no-card trial",
    "Save a copy before you change phone or delete the app",
    "DISPUTE stores account and subscription status securely on the server",
    "on this device unless you choose to export",
    "No advertising trackers",
  ]) {
    assert.match(contentSource, new RegExp(requiredCopy));
  }
});

test("mobile scaffold keeps required backup warning and status copy", () => {
  assert.match(
    contentSource,
    /Your records are kept on this phone\. Save a copy before you change phone or delete the app\./,
  );
  assert.match(contentSource, /No advertising trackers/);
  assert.match(contentSource, /Google Play and our payment partner/);
  assert.doesNotMatch(contentSource, /policyGated/);

  for (const lockState of ["trialReadinessContent", "evidenceLockStates"]) {
    assert.doesNotMatch(contentSource, new RegExp(`\\b${lockState}\\b`));
  }
});

test("mobile subscription screen copy declares the 30-day no-card trial and store billing", () => {
  for (const requiredCopy of [
    "no-card trial",
    "No charge starts automatically",
    "subscribe to create new records and export premium PDF and CSV reports",
    "Subscribe to add new records or share reports",
  ]) {
    assert.match(contentSource, new RegExp(requiredCopy));
  }
  assert.doesNotMatch(contentSource, /SGD 4\.99\/month/);
});
