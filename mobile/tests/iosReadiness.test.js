const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobile = path.resolve(__dirname, "..");
const read = (file) => readFileSync(path.join(mobile, file), "utf8");

test("iOS config declares the App ID, assets, and evidence permissions", () => {
  const app = JSON.parse(read("app.json")).expo;
  assert.equal(app.ios.bundleIdentifier, "sg.claimproof.mobile");
  assert.equal(app.ios.buildNumber, "33");
  assert.equal(app.ios.icon, "./assets/icon-ios.png");
  assert.equal(app.ios.infoPlist.CFBundleDisplayName, "DISPUTE Test 2");
  assert.equal(app.plugins[0], "./plugins/withDisputeTest2Android");
  assert.equal(app.plugins[1][1].image, "./assets/splash.png");
  assert.equal(app.ios.infoPlist.NSCameraUsageDescription, "DISPUTE uses the camera when you choose to capture photo evidence.");
  assert.equal(app.ios.infoPlist.NSPhotoLibraryUsageDescription, "DISPUTE lets you choose photo evidence from your library.");
  assert.equal(app.ios.infoPlist.NSLocationWhenInUseUsageDescription, "DISPUTE uses your location for clock-in GPS proof and can attach it to work records or photo evidence. The app still works if you decline.");
  assert.equal(app.ios.infoPlist.NSMicrophoneUsageDescription, "DISPUTE uses the microphone only when you choose voice search.");
  assert.equal(app.ios.infoPlist.NSSpeechRecognitionUsageDescription, "DISPUTE uses speech recognition only when you choose voice search.");
  assert.equal(app.ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription, undefined);
  assert.equal(app.ios.infoPlist.NSPhotoLibraryAddUsageDescription, undefined);
  assert.equal(app.ios.infoPlist.ITSAppUsesNonExemptEncryption, false);
  assert.ok(existsSync(path.join(mobile, "assets", "icon-ios.png")));
});

test("Maps keys accept named local values without placing keys in Expo extra", () => {
  const config = read("app.config.js");
  const example = read(".env.googlemaps.example");
  assert.match(config, /process\.env\.GOOGLE_MAPS_API_KEY/);
  assert.match(config, /process\.env\.GOOGLE_MAPS_IOS_API_KEY/);
  assert.match(config, /fileValues\.GOOGLE_MAPS_IOS_API_KEY/);
  assert.match(config, /ios:\s*\{[\s\S]*googleMapsApiKey:/);
  assert.match(example, /GOOGLE_MAPS_API_KEY=/);
  assert.match(example, /GOOGLE_MAPS_IOS_API_KEY=/);
  assert.doesNotMatch(config, /extra:\s*\{[^}]*googleMapsApiKey/s);
});

test("EAS separates simulator, internal-device, and TestFlight iOS profiles", () => {
  const eas = JSON.parse(read("eas.json"));
  const development = eas.build["development-simulator"];
  assert.equal(development.developmentClient, true);
  assert.equal(development.distribution, "internal");
  assert.equal(development.ios.simulator, true);
  assert.equal(eas.build.preview.distribution, "internal");
  assert.equal(eas.build.preview.ios.simulator, false);
  assert.equal(eas.build.testflight.distribution, "store");
  assert.equal(eas.build.testflight.autoIncrement, true);
  assert.equal(eas.build.testflight.ios.simulator, false);
  assert.equal(eas.build.production.distribution, "store");
  assert.equal(eas.build.production.ios.simulator, false);
});

test("Android-only native APIs are guarded before registration or use", () => {
  for (const file of ["App.tsx", "src/screens/HomeScreen.tsx", "src/screens/ProjectsScreen.tsx", "src/screens/SettingsScreen.tsx"]) {
    const source = read(file);
    assert.match(source, /Platform\.OS !== "android"\) return/);
    assert.match(source, /BackHandler\.addEventListener/);
  }
  const reportViewer = read("src/reports/reportViewingReactNative.ts");
  assert.match(reportViewer, /Platform\.OS === "android"/);
  assert.match(reportViewer, /getContentUriAsync/);
});
