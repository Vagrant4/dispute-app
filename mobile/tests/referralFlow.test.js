const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const createSource = readFileSync(path.join(__dirname, "..", "src", "screens", "CreateAccountScreen.tsx"), "utf8");
const referralClientSource = readFileSync(path.join(__dirname, "..", "src", "referrals", "referralClient.ts"), "utf8");
const referralScreenSource = readFileSync(path.join(__dirname, "..", "src", "screens", "ReferralScreen.tsx"), "utf8");
const settingsSource = readFileSync(path.join(__dirname, "..", "src", "screens", "SettingsScreen.tsx"), "utf8");
const homeSource = readFileSync(path.join(__dirname, "..", "src", "screens", "HomeScreen.tsx"), "utf8");
const evidenceSource = readFileSync(path.join(__dirname, "..", "src", "screens", "PhotoEvidenceScreen.tsx"), "utf8");
const backupSource = readFileSync(path.join(__dirname, "..", "src", "screens", "SettingsBackupScreen.tsx"), "utf8");
const reportsSource = readFileSync(path.join(__dirname, "..", "src", "screens", "ProgressClaimReportsScreen.tsx"), "utf8");

test("signup accepts an optional referral code before account creation", () => {
  assert.match(createSource, /Referral code \(optional\)/);
  assert.match(createSource, /referralCode/);
  assert.match(createSource, /cannot be changed after registration/);
});

test("settings exposes a server-backed referral share link and progress", () => {
  assert.match(settingsSource, /ReferralScreen/);
  assert.match(referralClientSource, /\/referrals\/me/);
  assert.match(referralClientSource, /credentials: "include"/);
  assert.match(referralScreenSource, /Share referral link/);
  assert.match(referralScreenSource, /two paid months/);
  assert.match(referralScreenSource, /Five qualified referrals/);
});

test("expired access gates new local capture while preserving user control of existing records", () => {
  assert.match(homeSource, /canCreateRecords/);
  assert.match(homeSource, /Read-only access/);
  assert.match(evidenceSource, /canCreateRecords/);
  assert.match(evidenceSource, /Existing evidence remains readable/);
  assert.match(settingsSource, /SettingsBackupScreen/);
  assert.match(settingsSource, /exportOnly=/);
  assert.match(backupSource, /Restore is unavailable in read-only mode/);
  assert.doesNotMatch(reportsSource, /Existing reports cannot be deleted/);
});

test("report export screen offers individual-project PDF and CSV generation", () => {
  assert.match(reportsSource, /Create PDF/);
  assert.match(reportsSource, /Create CSV/);
  assert.match(reportsSource, /handleGenerate\("progress_claim_csv"\)/);
});
