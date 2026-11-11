const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (file) => readFileSync(path.join(__dirname, "..", "src", file), "utf8");
const source = read("screens/SettingsScreen.tsx");
const mainRows = source.slice(source.indexOf("  const mainRows:"), source.indexOf("  const moreRows:"));
const moreRows = source.slice(source.indexOf("  const moreRows:"), source.indexOf("  const insideMore"));

test("Settings profile is above Pay rate, Language, Plan, Support and More", () => {
  assert.deepEqual([...mainRows.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]), ["Pay rate", "Language", "Plan", "Support", "More"]);
  assert.match(source, /styles\.settingsProfile/);
  assert.match(source, /account\.email/);
  assert.match(mainRows, /\$\{currency\} \$\{baseRate/);
  assert.match(mainRows, /value: "English"/);
  assert.match(mainRows, /planTrialLine\(subscription\)/);
  assert.match(source, /panel === "main" \? mainRows : moreRows/);
  assert.match(source, /style=\{styles.settingsRow\}/);
  assert.match(source, /styles.settingsChevron\}>›/);
  const styles = read("styles.ts");
  assert.match(styles, /settingsRow: \{ width: "100%", minHeight: (?:[6-9]\d|\d{3,})/);
  assert.match(styles, /settingsRowLabel: \{[^\n]*\.\.\.type.label/);
});

test("More keeps privacy and the wired record copy tools", () => {
  assert.deepEqual([...moreRows.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]), ["Privacy & data", "Keep a copy"]);
  assert.match(source, /panel === "privacy_data"/);
  assert.match(source, /<DeleteAccountScreen\s+embedded/);
  assert.match(source, /panel === "backup" \? <SettingsBackupScreen account=\{account\} exportOnly=\{!hasFullAccess\}/);
  assert.match(source, /requestPayRateLeave\(panel === "delete_account" \? "privacy_data" : insideMore \? "more" : "main"\)/);
});

test("main list uses plain wording and no segmented Account menu", () => {
  const strings = [...mainRows.matchAll(/"([^"\n]*)"|`([^`]+)`/g)].map((match) => match[1] ?? match[2]).join(" ");
  assert.doesNotMatch(strings, /\b(sync|cache|hash|device ID|debug|database|SQLite|storage|API|token|server|runtime|backup ID)\b/i);
  assert.doesNotMatch(source, /options\.map|item\.id === panel|styles\.eyebrow|>Account<|Work hours loaded from this phone/);
  assert.doesNotMatch(source, /isTrialDebugOverrideEnabled|Debug: trial clock/);
  assert.match(source, /setWorkHoursStatus\("Saved"\)/);
  assert.match(source, /styles.todayTitle\}>Pay rate/);
  assert.doesNotMatch(source, /onBlur=\{\(\) => void handleSaveWorkHours\(\)\}/);
  assert.doesNotMatch(source, /setTimeout\(\(\) => void handleSaveWorkHours\(\), 600\)/);
  assert.match(source, /testID="settings-pay-rate-save"/);
  assert.match(source, />Save<\/Text>/);
});

test("all legacy initialPanel ids map to their panels with More back navigation", () => {
  const mapping = source.slice(source.indexOf("const INITIAL_PANEL_PAGES:"), source.indexOf("export function SettingsScreen"));
  for (const [oldId, page] of Object.entries({ profile: "name", work_hours: "pay_rate", subscription: "plan", privacy_data: "privacy_data" })) {
    assert.match(mapping, new RegExp(`${oldId}: "${page}"`));
  }
  assert.match(source, /useState<SettingsPage>\(initialPanel \? INITIAL_PANEL_PAGES\[initialPanel\] : "main"\)/);
  assert.match(source, /setPanel\(initialPanel \? INITIAL_PANEL_PAGES\[initialPanel\] : "main"\);\s*\}, \[initialPanel\]\)/);
  assert.match(source, /const insideMore = panel === "privacy_data" \|\| panel === "backup"/);
});

test("Language stays English-only and Support reuses policy and deletion links", () => {
  assert.match(source, /English is the only language for now\./);
  assert.match(source, /panel === "support" \? <PrivacyScreen supportOnly/);
  const privacy = read("screens/PrivacyScreen.tsx");
  assert.match(privacy, /Questions or problems\? See our privacy and help pages\./);
  assert.match(privacy, /getAuthApiBaseUrl\(\)\}\/privacy/);
  assert.match(privacy, /getAuthApiBaseUrl\(\)\}\/account-deletion/);
  assert.match(source, /<ProfileSettingsPanel account=\{account\} onLogout=\{onLogout\}/);
  assert.match(read("screens/ProfileSettingsPanel.tsx"), />Logout<\/Text>/);
});

test("unset pay rates say Not set and saved rates keep their basis", () => {
  const expression = mainRows.match(/label: "Pay rate", value: (.+) \},/)[1];
  const value = (baseRate, rateBasis) => new Function("baseRate", "rateBasis", "currency", `return ${expression};`)(baseRate, rateBasis, "SGD");
  for (const rate of ["", "0", "0.00"]) assert.equal(value(rate, "daily"), "Not set");
  assert.equal(value("150", "daily"), "SGD 150 / day");
  assert.equal(value("3000", "monthly"), "SGD 3000 / month");
  assert.equal(value("15", "hourly"), "SGD 15 / hour");
  assert.match(source, /\{ id: "hourly", label: "Hourly" \}/);
});

test("Settings owns its main heading and sub-panels retain their back row and heading", () => {
  const app = readFileSync(path.join(__dirname, "..", "App.tsx"), "utf8");
  assert.match(app, /!account \|\| \(activeTab !== "settings" && activeTab !== "reports"\) \? <Text/);
  assert.match(source, /panel === "main"[\s\S]*styles.todayHeader[\s\S]*styles.settingsProfile[\s\S]*panel !== "main"/);
  const plan = read("screens/PlanBillingPanel.tsx");
  assert.match(plan, /styles.todayTitle\}>Plan<\/Text>/);
  assert.doesNotMatch(plan, /Plan & billing/);
  assert.match(source, /panel !== "main" \? \([\s\S]*?insideMore \? "‹ More" : "‹ Settings"/);
  assert.match(source, /panel === "more" \? <Text style=\{styles.todayTitle\}>More<\/Text> : null/);
  assert.match(source, /panel === "pay_rate" \? \([\s\S]*?<Text style=\{styles.todayTitle\}>Pay rate<\/Text>/);
});

test("each Settings sub-page owns exactly one title and no Settings header", () => {
  const mainHeader = source.match(/\{panel === "main" \? \([\s\S]*?\) : null\}/)[0];
  assert.equal((mainHeader.match(/styles.todayHeader/g) || []).length, 1);
  const rest = source.replace(mainHeader, "");
  assert.doesNotMatch(rest, /styles.todayHeader|styles.todayWordmark|>Settings<\/Text>/);
  for (const title of ["More", "Pay rate", "Language"]) {
    assert.equal((rest.match(new RegExp(`styles.todayTitle}>${title}<`, "g")) || []).length, 1);
  }
  for (const [file, title] of [["PlanBillingPanel", "Plan"], ["ProfileSettingsPanel", "Name"], ["SettingsBackupScreen", "Keep a copy"]]) {
    const panel = read(`screens/${file}.tsx`);
    assert.equal((panel.match(/styles.todayTitle/g) || []).length, 1);
    assert.match(panel, new RegExp(`styles.todayTitle}>${title}<`));
    assert.doesNotMatch(panel, /styles.todayHeader|styles.todayWordmark|>Settings<\/Text>/);
    assert.doesNotMatch(rest, new RegExp(`styles.todayTitle}>${title}<`));
  }
  const privacy = read("screens/PrivacyScreen.tsx");
  assert.match(privacy, /!supportOnly \? <>[\s\S]*styles.todayTitle}>Privacy &amp; data/);
  assert.match(privacy, /supportOnly \? styles.todayTitle : styles.rowLabel/);
  assert.doesNotMatch(privacy, /styles.todayHeader|styles.todayWordmark/);
  assert.match(read("screens/PlanBillingPanel.tsx"), /const trialLine = planTrialLine\(subscription\)/);
  assert.match(read("screens/PlanBillingPanel.tsx"), /trialLine \? <Text style=\{styles.muted\}>\{trialLine\}<\/Text> : null/);
  assert.match(source, /<PlanBillingPanel\s+subscription=\{subscription\}/);
});
