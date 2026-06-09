import * as Sharing from "expo-sharing";

import type { SharingAdapter } from "./reportSharing";

export const expoSharingAdapter: SharingAdapter = {
  isAvailableAsync: Sharing.isAvailableAsync,
  shareAsync: Sharing.shareAsync,
};
