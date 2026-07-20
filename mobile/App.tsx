import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { type LocalAccount } from "./src/auth/localAuth";
import { type PendingEmailVerification } from "./src/auth/remoteAuth";
import { tabs, type TabId } from "./src/screenContent";
import { CreateAccountScreen } from "./src/screens/CreateAccountScreen";
import { ForgotPasswordScreen } from "./src/screens/ForgotPasswordScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { LogoScreen } from "./src/screens/LogoScreen";
import { PhotoEvidenceScreen } from "./src/screens/PhotoEvidenceScreen";
import { ProgressClaimReportsScreen } from "./src/screens/ProgressClaimReportsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { VerifyEmailScreen } from "./src/screens/VerifyEmailScreen";
import { styles } from "./src/styles";

function renderScreen(
  activeTab: TabId,
  onNavigate: (tab: TabId) => void,
  account: LocalAccount,
  onLogout: () => void,
) {
  switch (activeTab) {
    case "evidence":
      return <PhotoEvidenceScreen />;
    case "reports":
      return <ProgressClaimReportsScreen />;
    case "settings":
      return <SettingsScreen account={account} onLogout={onLogout} />;
    case "home":
    default:
      return <HomeScreen />;
  }
}

export default function App() {
  const [authMode, setAuthMode] = useState<"logo" | "create" | "verify" | "login" | "forgot">("logo");
  const [account, setAccount] = useState<LocalAccount | null>(null);
  const [pendingVerification, setPendingVerification] =
    useState<PendingEmailVerification | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const activeTitle = useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.title ?? "dispute",
    [activeTab],
  );
  const showHeader = account || authMode !== "logo";

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.app} edges={["top", "left", "right"]}>
        <StatusBar style="light" />
        {showHeader ? (
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View>
                <Text style={styles.appName}>DISPUTE</Text>
                {account ? (
                  <Text style={styles.headerMeta}>Signed in as {account.name}</Text>
                ) : null}
              </View>
              {account?.emailVerified ? (
                <View style={styles.headerPill}>
                  <Text style={styles.headerPillText}>Email verified</Text>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.screenTitle}>
              {account
                ? activeTitle
                : authMode === "create"
                  ? "Create account"
                  : authMode === "verify"
                    ? "Verify code"
                    : authMode === "forgot"
                      ? "Reset password"
                    : "Login"}
            </Text>
          </View>
        ) : null}

        {account ? (
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
                    style={[
                      styles.tabButtonText,
                      selected && styles.tabButtonTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {account ? (
            renderScreen(activeTab, setActiveTab, account, () => {
              setAccount(null);
              setActiveTab("home");
              setAuthMode("logo");
            })
          ) : authMode === "logo" ? (
            <LogoScreen
              onShowCreateAccount={() => setAuthMode("create")}
              onShowLogin={() => setAuthMode("login")}
            />
          ) : authMode === "create" ? (
            <CreateAccountScreen
              onVerificationRequired={(pending) => {
                setPendingVerification(pending);
                setAuthMode("verify");
              }}
              onShowLogin={() => setAuthMode("login")}
            />
          ) : authMode === "verify" && pendingVerification ? (
            <VerifyEmailScreen
              pending={pendingVerification}
              onBackToCreate={() => setAuthMode("create")}
              onShowLogin={() => setAuthMode("login")}
              onVerified={(verifiedAccount) => {
                setAccount(verifiedAccount);
                setPendingVerification(null);
                setActiveTab("home");
              }}
            />
          ) : authMode === "forgot" ? (
            <ForgotPasswordScreen onBackToLogin={() => setAuthMode("login")} />
          ) : (
            <LoginScreen
              onLogin={setAccount}
              onForgotPassword={() => setAuthMode("forgot")}
              onShowCreateAccount={() => setAuthMode("create")}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
