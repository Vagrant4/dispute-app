const assert = require("node:assert/strict");
const test = require("node:test");
const { source } = require("./locationTestHelpers");
const screen = (name) => source(`src/screens/${name}Screen.tsx`);
const primary = (text) => text.match(/styles\.(?:actionButton|photoFab|chipActive|quickActionPrimary)\b/g) || [];

test("Today reserves filled lime for Start / Stop, including expired access", () => {
  const home = screen("Home");
  assert.equal((home.match(/styles.todayClockButton/g) || []).length, 1);
  assert.match(home, /handleClockOut\(\) : handleClockIn\(\)/);
  assert.match(home, /"Clock out" : "Clock in"/);
  assert.doesNotMatch(home, /onCreateAccount|account\.isGuest/);
  assert.match(home, /startDisabled && styles.disabledButtonText/);
});

test("Projects use data-backed cards and secondary add actions", () => {
  const projects = screen("Projects");
  assert.equal(primary(projects).length, 0);
  assert.match(projects, /onPress=\{\(\) => setOpenProjectId\(project.id\)\}/);
  const row = projects.slice(projects.indexOf("const card ="), projects.indexOf("return <View"));
  assert.match(row, /project.name/);
  assert.match(row, /latestPhotoUri/);
  assert.match(row, /projectStatus/);
  assert.match(row, /siteAddress/);
  assert.match(projects, /styles.actionButtonSecondary[\s\S]*>\+ Add project<\/Text>/);
  assert.equal(primary(source("src/screens/ProjectNameSheet.tsx")).length, 1);
});

test("Project detail reserves filled lime for its gated PDF action", () => {
  const detail = screen("ProjectDetail");
  assert.equal(primary(detail).length, 1);
  assert.match(detail, /testID="create-share-pdf"[\s\S]*onPress=\{share\}[\s\S]*style=\{styles.actionButton\}/);
  assert.equal((detail.match(/Create &amp; share PDF/g) || []).length, 1);
  assert.equal(primary(source("src/screens/ProjectPayCard.tsx")).length, 0);
  const reports = source("src/screens/ProgressClaimReportsScreen.tsx");
  for (const handler of ["onCreateAccount", "onOpenPlanBilling"]) {
    assert.ok(reports.includes(`onPress={${handler}} style={styles.actionButtonSecondary}`));
  }
});

test("Photos has one camera action for empty and populated galleries; sheet actions are secondary", () => {
  const photos = screen("PhotoEvidence");
  assert.equal(primary(photos).length, 1);
  assert.match(photos, /handlePhotoAction\("camera"\)[^\n]*styles.photoFab/);
  assert.match(photos, /onLongPress=\{\(\) => setCaptureSheetOpen\(true\)\}/);
  assert.match(photos, /handleSave\(\)[^\n]*styles.actionButtonSecondary/);
  assert.match(photos, /handlePhotoAction\("gallery"\)[^\n]*styles.actionButtonSecondary/);
  assert.match(photos, /photoSealBadge\(row\)/);
  assert.match(source("src/photos/photoSeal.ts"), /Sealed on this phone/);
});

test("Today shows one summary and a direct project picker without Details", () => {
  const home = screen("Home");
  assert.doesNotMatch(home, /detailsExpanded|DAY_TYPE_OPTIONS|Recent time|Started:|Stopped:/);
  assert.match(home, /setProjectPickerOpen/);
  assert.equal((home.match(/styles.todayClock\}/g) || []).length, 1);
});

test("Project detail omits sessions and breakdown", () => {
  const detail = screen("ProjectDetail");
  for (const content of ["sessionsExpanded", "totalOvertimeHours", "Pay rate:", "clockOutLocationSource"]) assert.ok(!detail.includes(content));
  assert.doesNotMatch(screen("Home"), /styles.eyebrow|>Work today</);
  assert.match(screen("Projects"), /styles.screenTitle\}>Projects<\/Text>/);
  assert.doesNotMatch(screen("PhotoEvidence"), />Photos<\/Text>/);
  assert.match(detail, /project\?\.name/);
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
