const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("phone app has separate create account and login pages before main tabs", () => {
  const appSource = readFileSync(
    path.join(__dirname, "..", "App.tsx"),
    "utf8",
  );
  const createAccountSource = readFileSync(
    path.join(__dirname, "..", "src", "screens", "CreateAccountScreen.tsx"),
    "utf8",
  );
  const logoSource = readFileSync(
    path.join(__dirname, "..", "src", "screens", "LogoScreen.tsx"),
    "utf8",
  );
  const loginSource = readFileSync(
    path.join(__dirname, "..", "src", "screens", "LoginScreen.tsx"),
    "utf8",
  );
  const verifySource = readFileSync(
    path.join(__dirname, "..", "src", "screens", "VerifyEmailScreen.tsx"),
    "utf8",
  );

  assert.match(appSource, /useState<"logo" \| "create" \| "verify" \| "login">\("logo"\)/);
  assert.match(appSource, /LogoScreen/);
  assert.match(appSource, /pendingVerification/);
  assert.match(appSource, /VerifyEmailScreen/);
  assert.match(appSource, /account \? \(/);
  assert.match(logoSource, /DISPUTE/);
  assert.match(logoSource, /logo-mark\.png/);
  assert.match(logoSource, /DISPUTE app logo/);
  assert.match(logoSource, /Login/);
  assert.match(logoSource, /Create account/);
  assert.match(createAccountSource, /Create account/);
  assert.match(createAccountSource, /Create account mobile number/);
  assert.match(createAccountSource, /registerRemoteAccount/);
  assert.match(createAccountSource, /Register and verify email/);
  assert.match(createAccountSource, /Show password/);
  assert.match(createAccountSource, /Show confirm password/);
  assert.match(createAccountSource, /Already have an account\? Login/);
  assert.match(verifySource, /Verify email/);
  assert.match(verifySource, /Email verification code/);
  assert.match(verifySource, /verifyRemoteEmail/);
  assert.doesNotMatch(loginSource, /<Text style=\{styles\.eyebrow\}>Login<\/Text>/);
  assert.match(loginSource, /Welcome back/);
  assert.match(loginSource, /logo-mark\.png/);
  assert.match(loginSource, /DISPUTE app logo/);
  assert.match(loginSource, /loginRemoteAccount/);
  assert.match(loginSource, /Show password/);
  assert.match(loginSource, /Remember login details/);
  assert.match(loginSource, /loadSavedLoginDetails/);
  assert.match(loginSource, /saveSavedLoginDetails/);
  assert.match(loginSource, /New user\? Create account/);
});

test("remote auth validates account creation verification and login fields", () => {
  const remoteAuthSource = readFileSync(
    path.join(__dirname, "..", "src", "auth", "remoteAuth.ts"),
    "utf8",
  );

  assert.match(remoteAuthSource, /registerRemoteAccount/);
  assert.match(remoteAuthSource, /verifyRemoteEmail/);
  assert.match(remoteAuthSource, /loginRemoteAccount/);
  assert.match(remoteAuthSource, /Passwords do not match/);
  assert.match(remoteAuthSource, /6-digit verification code/);
});
