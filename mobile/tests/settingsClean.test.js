const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const read = (file) => readFileSync(path.join(__dirname, "..", file), "utf8");
const files = ["SettingsScreen", "ProfileSettingsPanel", "PlanBillingPanel", "PrivacyScreen", "SettingsBackupScreen"];
const settings = read("src/screens/SettingsScreen.tsx");
const styles = read("src/styles.ts");

test("Settings and its panels use plain sections without card boxes", () => {
  for (const file of files) {
    const source = read(`src/screens/${file}.tsx`);
    assert.doesNotMatch(source, /styles\.(?:card|statusCard|warningCard|metricTile|eyebrow)\b/, file);
  }
  for (const key of ["settingsList", "settingsSection", "settingsRow"]) {
    const definition = styles.match(new RegExp(`  ${key}: \\{[^\\n]+`))[0];
    assert.doesNotMatch(definition, /backgroundColor|borderRadius|borderWidth:/);
  }
  assert.match(styles, /settingsRow: \{[^\n]*borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border/);
  assert.match(settings, /styles.todayTitle\}>Settings/);
  assert.match(settings, /styles.settingsBackText/);
  assert.doesNotMatch(settings, /numberOfLines=\{1\} style=\{styles.settingsRowSubtitle\}/);
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
      if (/theme.colors.primary/.test(definition[0])) assert.ok(key === "actionButton" || (file === "SettingsScreen" && key === "todayWordmark"), `${file}: ${key}`);
    }
    if (!["SettingsScreen", "PlanBillingPanel"].includes(file)) assert.doesNotMatch(source, /styles.actionButton\b/);
  }
  assert.equal((settings.match(/style=\{styles.actionButton\}/g) || []).length, 2);
  assert.match(styles, /actionButton: \{[\s\S]*?height: control.height/);
});

test("Pay retains its fields and save handler with the concise explanation", () => {
  assert.ok(settings.includes("Set your normal hours and rates. Overtime, off-day and holiday rates apply automatically."));
  for (const label of ["Base rate amount", "Normal work start time", "Normal work end time", "Overtime rate multiplier", "Off day rate multiplier", "Holiday rate multiplier", "Currency dropdown", "Rate entry type dropdown"]) assert.ok(settings.includes(`accessibilityLabel="${label}"`));
  assert.match(settings, /onPress=\{\(\) => void handleSaveWorkHours\(\)\}\s+style=\{styles.actionButton\}[\s\S]*?>Save<\/Text>/);
  assert.match(settings, /await saveWorkHours\(userId/);
  assert.match(settings, /setWorkHoursStatus\("Saved"\)/);
});
