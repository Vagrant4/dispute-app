const assert = require("node:assert/strict");
const test = require("node:test");
const { source } = require("./locationTestHelpers");

const detail = source("src/screens/ProjectDetailScreen.tsx");
const reports = source("src/screens/ProgressClaimReportsScreen.tsx");

test("project PDF action comes after summary and before lock note and sessions", () => {
  const summary = detail.indexOf("{formatProjectSite(summary)}");
  const button = detail.indexOf('onPress={share} style={styles.actionButton}');
  const note = detail.indexOf("Subscribe to share PDFs · Details");
  const sessions = detail.indexOf('>Show sessions');
  assert.ok(summary < button && button < note && note < sessions);
  assert.match(detail, /onPress=\{share\} style=\{styles.actionButton\}>\s*<Text[^>]*>\{"Create & share PDF"\}/);
  assert.doesNotMatch(detail, /!locked \? <Pressable[^>]*onPress=\{share\}/);
});

test("lock note is one muted caption line with details collapsed initially", () => {
  assert.match(detail, /lockDetailsExpanded, setLockDetailsExpanded\] = useState\(false\)/);
  assert.match(detail, /<Text style=\{styles.projectExportLockNote\} numberOfLines=\{1\}>Subscribe to share PDFs · Details<\/Text>/);
  assert.match(detail, /locked && access\.subscription\?\.status !== "TRIALING"/);
  assert.match(source("src/styles.ts"), /projectExportLockNote: \{ color: theme.colors.textMuted, \.\.\.type.caption \}/);
  assert.match(detail, /onPress=\{\(\) => setLockDetailsExpanded\(\(value\) => !value\)\}/);
  assert.match(reports, /exportLocked && \(!renderActions \|\| lockDetailsExpanded\) \? \(/);
  assert.ok(reports.indexOf("{renderActions ? renderActions(") < reports.indexOf('accessibilityLabel="Dispute pack locked"'));
});

test("PDF press retains the guarded share path before any generation or sharing", () => {
  assert.match(reports, /renderActions\(\{ share: \(\) => void handleShareDisputePack\(\)/);
  const start = reports.indexOf("async function handleShareDisputePack()");
  const end = reports.indexOf("async function handleViewReport", start);
  const handler = reports.slice(start, end);
  assert.match(handler, /async function handleShareDisputePack\(\) \{\s*if \(!\(await ensureCanExport\(\)\) \|\| !selectedProjectId\) return;/);
  const guard = handler.indexOf("ensureCanExport()");
  for (const action of ["preparePay(", "generateAndArchiveProgressClaim(", "shareGeneratedDocument("]) {
    assert.ok(handler.indexOf(action) > guard, action);
  }
});
