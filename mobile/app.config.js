const fs = require("node:fs");
const path = require("node:path");

const app = require("./app.json");
const envPath = path.join(__dirname, ".env.googlemaps");
const raw = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").trim() : "";
const googleMapsApiKey = (process.env.GOOGLE_MAPS_API_KEY || raw.replace(/^GOOGLE_MAPS_API_KEY=/, "")).trim();

module.exports = {
  ...app,
  expo: {
    ...app.expo,
    android: {
      ...app.expo.android,
      config: { googleMaps: { apiKey: googleMapsApiKey } },
    },
    extra: { ...app.expo.extra, googleMapsApiKey },
  },
};
