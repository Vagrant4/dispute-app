import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Image, type ImageSourcePropType, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { type LocalAccount } from "./src/auth/localAuth";
import { reconcilePendingAccountDeletion } from "./src/account/accountDeletionExpo";
import { type PendingEmailVerification } from "./src/auth/remoteAuth";
import { tabs, type TabId } from "./src/screenContent";
import { CreateAccountScreen } from "./src/screens/CreateAccountScreen";
import { ForgotPasswordScreen } from "./src/screens/ForgotPasswordScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { LogoScreen } from "./src/screens/LogoScreen";
import { PhotoEvidenceScreen } from "./src/screens/PhotoEvidenceScreen";
import { ProjectsScreen } from "./src/screens/ProjectsScreen";
import { SettingsScreen, type SettingPanel } from "./src/screens/SettingsScreen";
import { VerifyEmailScreen } from "./src/screens/VerifyEmailScreen";
import { styles } from "./src/styles";
import { clearCachedSubscriptionEntitlement } from "./src/subscription/subscriptionClient";
import { isGuestSessionActive, setGuestSessionActive } from "./src/auth/guestSession";
import {
  clearActiveSession,
  loadActiveSession,
  saveActiveSession,
} from "./src/auth/localAuthStorageExpo";
import { claimLegacyLocalRepositoriesForUser } from "./src/db/repositories";

const tabIcons: Record<TabId, ImageSourcePropType> = {
  home: require("./assets/icons/tab-today.png"),
  evidence: require("./assets/icons/tab-photos.png"),
  reports: require("./assets/icons/tab-projects.png"),
  settings: require("./assets/icons/tab-settings.png"),
};

function renderScreen(
  activeTab: TabId,
  onNavigate: (tab: TabId, settingsPanel?: SettingPanel) => void,
  account: LocalAccount,
  onLogout: () => void,
  onAccountDeleted: (message: string) => void,
  onCreateAccount: () => void,
  settingsInitialPanel?: SettingPanel,
  photoProjectId?: string,
  onSeePhotos?: (projectId: string) => void,
) {
  switch (activeTab) {
    case "evidence":
      return <PhotoEvidenceScreen account={account} initialProjectId={photoProjectId} />;
    case "reports":
      return (
        <ProjectsScreen
          onSeePhotos={onSeePhotos ?? (() => onNavigate("evidence"))}
          account={account}
          onCreateAccount={onCreateAccount}
          onOpenPlanBilling={() => onNavigate("settings", "subscription")}
        />
      );
    case "settings":
      return (
        <SettingsScreen
          account={account}
          onAccountDeleted={onAccountDeleted}
          onLogout={onLogout}
          initialPanel={settingsInitialPanel}
        />
      );
    case "home":
    default:
      return <HomeScreen account={account} />;
  }
}

export default function App() {
  const [photoProjectId, setPhotoProjectId] = useState<string | undefined>();
  const [authMode, setAuthMode] = useState<"logo" | "create" | "verify" | "login" | "forgot">("logo");
  const [account, setAccount] = useState<LocalAccount | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [pendingVerification, setPendingVerification] =
    useState<PendingEmailVerification | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [settingsInitialPanel, setSettingsInitialPanel] = useState<SettingPanel | undefined>(undefined);
  const [authNotice, setAuthNotice] = useState("");
  const activeTitle = useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.title ?? "dispute",
    [activeTab],
  );
  const photosVisible = !!account && activeTab === "evidence";
  const ScreenContainer = photosVisible ? View : ScrollView;
  const showHeader = account ? activeTab !== "home" && activeTab !== "settings" : authMode !== "logo";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await isGuestSessionActive()
          .then((active) => (active ? setGuestSessionActive(false) : undefined))
          .catch(() => undefined);
        const cleaned = await reconcilePendingAccountDeletion();
        if (cancelled) return;
        if (cleaned) {
          await clearActiveSession();
          setAuthNotice("Your account was deleted and this phone was cleared.");
          setAuthMode("login");
          return;
        }
        const session = await loadActiveSession();
        if (cancelled) return;
        if (session) {
          setAccount(session);
          setActiveTab("home");
        }
      } catch {
        // Session restore is best-effort; fall through to the welcome screen.
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function establishAccount(next: LocalAccount) {
    await saveActiveSession(next);
    setAccount(next);
  }

  async function endAccountSession() {
    await clearActiveSession();
    await setGuestSessionActive(false);
    setAccount(null);
  }

  if (!authReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.app} edges={["top", "left", "right", "bottom"]} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.app} edges={account ? ["top", "left", "right"] : ["top", "left", "right", "bottom"]}>
        <StatusBar style="light" />
        {showHeader ? (
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View>
                <Text style={styles.appName}>Dispute</Text>
              </View>
            </View>
            {!account || (activeTab !== "settings" && activeTab !== "reports") ? <Text numberOfLines={1} style={styles.screenTitle}>
              {account
                ? activeTitle
                : authMode === "create"
                  ? "Create account"
                  : authMode === "verify"
                    ? "Verify code"
                    : authMode === "forgot"
                      ? "Reset password"
                    : "Login"}
            </Text> : null}
          </View>
        ) : null}

        <ScreenContainer
          style={photosVisible ? [styles.content, styles.photoScreenContainer] : styles.content}
          {...(photosVisible ? {} : { contentContainerStyle: styles.contentInner, showsVerticalScrollIndicator: false })}
        >
          {account ? (
            renderScreen(
              activeTab,
              (tab, settingsPanel) => {
                setSettingsInitialPanel(settingsPanel);
                setActiveTab(tab);
              },
              account,
              () => {
                void clearCachedSubscriptionEntitlement(account.id);
                void endAccountSession().then(() => {
                  setActiveTab("home");
                  setAuthMode("logo");
                });
              },
              (message) => {
                void clearCachedSubscriptionEntitlement(account.id);
                void endAccountSession().then(() => {
                  setActiveTab("home");
                  setAuthNotice(message);
                  setAuthMode("login");
                });
              },
              () => { void endAccountSession().then(() => setAuthMode("create")); },
              settingsInitialPanel,
              photoProjectId,
              (projectId) => { setPhotoProjectId(projectId); setActiveTab("evidence"); },
            )
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
                void (async () => {
                  const moved = await claimLegacyLocalRepositoriesForUser(verifiedAccount.id ?? verifiedAccount.email);
                  await setGuestSessionActive(false);
                  setAuthNotice(moved ? "Moved your records to your account" : "");
                  await establishAccount(verifiedAccount);
                })();
                setPendingVerification(null);
                setActiveTab("home");
              }}
            />
          ) : authMode === "forgot" ? (
            <ForgotPasswordScreen onBackToLogin={() => setAuthMode("login")} />
          ) : (
            <>
              {authNotice ? (
                <View style={styles.statusCard}>
                  <Text style={styles.statusTitle}>Account update</Text>
                  <Text style={styles.statusMessage}>{authNotice}</Text>
                </View>
              ) : null}
              <LoginScreen
                onLogin={(loggedInAccount) => {
                  void (async () => {
                    const moved = await claimLegacyLocalRepositoriesForUser(loggedInAccount.id ?? loggedInAccount.email);
                    await setGuestSessionActive(false);
                    setAuthNotice(moved ? "Moved your records to your account" : "");
                    await establishAccount(loggedInAccount);
                    setActiveTab("home");
                  })();
                }}
                onVerificationRequired={(pending) => {
                  setPendingVerification(pending);
                  setAuthMode("verify");
                }}
                onForgotPassword={() => setAuthMode("forgot")}
                onShowCreateAccount={() => setAuthMode("create")}
              />
            </>
          )}
        </ScreenContainer>
        {account ? (
          <SafeAreaView style={styles.bottomTabBar} edges={["bottom"]}>
            {tabs.map((tab) => {
              const selected = tab.id === activeTab;
              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  key={tab.id}
                  onPress={() => {
                    setSettingsInitialPanel(undefined);
                    setActiveTab(tab.id);
                  }}
                  accessibilityLabel={tab.label}
                  style={styles.bottomTabItem}
                >
                  <Image accessible={false} source={tabIcons[tab.id]} style={[styles.bottomTabIcon, selected && styles.bottomTabIconActive]} />
                  <Text
                    style={[
                      styles.bottomTabLabel,
                      selected && styles.bottomTabActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </SafeAreaView>
        ) : null}

      </SafeAreaView>
    </SafeAreaProvider>
  );
}
