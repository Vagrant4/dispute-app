const fs = require("node:fs");
const path = require("node:path");

const app = require("./app.json");
const envPath = path.join(__dirname, ".env.googlemaps");
const raw = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const fileValues = Object.fromEntries(raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));
const bareAndroidKey = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line && !line.startsWith("#") && !line.includes("=")) ?? "";
const googleMapsApiKey = (process.env.GOOGLE_MAPS_API_KEY || fileValues.GOOGLE_MAPS_API_KEY || bareAndroidKey).trim();
const googleMapsIosApiKey = (process.env.GOOGLE_MAPS_IOS_API_KEY || fileValues.GOOGLE_MAPS_IOS_API_KEY || "").trim();

module.exports = {
  ...app,
  expo: {
    ...app.expo,
    android: {
      ...app.expo.android,
      config: { googleMaps: { apiKey: googleMapsApiKey } },
    },
    ios: {
      ...app.expo.ios,
      config: { googleMapsApiKey: googleMapsIosApiKey },
    },
  },
};
