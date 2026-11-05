const assert = require("node:assert/strict");
const test = require("node:test");
const { createLoader } = require("./locationTestHelpers");

const { openDeviceMaps } = createLoader({
  "react-native": {
    Linking: {
      openURL: async () => {},
      canOpenURL: async () => false,
    },
    Platform: { OS: "android" },
  },
})("src/work/openDeviceMaps.ts");

test("openDeviceMaps prefers https maps and never throws when intents fail", async () => {
  const opened = [];
  const result = await openDeviceMaps(
    { latitude: 1.29, longitude: 103.85, label: "Site" },
    {
      platform: "android",
      canOpenURL: async (url) => url.startsWith("https://"),
      openURL: async (url) => {
        opened.push(url);
      },
    },
  );
  assert.equal(result.ok, true);
  assert.match(opened[0], /google\.com\/maps/);
});

test("openDeviceMaps returns an in-app error when every maps intent fails", async () => {
  const result = await openDeviceMaps(
    { latitude: 1.29, longitude: 103.85 },
    {
      platform: "android",
      canOpenURL: async () => true,
      openURL: async () => {
        throw new Error("no activity");
      },
    },
  );
  assert.equal(result.ok, false);
  assert.match(result.message, /Couldn't open a maps app/);
});
