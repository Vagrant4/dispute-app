const { withPodfile } = require("expo/config-plugins");

const LEGACY_GOOGLE_MAPS_POD =
  /^\s*pod 'react-native-google-maps', path: File\.dirname\(`node --print "require\.resolve\('react-native-maps\/package\.json'\)"`\)\s*$/m;
const MARKER = "# claimproof-google-maps-pod-fix";
const REACT_NATIVE_MAPS_PATH =
  "File.dirname(`node --print \"require.resolve('react-native-maps/package.json')\"`)";

module.exports = function withReactNativeMapsGoogleIos(config) {
  return withPodfile(config, (config) => {
    if (config.modResults.contents.includes(MARKER)) {
      return config;
    }

    config.modResults.contents = config.modResults.contents.replace(
      LEGACY_GOOGLE_MAPS_POD,
      `${MARKER}\n  rn_maps_path = ${REACT_NATIVE_MAPS_PATH}\n  pod 'react-native-maps/Google', :path => rn_maps_path`,
    );
    return config;
  });
};
