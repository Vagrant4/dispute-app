module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/__tests__/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: ["node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|expo-modules-core|@expo(nent)?/.*|react-native-safe-area-context)/)"],
};
