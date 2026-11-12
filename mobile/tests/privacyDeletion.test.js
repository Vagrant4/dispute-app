const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8");
const deletion = read("screens/DeleteAccountScreen.tsx");
const settings = read("screens/SettingsScreen.tsx");

test("deletion summary is account-only", () => {
  assert.doesNotMatch(deletion, /isGuest|without an account|Open phone settings/);
  assert.match(deletion, /account for \$\{account.email\}/);
});

test("Privacy has one divider row and mounts the form only on the delete sub-page", () => {
  const privacy = settings.slice(settings.indexOf('{panel === "privacy_data" ? ('), settings.indexOf('{panel === "delete_account" ? ('));
  assert.doesNotMatch(privacy, /<DeleteAccountScreen/);
  assert.equal((privacy.match(/>Delete account<\/Text>/g) || []).length, 1);
  assert.match(privacy, /onPress=\{\(\) => setPanel\("delete_account"\)\} style=\{styles.settingsRow\}/);
  assert.match(privacy, /styles.settingsChevron}>›/);
  assert.match(settings, /panel === "delete_account" \? \(\s*<DeleteAccountScreen/);
  assert.match(settings, /panel === "delete_account" \? "privacy_data"/);
  assert.match(settings, /panel === "delete_account" \? "‹ Privacy & data"/);
  assert.equal((deletion.match(/styles.todayTitle}>Delete account</g) || []).length, 1);
});

test("signed-in summary includes the policy record line", () => {
  assert.match(deletion, /<Text style=\{styles.body\}>\s*DISPUTE keeps a short record with no personal details that a deletion was asked for: a request number, the time, and whether clean-up finished. Google Play or our payment partner may keep their own payment records.\s*<\/Text>/);
});

test("permanent confirm uses danger red and white text", () => {
  assert.match(deletion, /onPress=\{\(\) => void permanentlyDeleteAccount\(\)\}[\s\S]*?styles.accountDeletionConfirmButton/);
  const styles = read("styles.ts");
  const button = styles.match(/accountDeletionConfirmButton: \{([\s\S]*?)\n  \}/)[1];
  assert.match(button, /backgroundColor: theme.colors.danger/);
  assert.doesNotMatch(button, /primary/);
  assert.match(styles, /accountDeletionConfirmButtonText: \{\s*color: "#FFFFFF"/);
});

test("danger buttons use red danger tokens and readable text", () => {
  const styles = read("styles.ts");
  const block = (name) => styles.slice(styles.indexOf(`  ${name}: {`)).match(/^[\s\S]*?\n  \}/)[0];
  assert.match(block("dangerButton"), /backgroundColor: theme.colors.danger,/);
  assert.match(block("dangerButton"), /borderColor: theme.colors.danger,/);
  assert.match(block("dangerButtonSecondary"), /backgroundColor: theme.colors.dangerHalo,/);
  assert.match(block("dangerButtonSecondary"), /borderColor: theme.colors.danger,/);
  assert.match(block("dangerButtonText"), /color: theme.colors.onDanger,/);
  assert.match(styles, /onDanger: "#FFFFFF"/);
  assert.match(block("dangerButtonSecondaryText"), /color: theme.colors.text,/);
  for (const name of ["dangerButton", "dangerButtonSecondary", "dangerButtonText", "dangerButtonSecondaryText"]) {
    assert.doesNotMatch(block(name), /warningBorder|warningSurface|primary/);
  }
});

test("signed-in deletion screen retains password, DELETE and danger controls", () => {
  assert.equal((deletion.match(/<TextInput/g) || []).length, 2);
  assert.match(deletion, /accessibilityLabel="Account deletion current password"/);
  assert.match(deletion, /secureTextEntry/);
  assert.match(deletion, /Type \{ACCOUNT_DELETION_CONFIRMATION\} to confirm/);
  assert.match(deletion, /onPress=\{reviewDeletion\}/);
  assert.match(deletion, /styles.dangerButtonSecondary/);
  assert.match(deletion, /onPress=\{\(\) => void permanentlyDeleteAccount\(\)\}/);
  assert.match(deletion, /styles.accountDeletionConfirmButton/);
  assert.match(deletion, />Manage subscription<\/Text>/);
  assert.match(deletion, /styles.statusMessage/);
});
