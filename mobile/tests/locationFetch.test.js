const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadWorkLocation(location) {
  const { createLoader } = require("./locationTestHelpers");
  return createLoader({ "expo-location": location })("src/work/workLocation.ts");
}

const granted = { Accuracy: { High: "high" }, PermissionStatus: { GRANTED: "granted", UNDETERMINED: "undetermined" }, requestForegroundPermissionsAsync: async () => ({ status: "granted" }), hasServicesEnabledAsync: async () => true };
const position = { coords: { latitude: 1.3, longitude: 103.8, accuracy: 8 }, timestamp: 1000 };

async function withImmediateTimer(delayToRun, action) {
  const original = global.setTimeout;
  global.setTimeout = (callback, delay, ...args) => delay === delayToRun ? original(callback, 0, ...args) : original(callback, delay, ...args);
  try { return await action(); } finally { global.setTimeout = original; }
}

test("slow reverse geocoding keeps the GPS coordinates", async () => {
  const workLocation = loadWorkLocation({ ...granted, getCurrentPositionAsync: async () => position, getLastKnownPositionAsync: async () => null, reverseGeocodeAsync: async () => new Promise(() => {}) });
  const result = await withImmediateTimer(4000, () => workLocation.getOptionalWorkLocationAddress());
  assert.equal(result.latitude, 1.3);
  assert.equal(result.longitude, 103.8);
  assert.equal(result.address, null);
});

test("disabled Android location services return specific guidance", async () => {
  const workLocation = loadWorkLocation({ ...granted, hasServicesEnabledAsync: async () => false });
  const result = await workLocation.getOptionalWorkLocationAddress();
  assert.equal(result.message, "Location services are off. Turn on Location in Android settings.");
});

test("current position timeout falls back to a recent last-known fix", async () => {
  const lastKnown = { coords: { latitude: 1.31, longitude: 103.81, accuracy: 40 }, timestamp: 2000 };
  const workLocation = loadWorkLocation({ ...granted, getLastKnownPositionAsync: async () => lastKnown, getCurrentPositionAsync: async () => new Promise(() => {}) });
  const result = await withImmediateTimer(15000, () => workLocation.getOptionalWorkLocationAddress());
  assert.equal(result.latitude, lastKnown.coords.latitude);
  assert.equal(result.longitude, lastKnown.coords.longitude);
});

test("home map refresh works while running from the embedded locate control", () => {
  const home = readFileSync(path.join(__dirname, "..", "src", "screens", "HomeScreen.tsx"), "utf8");
  const handler = home.slice(home.indexOf("async function handleLocateMe"), home.indexOf("function useTestLocation"));
  assert.doesNotMatch(handler, /if \(isRunning \|\|/);
  assert.match(home, /accessibilityLabel="Show my location"/);
  assert.match(home, /onPress=\{handleLocatePress\}/);
  assert.match(home, /function handleLocatePress\(\)[\s\S]*handleLocateMe\(\)/);
  assert.match(home, /refreshWorkState\(\)[\s\S]*handleLocateMe\(false\)/);
});

test("sparse reverse geocode like 377 Singapore yields null address keeping coordinates", async () => {
  const workLocation = loadWorkLocation({
    ...granted,
    getCurrentPositionAsync: async () => position,
    getLastKnownPositionAsync: async () => null,
    reverseGeocodeAsync: async () => [{ name: "377", street: null, streetNumber: null, district: null, city: "Singapore", region: null, postalCode: null, country: "Singapore" }],
  });
  const result = await workLocation.getOptionalWorkLocationAddress();
  assert.equal(result.latitude, 1.3);
  assert.equal(result.longitude, 103.8);
  assert.equal(result.address, null);
  assert.equal(result.addressParts?.name, "377");
});
