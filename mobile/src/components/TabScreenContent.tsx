import type { ReactNode } from "react";
import { View } from "react-native";

import type { TabId } from "../screenContent";

export function TabScreenContent({ activeTab, children }: { activeTab: TabId; children: ReactNode }) {
  return <View key={activeTab} style={{ flex: 1 }}>{children}</View>;
}
