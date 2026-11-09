const assert = require("node:assert/strict");
const test = require("node:test");
const { source } = require("./locationTestHelpers");
const detail = source("src/screens/ProjectDetailScreen.tsx");
const reports = source("src/screens/ProgressClaimReportsScreen.tsx");

test("project page ends at its guarded PDF action", () => {
  assert.match(detail, /testID="project-picker"/);
  assert.match(detail, /testID="create-share-pdf"[\s\S]*onPress=\{share\}/);
  for (const removed of ["Show sessions", "Earlier reports", "No sessions yet", "Project complete", "Photos"]) assert.doesNotMatch(detail, new RegExp(removed));
});

test("compact project report returns before lock and archive UI", () => {
  assert.match(reports, /if \(renderActions\) \{/);
  assert.doesNotMatch(detail, /lockDetailsExpanded|Subscribe to share PDFs/);
});

test("PDF press retains the guarded share path before generation or sharing", () => {
  const start = reports.indexOf("async function handleShareDisputePack()");
  const end = reports.indexOf("async function handleViewReport", start);
  const handler = reports.slice(start, end);
  const guard = handler.indexOf("ensureCanExport()");
  assert.ok(guard >= 0);
  for (const action of ["preparePay(", "generateAndArchiveProgressClaim(", "shareGeneratedDocument("]) assert.ok(handler.indexOf(action) > guard);
});
