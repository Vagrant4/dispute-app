const assert = require("node:assert/strict");
const test = require("node:test");
const { source } = require("./locationTestHelpers");
const screen = (name) => source(`src/screens/${name}Screen.tsx`);
const primary = (text) => text.match(/styles\.(?:actionButton|photoFab|chipActive|quickActionPrimary)\b/g) || [];

test("Today reserves filled lime for Start / Stop, including expired access", () => {
  const home = screen("Home");
  assert.equal(primary(home).length, 1);
  assert.match(home, /handleClockOut\(\) : handleClockIn\(\)/);
  assert.match(home, /"Stop work" : "Start work"/);
  assert.match(home, /onPress=\{onCreateAccount\} style=\{styles.actionButtonSecondary\}/);
  assert.match(home, /selected \? styles.selectedSecondaryText/);
});

test("Projects open through plain rows; New project and name sheets are secondary", () => {
  const projects = screen("Projects");
  assert.equal(primary(projects).length, 0);
  assert.match(projects, /onPress=\{\(\) => setOpenProjectId\(project.id\)\}/);
  const row = projects.slice(projects.indexOf("const card ="), projects.indexOf("return <>"));
  assert.match(row, /project.name/);
  assert.match(row, /minutesThisWeek/);
  assert.match(row, /styles.settingsChevron/);
  assert.doesNotMatch(row, /photoCount|isActive|lastWorkedAt|formatProjectSite/);
  assert.match(projects, /styles.actionButtonSecondary[\s\S]*>New project<\/Text>/);
  assert.equal(primary(source("src/screens/ProjectNameSheet.tsx")).length, 0);
});

test("Project detail reserves filled lime for its gated PDF action", () => {
  const detail = screen("ProjectDetail");
  assert.equal(primary(detail).length, 1);
  assert.match(detail, /<Pressable accessibilityRole="button" onPress=\{share\} style=\{styles.actionButton\}/);
  assert.equal((detail.match(/Create & share PDF/g) || []).length, 1);
  assert.equal(primary(source("src/screens/ProjectPayCard.tsx")).length, 0);
  const reports = source("src/screens/ProgressClaimReportsScreen.tsx");
  for (const handler of ["onCreateAccount", "onOpenPlanBilling"]) {
    assert.ok(reports.includes(`onPress={${handler}} style={styles.actionButtonSecondary}`));
  }
});

test("Photos has one camera action for empty and populated galleries; sheet actions are secondary", () => {
  const photos = screen("PhotoEvidence");
  assert.equal(primary(photos).length, 1);
  assert.match(photos, /handlePhotoAction\("camera"\)[^\n]*styles.photoFab[^\n]*>Take photo<\/Text>/);
  assert.match(photos, /onLongPress=\{\(\) => setCaptureSheetOpen\(true\)\}/);
  assert.match(photos, /handleSave\(\)[^\n]*styles.actionButtonSecondary/);
  assert.match(photos, /handlePhotoAction\("gallery"\)[^\n]*styles.actionButtonSecondary/);
  assert.match(photos, /photoSealBadge\(row\)/);
  assert.match(source("src/photos/photoSeal.ts"), /Sealed on this phone/);
});

test("Today Details starts collapsed and contains times, day controls, picker and recent entries", () => {
  const home = screen("Home");
  assert.match(home, /\[detailsExpanded, setDetailsExpanded\] = useState\(false\)/);
  assert.match(home, /accessibilityState=\{\{ expanded: detailsExpanded \}\}/);
  assert.match(home, />Details \{detailsExpanded/);
  const details = home.slice(home.indexOf("{detailsExpanded ? <>"));
  for (const content of ["Started:", "Stopped:", "DAY_TYPE_OPTIONS.map", "setProjectPickerOpen", "Recent time", "Confirm Delete"]) assert.ok(details.includes(content));
  assert.equal((home.slice(home.indexOf("return ("), home.indexOf("{detailsExpanded ? <>")).match(/styles.metricValue/g) || []).length, 1);
});

test("Project sessions and breakdown start collapsed; each screen has one title", () => {
  const detail = screen("ProjectDetail");
  assert.match(detail, /\[sessionsExpanded, setSessionsExpanded\] = useState\(false\)/);
  assert.match(detail, /accessibilityState=\{\{ expanded: sessionsExpanded \}\}/);
  assert.match(detail, />Show sessions \{sessionsExpanded/);
  const details = detail.slice(detail.indexOf("{sessionsExpanded ? <>"));
  for (const content of ["totalOvertimeHours", "totalClaimAmountCents", "entries.map", "Pay rate:", "clockOutLocationSource"]) assert.ok(details.includes(content));
  assert.doesNotMatch(screen("Home"), /styles.eyebrow|>Work today<|>Today</);
  assert.match(screen("Projects"), /styles.screenTitle\}>Projects<\/Text>/);
  assert.doesNotMatch(screen("PhotoEvidence"), />Photos<\/Text>/);
  assert.equal((detail.match(/>\{project.name\}<\/Text>/g) || []).length, 1);
});

test("shared spacing is generous and bottom tabs have no filled background", () => {
  const styles = source("src/styles.ts");
  for (const key of ["card", "clockPanel"]) {
    assert.match(styles, new RegExp(`  ${key}: \\{[^}]*gap: theme.spacing.lg,[^}]*padding: space.md,`));
  }
  for (const key of ["bottomTabItem", "bottomTabActive"]) {
    const block = styles.match(new RegExp(`${key}: \\{([^}]+)\\}`))[1];
    assert.doesNotMatch(block, /backgroundColor|borderRadius/);
  }
});
