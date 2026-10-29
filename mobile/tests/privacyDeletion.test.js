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
  assert.match(guest, /without an account/);
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
