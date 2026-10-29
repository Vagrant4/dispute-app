const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (file) => readFileSync(path.join(__dirname, "..", "src", file), "utf8");
const source = read("screens/SettingsScreen.tsx");
const mainRows = source.slice(source.indexOf("  const mainRows:"), source.indexOf("  const moreRows:"));
const moreRows = source.slice(source.indexOf("  const moreRows:"), source.indexOf("  const insideMore"));

test("Settings main rows are exactly Name, Pay rate, Language, Plan, Support, More", () => {
  assert.deepEqual([...mainRows.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]), ["Name", "Pay rate", "Language", "Plan", "Support", "More"]);
  assert.match(mainRows, /account\.name\?\.trim\(\) \|\| "Not set"/);
  assert.match(mainRows, /\$\{currency\} \$\{baseRate/);
  assert.match(mainRows, /value: "English"/);
  assert.match(mainRows, /formatTrialCountdown\(subscription\)/);
  assert.match(source, /panel === "main" \? mainRows : moreRows/);
  assert.match(source, /style=\{styles.settingsRow\}/);
  assert.match(source, /styles.settingsChevron\}>›/);
  const styles = read("styles.ts");
  assert.match(styles, /settingsRow: \{ width: "100%", minHeight: (?:[6-9]\d|\d{3,})/);
  assert.match(styles, /settingsRowLabel: \{[^\n]*\.\.\.type.label/);
});

test("More keeps referrals, privacy and the wired record copy tools", () => {
  assert.deepEqual([...moreRows.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]), ["Refer a friend", "Privacy & data", "Keep a copy"]);
  assert.match(source, /panel === "referrals" \? <ReferralScreen/);
  assert.match(source, /panel === "privacy_data"/);
  assert.match(source, /<DeleteAccountScreen\s+embedded/);
  assert.match(source, /panel === "backup" \? <SettingsBackupScreen account=\{account\} exportOnly=\{!hasFullAccess\}/);
  assert.match(source, /setPanel\(insideMore \? "more" : "main"\)/);
});

test("main list uses plain wording and no segmented Account menu", () => {
  const strings = [...mainRows.matchAll(/"([^"\n]*)"|`([^`]+)`/g)].map((match) => match[1] ?? match[2]).join(" ");
  assert.doesNotMatch(strings, /\b(sync|cache|hash|device ID|debug|database|SQLite|storage|API|token|server|runtime|backup ID)\b/i);
  assert.doesNotMatch(source, /options\.map|item\.id === panel|styles\.eyebrow|>Account<|Work hours loaded from this phone/);
  assert.match(source, /panel === "more" \? \([\s\S]*isTrialDebugOverrideEnabled\(\)/);
  assert.match(source, /setWorkHoursStatus\("Saved"\)/);
  assert.match(source, /styles.heading\}>Pay rate/);
  assert.match(source, /onPress=\{\(\) => void handleSaveWorkHours\(\)\}[\s\S]*?>Save<\/Text>/);
});

test("all legacy initialPanel ids map to their panels with More back navigation", () => {
  const mapping = source.slice(source.indexOf("const INITIAL_PANEL_PAGES:"), source.indexOf("export function SettingsScreen"));
  for (const [oldId, page] of Object.entries({ profile: "name", work_hours: "pay_rate", subscription: "plan", referrals: "referrals", privacy_data: "privacy_data" })) {
    assert.match(mapping, new RegExp(`${oldId}: "${page}"`));
  }
  assert.match(source, /useState<SettingsPage>\(initialPanel \? INITIAL_PANEL_PAGES\[initialPanel\] : "main"\)/);
  assert.match(source, /setPanel\(initialPanel \? INITIAL_PANEL_PAGES\[initialPanel\] : "main"\);\s*\}, \[initialPanel\]\)/);
  assert.match(source, /const insideMore = panel === "referrals" \|\| panel === "privacy_data" \|\| panel === "backup"/);
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
});

test("Settings owns its main heading and sub-panels retain their back row and heading", () => {
  const app = readFileSync(path.join(__dirname, "..", "App.tsx"), "utf8");
  assert.match(app, /!account \|\| \(activeTab !== "settings" && activeTab !== "reports"\) \? <Text/);
  assert.match(source, /panel === "main" \? <Text style=\{styles.screenTitle\}>Settings<\/Text> : null/);
  assert.match(source, /panel !== "main" \? \([\s\S]*?insideMore \? "‹ More" : "‹ Settings"/);
  assert.match(source, /panel === "more" \? <Text style=\{styles.heading\}>More<\/Text> : null/);
  assert.match(source, /panel === "pay_rate" \? \([\s\S]*?<Text style=\{styles.heading\}>Pay rate<\/Text>/);
});
