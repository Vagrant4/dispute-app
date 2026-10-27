const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const src = (rel) => readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
function load(rel, stubs = {}) {
  const compiled = ts.transpileModule(src(rel), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => (request in stubs ? stubs[request] : require(request));
  new Function("exports", "module", "require", "process", compiled)(module.exports, module, localRequire, process);
  return module.exports;
}
function between(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing ${start}`);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to === -1 ? undefined : to);
}

const DAY = 86400000;
const NOW = Date.parse("2026-10-27T07:00:00.000Z");
const access = load("src/subscription/recordAccess.ts");
const trial = load("src/subscription/guestTrial.ts", { "expo-secure-store": {} });
const base = {
  userId: "user-a", status: "TRIALING", isActive: true, canCreateRecords: true,
  canExportReports: true, canExportPremiumReports: true, canExportBasicData: true,
  billingProvider: "store", billingEnforcementActive: true, planName: "DISPUTE Basic",
  priceCents: 699, currency: "SGD", billingInterval: "month", hasReferralRewardAccess: false,
  referralRewardEndsAt: null, trialEndsAt: new Date(NOW + 10 * DAY).toISOString(),
  currentPeriodEnd: null, message: "",
};
const future = new Date(NOW + 5 * DAY).toISOString();
const past = new Date(NOW - DAY).toISOString();
const gate = (entitlement, isGuest = false) =>
  access.getDisputePackExportAccess({ isGuest, entitlement, nowMs: NOW });

test("guest on an active 30-day trial is locked out of pack files but can preview", () => {
  const guest = trial.buildGuestEntitlement(trial.startGuestTrial(NOW - 3 * DAY), NOW);
  assert.equal(guest.canExportReports, true); // trial still allows logging
  assert.deepEqual(gate(guest, true), { canPreview: true, canExport: false, lock: "guest" });
});

test("guest stays locked after the trial expires and even with a forged paid entitlement", () => {
  const expired = trial.buildGuestEntitlement(trial.startGuestTrial(NOW - 31 * DAY), NOW);
  assert.equal(gate(expired, true).lock, "guest");
  assert.equal(gate({ ...base, status: "ACTIVE", currentPeriodEnd: future }, true).canExport, false);
});

test("signed-in trial, expired, none and referral-only accounts must subscribe", () => {
  assert.equal(gate(base).lock, "subscribe");
  assert.equal(gate({ ...base, status: "EXPIRED", isActive: false, canExportReports: false }).lock, "subscribe");
  assert.equal(gate({ ...base, status: "NONE", trialEndsAt: null }).lock, "subscribe");
  assert.equal(gate({ ...base, status: "EXPIRED", hasReferralRewardAccess: true, referralRewardEndsAt: future }).lock, "subscribe");
  assert.equal(gate(null).lock, "subscribe");
});

test("paid ACTIVE, CANCELED-until-period-end and PAST_DUE-in-period unlock export", () => {
  for (const status of ["ACTIVE", "CANCELED", "PAST_DUE"]) {
    assert.deepEqual(gate({ ...base, status, trialEndsAt: null, currentPeriodEnd: future }), { canPreview: true, canExport: true, lock: null }, status);
  }
});

test("paid status with an ended period, no export flag, or local-user id stays locked", () => {
  assert.equal(gate({ ...base, status: "ACTIVE", currentPeriodEnd: past }).canExport, false);
  assert.equal(gate({ ...base, status: "ACTIVE", currentPeriodEnd: null }).canExport, false);
  assert.equal(gate({ ...base, status: "ACTIVE", currentPeriodEnd: future, canExportReports: false }).canExport, false);
  assert.equal(gate({ ...base, status: "ACTIVE", currentPeriodEnd: future, userId: "local-user" }).canExport, false);
});

test("lock copy and Plan & billing notes", () => {
  assert.match(access.disputePackLockContent.body, /needs a subscription\. Your records stay safe on this phone\./);
  assert.equal(access.getDisputePackBillingNote(false, "manage", null), null);
  assert.match(access.getDisputePackBillingNote(true, "none", null), /account and a DISPUTE Basic subscription/);
  assert.match(access.getDisputePackBillingNote(false, "subscribe", null), /Subscribe to download/);
  assert.match(access.getDisputePackBillingNote(false, "none", "2026-11-26T12:00:00.000Z"), /when your free trial ends on 26 Nov 2026/);
});

const reports = src("src/screens/ProgressClaimReportsScreen.tsx");

test("every pack file action on the reports screen goes through ensureCanExport first", () => {
  for (const handler of ["handleGenerate(", "handleShareDisputePack()", "handleShare(document", "handleDownloadPdf(params"]) {
    const body = between(reports, `async function ${handler}`, "try {");
    assert.match(body, /if \(!\(await ensureCanExport\(\)\)/, handler);
  }
  const view = between(reports, "async function handleViewReport(", "async function handleShare(");
  assert.ok(view.indexOf("ensureCanExport()") < view.indexOf("viewNativeGeneratedDocumentFile"), "opening a file is gated");
  assert.ok(view.indexOf("setReportPreview(snapshot)") < view.indexOf("ensureCanExport()"), "in-app preview stays open");
  const preview = between(reports, "async function handlePreview(", "async function handleShareDisputePack(");
  assert.doesNotMatch(preview, /ensureCanExport|generateAndArchiveProgressClaim|shareGeneratedDocument/);
});

test("guest ensureCanExport never consults the trial entitlement", () => {
  const body = between(reports, "async function ensureCanExport()", "return ensureCanExportWithRefresh(");
  const guestBranch = between(body, "if (account.isGuest) {", "}");
  assert.match(guestBranch, /lockedStatus/);
  assert.doesNotMatch(guestBranch, /return true/);
});

test("locked UI: lock card, preview button, create-account or Plan & billing action, locked file pills", () => {
  assert.match(reports, /exportLocked \? \(\s*<View accessibilityLabel="Dispute pack locked"/);
  assert.match(reports, /disputePackLockContent\.guestButton/);
  assert.match(reports, /onPress=\{onOpenPlanBilling\}/);
  assert.match(reports, /handlePreview\(\)/);
  assert.match(reports, /exportLocked \? "\\u\{1F512\} Download PDF"/);
  assert.match(reports, /exportLocked \? "\\u\{1F512\} Email \/ Share"/);
  assert.match(reports, /exportLocked\s*\? handlePreview\(project\.id\)/);
  const app = src("App.tsx");
  assert.match(app, /onOpenPlanBilling=\{\(\) => onNavigate\("settings", "subscription"\)\}/);
  assert.match(src("src/screens/SettingsScreen.tsx"), /useState<SettingPanel>\(initialPanel \?\? "profile"\)/);
});

test("no other screen or module can create, share, download or open pack files", () => {
  const allowed = new Set(["src/screens/ProgressClaimReportsScreen.tsx"]);
  const pattern = /generateAndArchiveProgressClaim|shareGeneratedDocument|downloadGeneratedPdf|viewGeneratedDocument|expoSharingAdapter|saveProgressClaimPdf|saveProgressClaimCsv/;
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name) && !rel.startsWith("src/reports/") && !allowed.has(rel) && pattern.test(src(rel))) offenders.push(rel);
    }
  };
  walk("src");
  if (pattern.test(src("App.tsx"))) offenders.push("App.tsx");
  assert.deepEqual(offenders, []);
});
