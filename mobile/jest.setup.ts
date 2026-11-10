jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
  };
});

jest.mock("expo-font", () => ({ useFonts: () => [true, null] }));
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const MaterialIcons = ({ name, ...props }: { name: string }) => React.createElement(Text, props, name);
  MaterialIcons.font = {};
  return { MaterialIcons };
});

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MapView = React.forwardRef(({ children, ...props }: { children?: React.ReactNode }, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ animateCamera: jest.fn() }));
    return React.createElement(View, { ...props, testID: "google-map" }, children);
  });
  return {
    __esModule: true,
    default: MapView,
    Circle: View,
    Marker: View,
    PROVIDER_GOOGLE: "google",
  };
});
