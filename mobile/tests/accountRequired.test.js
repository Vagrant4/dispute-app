const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const src = (file) => readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

test("welcome screen requires Login or Create account", () => {
  const logo = src("src/screens/LogoScreen.tsx");
  assert.doesNotMatch(logo, /Start tracking|No account needed|onStartTracking/);
  assert.match(logo, /styles.actionButtonText}>Login<\/Text>/);
  assert.match(logo, /styles.actionButtonSecondaryText}>Create account<\/Text>/);
  assert.match(logo, /Create a free account to start your 30-day free trial\./);
});

test("app clears a legacy guest session and stays on welcome", () => {
  const app = src("App.tsx");
  assert.doesNotMatch(app, /onStartTracking/);
  assert.match(app, /isGuestSessionActive\(\)[\s\S]*active \? setGuestSessionActive\(false\)/);
  assert.doesNotMatch(app, /setGuestSessionActive\(true\)|name: "Guest"|setAccount\(\{[^}]*isGuest/);
});

test("trial starts only in the successful create-account path", () => {
  const create = src("src/screens/CreateAccountScreen.tsx");
  const success = create.slice(create.indexOf("if (result.ok)"));
  assert.match(success, /saveGuestTrial\(startGuestTrial\(Date\.now\(\)\)\)/);
  assert.ok(success.indexOf("saveGuestTrial") < success.indexOf("onVerificationRequired"));
  assert.doesNotMatch(create.slice(create.indexOf("export function"), create.indexOf("if (result.ok)")), /startGuestTrial|saveGuestTrial/);
});
