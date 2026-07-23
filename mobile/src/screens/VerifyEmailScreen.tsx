import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { type LocalAccount } from "../auth/localAuth";
import { phoneLocalAccountStorage } from "../auth/localAuthStorageExpo";
import {
  type PendingEmailVerification,
  resendRemoteVerificationCode,
  verifyRemoteEmail,
} from "../auth/remoteAuth";
import { styles } from "../styles";

type VerifyEmailScreenProps = {
  pending: PendingEmailVerification;
  onVerified: (account: LocalAccount) => void;
  onBackToCreate: () => void;
  onShowLogin: () => void;
};

export function VerifyEmailScreen({
  pending,
  onVerified,
  onBackToCreate,
  onShowLogin,
}: VerifyEmailScreenProps) {
  const [currentPending, setCurrentPending] = useState(pending);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [status, setStatus] = useState(
    `We sent a verification code to ${pending.email}.`,
  );

  async function handleVerify() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await verifyRemoteEmail(
        currentPending,
        code,
        phoneLocalAccountStorage,
      );
      setStatus(result.message);
      if (result.ok) {
        onVerified(result.account);
      }
    } catch {
      setStatus("Unable to verify email. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (isSubmitting || isResending) {
      return;
    }

    setIsResending(true);
    try {
      const result = await resendRemoteVerificationCode(currentPending);
      if (result.ok) {
        setCurrentPending(result.pending);
        setCode("");
        setStatus(result.pending.message);
      } else {
        setStatus(result.message);
      }
    } catch {
      setStatus("Unable to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <View style={styles.authPage}>
      <View style={styles.heroPanel}>
        <Text style={styles.eyebrow}>Verify code</Text>
        <Text style={styles.heroTitle}>Enter the email code.</Text>
        <Text style={styles.heroBody}>
          Check your email for the 6-digit Dispute verification code.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.inputLabel}>Verification code</Text>
        <TextInput
          accessibilityLabel="Email verification code"
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
          placeholder="123456"
          placeholderTextColor="#677064"
          style={[styles.textInput, styles.verificationCodeInput]}
          value={code}
        />

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleVerify}
          style={[styles.actionButton, isSubmitting && styles.disabledButton]}
        >
          <Text style={styles.actionButtonText}>
            {isSubmitting ? "Verifying..." : "Verify code"}
          </Text>
        </Pressable>

        <Text style={styles.muted}>{status}</Text>
        <Pressable
          accessibilityLabel="Resend verification code"
          accessibilityRole="button"
          disabled={isSubmitting || isResending}
          onPress={handleResendCode}
          style={styles.authLinkButton}
        >
          <Text style={styles.authLinkText}>
            {isResending ? "Sending new code..." : "Resend code"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          onPress={onBackToCreate}
          style={styles.authLinkButton}
        >
          <Text style={styles.authLinkText}>Edit registration details</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onShowLogin}
          style={styles.authLinkButton}
        >
          <Text style={styles.authLinkText}>Already verified? Login</Text>
        </Pressable>
      </View>
    </View>
  );
}
