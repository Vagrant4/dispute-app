const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const read = (file) => readFileSync(path.join(__dirname, "..", file), "utf8");
const files = ["SettingsScreen", "ProfileSettingsPanel", "PlanBillingPanel", "PrivacyScreen", "SettingsBackupScreen"];
const settings = read("src/screens/SettingsScreen.tsx");
const styles = read("src/styles.ts");

test("Settings uses grouped rounded cards without row dividers", () => {
  for (const file of files) {
    const source = read(`src/screens/${file}.tsx`);
    assert.doesNotMatch(source, /styles\.(?:card|statusCard|warningCard|metricTile|eyebrow)\b/, file);
  }
  assert.match(styles, /settingsList: \{[^\n]*backgroundColor[^\n]*borderRadius/);
  const row = styles.match(/settingsRow: \{([^}]+)\}/)[1];
  assert.doesNotMatch(row, /borderTopWidth|borderBottomWidth/);
  assert.match(settings, /styles.todayTitle\}>Settings/);
  assert.match(settings, /styles.settingsBackText/);
  assert.doesNotMatch(settings, /numberOfLines=\{1\} style=\{styles.settingsRowSubtitle\}/);
});

test("Settings profile email may wrap instead of truncating", () => {
  assert.match(settings, /numberOfLines=\{2\} style=\{\[styles\.muted, styles\.settingsProfileEmail\]\}/);
});

test("all six main and two More rows use the supplied PNG line icons", () => {
  for (const icon of ["name", "pay", "language", "plan", "support", "more", "privacy", "backup"]) {
    assert.ok(settings.includes(`require("../../assets/icons/set-${icon}.png")`));
    for (const scale of ["", "@2x", "@3x"]) assert.ok(existsSync(path.join(__dirname, `../assets/icons/set-${icon}${scale}.png`)));
  }
  assert.match(settings, /<Image accessible=\{false\} source=\{rowIcons\[item.id as keyof typeof rowIcons\]\} style=\{styles.todayRowIcon\}/);
  assert.match(settings, /styles.todayIconTile/);
  assert.match(styles, /todayIconTile: \{ width: 40, height: 40, borderRadius: today.tileRadius/);
  assert.match(styles, /todayRowIcon: \{ width: 22, height: 22, tintColor: theme.colors.text/);
});

test("Settings uses lime only for primary actions and the wordmark", () => {
  // Inspect every referenced style, including shared styles used by these panels.
  for (const file of files) {
    const source = read(`src/screens/${file}.tsx`);
    assert.doesNotMatch(source, /theme.colors.primary/);
    for (const [, key] of source.matchAll(/styles\.(\w+)/g)) {
      const definition = styles.match(new RegExp(`^  ${key}: \\{[\\s\\S]*?(?=^  \\w+:|^\\}\\);)`, "m"));
      assert.ok(definition, key);
      if (/theme.colors.primary/.test(definition[0])) assert.ok(key === "actionButton" || (file === "SettingsScreen" && ["todayWordmark", "settingsProfileAvatar", "settingsProfileInitial", "settingsLogoutText"].includes(key)), `${file}: ${key}`);
    }
    if (!["SettingsScreen", "PlanBillingPanel"].includes(file)) assert.doesNotMatch(source, /styles.actionButton\b/);
  }
  assert.equal((settings.match(/style=\{styles.actionButton\}/g) || []).length, 1);
  assert.match(styles, /actionButton: \{[\s\S]*?height: control.height/);
});

test("Pay retains its fields and saves the user's rate only when Save is pressed", () => {
  assert.ok(settings.includes("Set your normal hours and rates. Overtime, off-day and holiday rates apply automatically."));
  for (const label of ["Base rate amount", "Normal work start time", "Normal work end time", "Overtime rate multiplier", "Off day rate multiplier", "Holiday rate multiplier", "Currency dropdown", "Rate entry type dropdown"]) assert.ok(settings.includes(`accessibilityLabel="${label}"`));
  assert.match(settings, /testID="pay-rate-own-rate"/);
  assert.doesNotMatch(settings, /onBlur=\{\(\) => void handleSaveWorkHours\(\)\}/);
  assert.doesNotMatch(settings, /setTimeout\(\(\) => void handleSaveWorkHours\(\), 600\)/);
  assert.match(settings, /testID="settings-pay-rate-save"/);
  assert.match(settings, /disabled=\{!isPayRateDirty\(\)\}/);
  assert.match(settings, />Save<\/Text>/);
  assert.match(settings, /await saveWorkHours\(userId/);
  assert.match(settings, /setWorkHoursStatus\("Saved"\)/);
});

test("Pay rate uses a lunch picker and protects dirty changes before leaving", () => {
  for (const label of ["None", "30 min", "1 h", "1.5 h", "2 h", "Custom"]) assert.match(settings, new RegExp(label));
  assert.match(settings, /testID="settings-lunch-break"/);
  assert.match(settings, /testID="settings-lunch-break-sheet"/);
  assert.match(settings, /Custom lunch break minutes/);
  assert.match(settings, /requestPayRateLeave/);
  assert.match(settings, /Save changes before leaving\?/);
  assert.match(settings, />Discard<\/Text>/);
  assert.match(settings, /BackHandler\.addEventListener/);
});

test("Paid by options remain complete without between-option dividers", () => {
  for (const styleName of ["dropdownOption", "settingsDropdownOptionSelected", "dropdownOptionActive"]) {
    const definition = styles.match(new RegExp(`^  ${styleName}: \\{([\\s\\S]*?)^  \\w+:`, "m"));
    assert.ok(definition, `${styleName} style is defined`);
    assert.doesNotMatch(definition[1], /border(?:Top|Bottom)(?:Width|Color)|hairlineWidth/);
  }
  for (const option of ["Daily", "Monthly", "Hourly"]) {
    assert.match(settings, new RegExp(`\\{ id: "${option.toLowerCase()}", label: "${option}" \\}`));
    assert.match(settings, /RATE_BASIS_OPTIONS\.map\([\s\S]*?accessibilityLabel=\{`Rate entry \$\{option\.label\}`\}/);
  }
});
