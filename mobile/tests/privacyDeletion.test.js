const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8");
const deletion = read("screens/DeleteAccountScreen.tsx");
const settings = read("screens/SettingsScreen.tsx");

test("guest summary has no email interpolation and describes the existing deletion limitation", () => {
  assert.match(deletion, /account.isGuest === true \|\| !account.email.trim\(\)/);
  const guest = deletion.match(/\{isGuest\s*\? "([^"]+)"/)[1];
  assert.doesNotMatch(guest, /for ,|email|\$\{/);
  assert.equal(guest, "You are using DISPUTE without an account. Deleting an account needs a signed-in account. To remove guest projects, time entries, places, photos, reports and settings from this phone, clear DISPUTE storage in phone Settings. You cannot get them back. Copies you saved or shared elsewhere are not removed.");
  assert.match(guest, /clear DISPUTE storage in phone Settings/);
  assert.match(guest, /Copies you saved or shared elsewhere are not removed/);
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

test("signed-in summary includes the policy record line and guests omit it", () => {
  assert.match(deletion, /!isGuest \? <Text style=\{styles.body\}>\s*DISPUTE keeps a short record with no personal details that a deletion was asked for: a request number, the time, and whether clean-up finished. Google Play or our payment partner may keep their own payment records.\s*<\/Text> : null/);
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

// Keep all account-only controls inside the signed-in side of this render branch.
const guestControls = deletion.split("      {isGuest ? (")[1].split("      ) : (")[0];
const signedInControls = deletion.split("      {isGuest ? (")[1].slice(deletion.split("      {isGuest ? (")[1].indexOf("      ) : (") + "      ) : (".length);

test("guest deletion screen offers only the phone settings button", () => {
  assert.equal((guestControls.match(/<Pressable/g) || []).length, 1);
  assert.match(guestControls, /onPress=\{\(\) => void Linking.openSettings\(\)\}/);
  assert.match(guestControls, /style=\{styles.actionButtonSecondary\}/);
  assert.match(guestControls, />Open phone settings<\/Text>/);
  assert.doesNotMatch(guestControls, /TextInput|password|ACCOUNT_DELETION_CONFIRMATION|DELETE|reviewDeletion|permanentlyDeleteAccount|dangerButton|Manage subscription|subscription|statusMessage/);
  const guestTitle = deletion.slice(deletion.indexOf("  return ("), deletion.indexOf("      <Text style={styles.body}>"));
  assert.match(guestTitle, /<Text style=\{styles.todayTitle\}>Delete account<\/Text>/);
  assert.doesNotMatch(guestTitle, /isGuest/);
});

test("signed-in deletion screen retains password, DELETE and danger controls", () => {
  assert.equal((signedInControls.match(/<TextInput/g) || []).length, 2);
  assert.match(signedInControls, /accessibilityLabel="Account deletion current password"/);
  assert.match(signedInControls, /secureTextEntry/);
  assert.match(signedInControls, /Type \{ACCOUNT_DELETION_CONFIRMATION\} to confirm/);
  assert.match(signedInControls, /onPress=\{reviewDeletion\}/);
  assert.match(signedInControls, /styles.dangerButtonSecondary/);
  assert.match(signedInControls, /onPress=\{\(\) => void permanentlyDeleteAccount\(\)\}/);
  assert.match(signedInControls, /styles.accountDeletionConfirmButton/);
  assert.match(signedInControls, />Manage subscription<\/Text>/);
  assert.match(signedInControls, /styles.statusMessage/);
});
