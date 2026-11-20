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
const googleIosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "").trim();
const googleIosUrlScheme = googleIosClientId
  ? `com.googleusercontent.apps.${googleIosClientId.replace(/\.apps\.googleusercontent\.com$/, "")}`
  : "";

module.exports = {
  ...app,
  expo: {
    ...app.expo,
    plugins: [
      ...app.expo.plugins,
      "./plugins/withReactNativeMapsGoogleIos",
      "expo-web-browser",
      "expo-apple-authentication",
      ...(googleIosUrlScheme
        ? [["@react-native-google-signin/google-signin", { iosUrlScheme: googleIosUrlScheme }]]
        : []),
    ],
    android: {
      ...app.expo.android,
      config: { googleMaps: { apiKey: googleMapsApiKey } },
    },
    ios: {
      ...app.expo.ios,
      usesAppleSignIn: true,
      config: { googleMapsApiKey: googleMapsIosApiKey },
    },
  },
};
