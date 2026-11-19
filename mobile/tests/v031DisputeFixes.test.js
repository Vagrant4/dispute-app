const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobile = path.resolve(__dirname, "..");
const read = (file) => readFileSync(path.join(mobile, file), "utf8");

test("camera capture checks device availability and keeps a gallery fallback reachable", () => {
  const photos = read("src/screens/PhotoEvidenceScreen.tsx");
  assert.match(photos, /imagePicker\.isAvailableAsync/);
  assert.match(photos, /Camera isn't available on this device\. Choose from gallery instead\./);
  assert.match(photos, /setCaptureSheetOpen\(true\)/);
  assert.match(photos, /action === "camera"[\s\S]*Import from gallery/);
  assert.match(photos, /result\.canceled \|\| !result\.assets\?\.length/);
});

test("clock-in explains a missing project before requesting more location and opens the project picker", () => {
  const home = read("src/screens/HomeScreen.tsx");
  const handler = home.slice(home.indexOf("async function handleClockIn"), home.indexOf("async function handleLocateMe"));
  assert.match(handler, /readiness\.missing === "project" \|\| readiness\.missing === "both"/);
  assert.match(handler, /Choose a project or add a new project before clocking in\./);
  assert.match(handler, /setProjectPickerOpen\(true\)/);
  assert.ok(handler.indexOf('readiness.missing === "project"') < handler.indexOf('readiness.missing === "location"'));
});

test("clock-in retains a known address and performs post-clock-in reverse geocoding", () => {
  const home = read("src/screens/HomeScreen.tsx");
  const repository = read("src/work/workRepository.ts");
  const webStore = read("src/work/webWorkStore.ts");
  assert.match(home, /clockIn\(\{ userId, projectId, clockInAt: nextClockIn, dayType, taskId: selectedTaskId, locationText: locationFix\?\.address/);
  assert.match(home, /getWorkLocationWithTimeout\(20_000, \{ geocode: true \}\)/);
  assert.match(repository, /clock_in_location_source = 'none' OR location_text IS NULL OR trim\(location_text\) = ''/);
  assert.match(webStore, /entry\.clockInLocationSource !== "none" && entry\.locationText/);
});

test("clock-out renders a concise persisted-work-duration confirmation", () => {
  const home = read("src/screens/HomeScreen.tsx");
  assert.match(home, /const \[clockOutSummary, setClockOutSummary\]/);
  assert.match(home, /setClockOutSummary\(\{ project: completedEntry\.projectName, clockInAt: new Date\(completedEntry\.startTime\), clockOutAt: new Date\(completedEntry\.endTime\), durationMinutes: completedEntry\.durationMinutes \}\)/);
  assert.match(home, /Clocked out/);
  assert.match(home, /formatDurationMinutes\(clockOutSummary\.durationMinutes\)/);
});

test("auth email fields disable spelling assistance and use one normalized submission value", () => {
  const login = read("src/screens/LoginScreen.tsx");
  const create = read("src/screens/CreateAccountScreen.tsx");
  const remoteAuth = read("src/auth/remoteAuth.ts");
  for (const source of [login, create]) {
    assert.match(source, /autoCapitalize="none"/);
    assert.match(source, /autoCorrect=\{false\}/);
    assert.match(source, /spellCheck=\{false\}/);
    assert.match(source, /normalizeEmailAddress\(email\)/);
  }
  assert.match(remoteAuth, /export function normalizeEmailAddress\(value: string\): string/);
});

test("auth pages use the keyboard-aware scroller and preserve taps while the keyboard is open", () => {
  const app = read("App.tsx");
  const keyboard = read("src/components/KeyboardAwareScroll.tsx");
  assert.match(app, /<KeyboardAwareScroll[\s\S]*keyboardShouldPersistTaps="handled"/);
  assert.match(keyboard, /keyboardShouldPersistTaps="handled"/);
  assert.match(keyboard, /KeyboardAvoidingView/);
});

test("the new-project picker footer is a direct full-size pressable action", () => {
  const home = read("src/screens/HomeScreen.tsx");
  assert.match(home, /footer=\{<Pressable[\s\S]*?style=\{\[styles\.actionButtonSecondary[\s\S]*?onPress=\{\(\) => \{ setProjectPickerOpen\(false\); setProjectSheetOpen\(true\); \}\}/);
});
