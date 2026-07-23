import { useEffect, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";

import { type LocalAccount } from "../auth/localAuth";
import {
  clearSavedLoginDetails,
  loadSavedLoginDetails,
  saveSavedLoginDetails,
} from "../auth/localAuthStorageExpo";
import {
  loginRemoteAccount,
  type PendingEmailVerification,
  requestRemoteEmailVerification,
} from "../auth/remoteAuth";
import { styles } from "../styles";

type LoginScreenProps = {
  onLogin: (account: LocalAccount) => void;
  onVerificationRequired: (pending: PendingEmailVerification) => void;
  onShowCreateAccount: () => void;
  onForgotPassword: () => void;
};

export function LoginScreen({
  onLogin,
  onVerificationRequired,
  onShowCreateAccount,
  onForgotPassword,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberLoginDetails, setRememberLoginDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContinuingVerification, setIsContinuingVerification] = useState(false);
  const [canContinueVerification, setCanContinueVerification] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let isMounted = true;

    loadSavedLoginDetails()
      .then((savedDetails) => {
        if (!isMounted || !savedDetails) {
          return;
        }

        setEmail(savedDetails.email);
        setPassword(savedDetails.password);
        setRememberLoginDetails(true);
      })
      .catch(() => {
        // Saved login details are optional. If loading fails, keep the form empty.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function handleRememberToggle() {
    setRememberLoginDetails((current) => {
      const next = !current;
      if (!next) {
        void clearSavedLoginDetails();
      }
      return next;
    });
  }

  async function handleLogin() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await loginRemoteAccount({ email, password });
      setStatus(result.message);
      setCanContinueVerification(isEmailVerificationRequired(result.message));
      if (result.ok) {
        if (rememberLoginDetails) {
          await saveSavedLoginDetails({ email, password });
        } else {
          await clearSavedLoginDetails();
        }
        onLogin(result.account);
      }
    } catch {
      setStatus("Unable to login. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleContinueVerification() {
    if (isSubmitting || isContinuingVerification) {
      return;
    }

    setIsContinuingVerification(true);
    try {
      const result = await requestRemoteEmailVerification({ email });
      if (result.ok) {
        setStatus(result.pending.message);
        onVerificationRequired(result.pending);
      } else {
        setStatus(result.message);
      }
    } catch {
      setStatus("Unable to continue verification. Please try again.");
    } finally {
      setIsContinuingVerification(false);
    }
  }

  return (
    <View style={styles.authPage}>
      <View style={styles.heroPanel}>
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="DISPUTE app logo"
          resizeMode="contain"
          source={require("../../assets/logo-mark.png")}
          style={styles.authLogoImage}
        />
        <Text style={styles.heroTitle}>Welcome back.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          accessibilityLabel="Login email"
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="name@example.com"
          placeholderTextColor="#677064"
          style={styles.textInput}
          value={email}
        />

        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.passwordInputRow}>
          <TextInput
            accessibilityLabel="Login password"
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor="#677064"
            secureTextEntry={!showPassword}
            style={[styles.textInput, styles.passwordTextInput]}
            value={password}
          />
          <Pressable
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            accessibilityRole="button"
            onPress={() => setShowPassword((current) => !current)}
            style={styles.passwordToggleButton}
          >
            <Text style={styles.passwordToggleSymbol}>
              {showPassword ? "HIDE" : "EYE"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityLabel="Remember login details"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rememberLoginDetails }}
          onPress={handleRememberToggle}
          style={styles.checkboxRow}
        >
          <View
            style={[
              styles.checkboxBox,
              rememberLoginDetails && styles.checkboxBoxChecked,
            ]}
          >
            <Text style={styles.checkboxMark}>
              {rememberLoginDetails ? "✓" : ""}
            </Text>
          </View>
          <Text style={styles.checkboxLabel}>Remember login details</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleLogin}
          style={[styles.actionButton, isSubmitting && styles.disabledButton]}
        >
          <Text style={styles.actionButtonText}>
            {isSubmitting ? "Checking..." : "Login"}
          </Text>
        </Pressable>

        {status ? <Text style={styles.muted}>{status}</Text> : null}

        {canContinueVerification ? (
          <Pressable
            accessibilityLabel="Continue email verification"
            accessibilityRole="button"
            disabled={isSubmitting || isContinuingVerification}
            onPress={handleContinueVerification}
            style={styles.authLinkButton}
          >
            <Text style={styles.authLinkText}>
              {isContinuingVerification
                ? "Sending verification code..."
                : "Continue verification"}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={onForgotPassword}
          style={styles.authLinkButton}
        >
          <Text style={styles.authLinkText}>Forgot password?</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onShowCreateAccount}
        style={styles.authLinkButton}
      >
        <Text style={styles.authLinkText}>New user? Create account</Text>
      </Pressable>
    </View>
  );
}

function isEmailVerificationRequired(message: string): boolean {
  return /verify your email|email verification|before logging in/i.test(message);
}
