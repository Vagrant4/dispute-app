import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { Linking } from "react-native";

import type { ReportViewAdapter } from "./reportViewing";

export const reactNativeReportViewAdapter: ReportViewAdapter = {
  canOpenURL: Linking.canOpenURL,
  getViewableUri: async (filePath) => {
    if (Platform.OS === "android" && FileSystem.getContentUriAsync) {
      return FileSystem.getContentUriAsync(filePath);
    }
    return filePath;
  },
  openURL: Linking.openURL,
};
