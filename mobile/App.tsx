import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import { EvidenceLockScreen } from "./src/screens/EvidenceLockScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PrivacyScreen } from "./src/screens/PrivacyScreen";
import { SettingsBackupScreen } from "./src/screens/SettingsBackupScreen";
import { StorageDiagnosticsScreen } from "./src/screens/StorageDiagnosticsScreen";
import { SubscriptionScreen } from "./src/screens/SubscriptionScreen";
import { styles } from "./src/styles";

type TabId =
  | "home"
  | "backup"
  | "privacy"
  | "storage"
  | "subscription"
  | "lock";

type Tab = {
  id: TabId;
  label: string;
  title: string;
};

const tabs: Tab[] = [
  { id: "home", label: "Home", title: "ClaimProof SG" },
  { id: "backup", label: "Backup", title: "Settings / Backup" },
  { id: "privacy", label: "Privacy", title: "Privacy Notice" },
  { id: "storage", label: "Storage", title: "Storage Diagnostics" },
  { id: "subscription", label: "Plan", title: "Subscription Status" },
  { id: "lock", label: "Lock", title: "Evidence Lock" },
];

function renderScreen(activeTab: TabId) {
  switch (activeTab) {
    case "backup":
      return <SettingsBackupScreen />;
    case "privacy":
      return <PrivacyScreen />;
    case "storage":
      return <StorageDiagnosticsScreen />;
    case "subscription":
      return <SubscriptionScreen />;
    case "lock":
      return <EvidenceLockScreen />;
    case "home":
    default:
      return <HomeScreen />;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const activeTitle = useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.title ?? "ClaimProof SG",
    [activeTab],
  );

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.appName}>ClaimProof SG</Text>
        <Text style={styles.screenTitle}>{activeTitle}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroller}
        contentContainerStyle={styles.tabRow}
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabButton, selected && styles.tabButtonActive]}
            >
              <Text
                style={[styles.tabButtonText, selected && styles.tabButtonTextActive]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {renderScreen(activeTab)}
      </ScrollView>
    </SafeAreaView>
  );
}
