import { useState } from "react";
import { ScrollView, View } from "react-native";

import { type LocalAccount } from "./src/auth/localAuth";
import { type PendingEmailVerification } from "./src/auth/remoteAuth";
import { CreateAccountScreen } from "./src/screens/CreateAccountScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { VerifyEmailScreen } from "./src/screens/VerifyEmailScreen";
import { styles } from "./src/styles";

// Web is a review surface for the mobile authentication flow. Native builds use App.tsx.
export default function WebAuthPreview() {
  const previewScreen = typeof window === "undefined" ? "login" : new URLSearchParams(window.location.search).get("screen");
  const initialScreen = previewScreen === "create" || previewScreen === "verify" ? previewScreen : "login";
  const [screen, setScreen] = useState<"login" | "create" | "verify">(initialScreen);
  const [pending, setPending] = useState<PendingEmailVerification | null>(
    initialScreen === "verify" ? { email: "name@example.com", name: "Dispute user", phone: "", message: "Verification email sent." } : null,
  );
  const finish = (_account: LocalAccount) => setScreen("login");
  const content = screen === "create"
    ? <CreateAccountScreen onLogin={finish} onShowLogin={() => setScreen("login")} onVerificationRequired={(next) => { setPending(next); setScreen("verify"); }} />
    : screen === "verify" && pending
      ? <VerifyEmailScreen pending={pending} onBackToCreate={() => setScreen("create")} onShowLogin={() => setScreen("login")} onVerified={finish} />
      : <LoginScreen onLogin={finish} onForgotPassword={() => undefined} onShowCreateAccount={() => setScreen("create")} onVerificationRequired={(next) => { setPending(next); setScreen("verify"); }} />;
  return <View style={styles.app}><ScrollView contentContainerStyle={styles.contentInner}>{content}</ScrollView></View>;
}
