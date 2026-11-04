const assert = require("node:assert/strict");
const { readdirSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createLoader, source } = require("./locationTestHelpers");

const { formatPhoneForDisplay, formatTrialDaysLeft, formatWeekRange } = createLoader()("src/uiReviewFormatters.ts");
const { formatReferralCodeForDisplay } = createLoader()("src/referrals/formatReferralCodeForDisplay.ts");

test("UI review display helpers format referral, trial, week and Singapore phone values", () => {
  assert.equal(formatReferralCodeForDisplay("DSP-7Q2K9XW4MZ8P"), "DSP 7Q2K 9XW4 MZ8P");
  assert.equal(formatTrialDaysLeft("2026-12-06T00:00:00Z", Date.parse("2026-11-05T00:00:00Z")), 30);
  assert.equal(formatWeekRange("2026-11-02"), "Week of 2 – 8 Nov 2026");
  assert.equal(formatWeekRange("2026-11-30"), "Week of 30 Nov – 6 Dec 2026");
  assert.equal(formatPhoneForDisplay("+6590000000"), "+65 9000 0000");
  assert.equal(formatPhoneForDisplay("+60123456789"), "+60123456789");
});

test("reviewed screens contain the revised copy", () => {
  const screensDir = path.join(__dirname, "..", "src", "screens");
  const screens = readdirSync(screensDir).filter((name) => /\.tsx?$/.test(name)).map((name) => source(`src/screens/${name}`)).join("\n");
  assert.doesNotMatch(screens, /\bEYE\b/);
  assert.doesNotMatch(screens, /Your proof starts here/);
  assert.doesNotMatch(screens, /Something went wrong/);
  const home = source("src/screens/HomeScreen.tsx");
  assert.match(home, /Trial ended/);
  assert.match(home, /Subscribe in Settings › Plan to keep clocking in\. Your records stay viewable\./);
  const settings = source("src/screens/SettingsScreen.tsx");
  for (const label of ["Start time", "End time", "Overtime ×", "Off day ×", "Public holiday ×", "Paid by"]) assert.match(settings, new RegExp(`>${label.replace("×", "×")}<`));
});
