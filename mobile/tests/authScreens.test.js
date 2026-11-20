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
  const settingsSource = readFileSync(
    path.join(__dirname, "..", "src", "screens", "SettingsScreen.tsx"),
    "utf8",
  );
  const deleteAccountSource = readFileSync(
    path.join(__dirname, "..", "src", "screens", "DeleteAccountScreen.tsx"),
    "utf8",
  );
  const remoteAuthSource = readFileSync(
    path.join(__dirname, "..", "src", "auth", "remoteAuth.ts"),
    "utf8",
  );
  const deletionRuntimeSource = readFileSync(
    path.join(__dirname, "..", "src", "account", "accountDeletionExpo.ts"),
    "utf8",
  );

  assert.match(appSource, /useState<"logo" \| "create" \| "verify" \| "login" \| "forgot">\("logo"\)/);
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
  const activeCreateAccountSource = createAccountSource.split("function ModernCreateAccountScreen")[1];
  assert.ok(activeCreateAccountSource, "active create account form is present");
  assert.doesNotMatch(activeCreateAccountSource, /Mobile number|Country code|Referral code/);
  assert.match(createAccountSource, /registerRemoteAccount/);
  assert.match(createAccountSource, /Create your account/);
  assert.match(createAccountSource, /Show password/);
  assert.match(activeCreateAccountSource, /eye-outline/);
  assert.match(createAccountSource, /SocialAuthButtons/);
  assert.doesNotMatch(createAccountSource, /Confirm account password/);
  assert.match(activeCreateAccountSource, /Already have an account\?/);
  assert.match(activeCreateAccountSource, /authFooterLink}>Login/);
  assert.match(verifySource, /Verify code/);
  assert.match(verifySource, /Email verification code/);
  assert.match(verifySource, /Verify code/);
  assert.match(verifySource, /Resend code/);
  assert.match(verifySource, /resendRemoteVerificationCode/);
  assert.match(verifySource, /verifyRemoteEmail/);
  assert.doesNotMatch(loginSource, /<Text style=\{styles\.eyebrow\}>Login<\/Text>/);
  assert.match(loginSource, /Welcome back/);
  assert.match(loginSource, /logo-mark\.png/);
  assert.match(loginSource, /DISPUTE app logo/);
  assert.match(loginSource, /loginRemoteAccount/);
  assert.match(loginSource, /Continue verification/);
  assert.match(loginSource, /requestRemoteEmailVerification/);
  assert.match(loginSource, /eye-outline/);
  assert.match(loginSource, /Remember login details/);
  assert.match(loginSource, /loadSavedLoginDetails/);
  assert.match(loginSource, /saveSavedLoginDetails/);
  assert.match(loginSource, /New to Dispute\?/);
  assert.match(loginSource, /authFooterLink}>Create account/);
  assert.match(loginSource, /styles\.authFormCard[\s\S]*Remember login details[\s\S]*<\/View>\s*\n\s*<Pressable[\s\S]*onPress=\{handleLogin\}/);
  assert.match(loginSource, /styles\.passwordInputRow/);
  const socialButtonsSource = readFileSync(path.join(__dirname, "..", "src", "components", "SocialAuthButtons.tsx"), "utf8");
  assert.match(socialButtonsSource, /socialAuthButtonContent/);
  assert.match(socialButtonsSource, /#EA4335/);
  assert.match(socialButtonsSource, /#FBBC05/);
  assert.match(socialButtonsSource, /#4285F4/);
  assert.match(socialButtonsSource, /#34A853/);
  assert.match(settingsSource, /Privacy & data/);
  assert.match(deleteAccountSource, /styles.todayTitle}>Delete account</);
  assert.match(deleteAccountSource, /Manage subscription/);
  assert.match(remoteAuthSource, /ACCOUNT_DELETION_CONFIRMATION = "DELETE"/);
  assert.match(deleteAccountSource, /Type \{ACCOUNT_DELETION_CONFIRMATION\} to confirm/);
  assert.match(deleteAccountSource, /Current password/);
  assert.match(deleteAccountSource, /Delete account permanently/);
  assert.match(deleteAccountSource, /previous deletion response was interrupted/);
  assert.match(deletionRuntimeSource, /if \(existing\) return existing\.requestId/);
  assert.match(deletionRuntimeSource, /getRemoteAccountDeletionStatus/);
  assert.match(deletionRuntimeSource, /STATUS_RETRY_DELAYS_MS = \[0, 1_000, 3_000\]/);
  assert.match(deleteAccountSource, /deletionSubmissionStarted\.current/);
});

test("remote auth validates account creation verification and login fields", () => {
  const remoteAuthSource = readFileSync(
    path.join(__dirname, "..", "src", "auth", "remoteAuth.ts"),
    "utf8",
  );

  assert.match(remoteAuthSource, /registerRemoteAccount/);
  assert.match(remoteAuthSource, /requestRemoteEmailVerification/);
  assert.match(remoteAuthSource, /resendRemoteVerificationCode/);
  assert.match(remoteAuthSource, /verifyRemoteEmail/);
  assert.match(remoteAuthSource, /loginRemoteAccount/);
  assert.match(remoteAuthSource, /loginWithSocialIdentity/);
  assert.match(remoteAuthSource, /startAppleAuthRelay/);
  assert.match(remoteAuthSource, /Passwords do not match/);
  assert.match(remoteAuthSource, /6-digit verification code/);
});
