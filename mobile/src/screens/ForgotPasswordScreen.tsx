import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import {
  requestRemotePasswordReset,
  resetRemotePassword,
} from "../auth/remoteAuth";
import { styles } from "../styles";

type ForgotPasswordScreenProps = {
  onBackToLogin: () => void;
};

export function ForgotPasswordScreen({ onBackToLogin }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  async function handleSendCode() {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await requestRemotePasswordReset({ email });
      setStatus(result.message);
      if (result.ok) {
        setEmail(result.email);
        setResetEmailSent(true);
        setCode(result.devResetCode ?? "");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await resetRemotePassword({
        email,
        code,
        password,
        confirmPassword,
      });
      setStatus(result.message);
      if (result.ok) {
        setPassword("");
        setConfirmPassword("");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.authPage}>
      <View style={styles.heroPanel}>
        <Text style={styles.eyebrow}>Reset password</Text>
        <Text style={styles.heroTitle}>
          {resetEmailSent ? "Enter reset code." : "Forgot password?"}
        </Text>
        <Text style={styles.heroBody}>
          {resetEmailSent
            ? "Check your email for the 6-digit Dispute password reset code."
            : "Enter your registered email. We will send a 6-digit reset code."}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          accessibilityLabel="Password reset email"
          autoCapitalize="none"
          editable={!resetEmailSent}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="name@example.com"
          placeholderTextColor="#677064"
          style={styles.textInput}
          value={email}
        />

        {resetEmailSent ? (
          <>
            <Text style={styles.inputLabel}>Reset code</Text>
            <TextInput
              accessibilityLabel="Password reset code"
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
              placeholder="123456"
              placeholderTextColor="#677064"
              style={[styles.textInput, styles.verificationCodeInput]}
              value={code}
            />

            <Text style={styles.inputLabel}>New password</Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                accessibilityLabel="New password"
                onChangeText={setPassword}
                placeholder="Minimum 8 characters"
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

            <Text style={styles.inputLabel}>Confirm new password</Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                accessibilityLabel="Confirm new password"
                onChangeText={setConfirmPassword}
                placeholder="Re-type password"
                placeholderTextColor="#677064"
                secureTextEntry={!showConfirmPassword}
                style={[styles.textInput, styles.passwordTextInput]}
                value={confirmPassword}
              />
              <Pressable
                accessibilityLabel={
                  showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                }
                accessibilityRole="button"
                onPress={() => setShowConfirmPassword((current) => !current)}
                style={styles.passwordToggleButton}
              >
                <Text style={styles.passwordToggleSymbol}>
                  {showConfirmPassword ? "HIDE" : "EYE"}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={resetEmailSent ? handleResetPassword : handleSendCode}
          style={[styles.actionButton, isSubmitting && styles.disabledButton]}
        >
          <Text style={styles.actionButtonText}>
            {isSubmitting
              ? resetEmailSent
                ? "Resetting..."
                : "Sending..."
              : resetEmailSent
                ? "Reset password"
                : "Send reset code"}
          </Text>
        </Pressable>

        {status ? <Text style={styles.muted}>{status}</Text> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onBackToLogin}
        style={styles.authLinkButton}
      >
        <Text style={styles.authLinkText}>Back to login</Text>
      </Pressable>
    </View>
  );
}
