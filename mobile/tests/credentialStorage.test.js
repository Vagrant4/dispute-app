const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("saved login credentials use platform secure storage instead of plaintext files", () => {
  const source = readFileSync(
    path.join(__dirname, "..", "src", "auth", "localAuthStorageExpo.ts"),
    "utf8",
  );

  assert.match(source, /expo-secure-store/);
  assert.match(source, /SecureStore\.setItemAsync/);
  assert.match(source, /SecureStore\.getItemAsync/);
  assert.match(source, /SecureStore\.deleteItemAsync/);
  assert.doesNotMatch(source, /writeAsStringAsync\(SAVED_LOGIN_FILE/);
});
