import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import {
  registerRemoteAccount,
  type PendingEmailVerification,
} from "../auth/remoteAuth";
import { styles } from "../styles";

type CreateAccountScreenProps = {
  onVerificationRequired: (pending: PendingEmailVerification) => void;
  onShowLogin: () => void;
};

export function CreateAccountScreen({
  onVerificationRequired,
  onShowLogin,
}: CreateAccountScreenProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  async function handleCreateAccount() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerRemoteAccount({
        name,
        email,
        phone,
        password,
        confirmPassword,
      });
      if (result.ok) {
        setStatus(result.pending.message);
        onVerificationRequired(result.pending);
      } else {
        setStatus(result.message);
      }
    } catch {
      setStatus("Unable to create the account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.authPage}>
      <View style={styles.heroPanel}>
        <Text style={styles.eyebrow}>Create account</Text>
        <Text style={styles.heroTitle}>Register and verify email.</Text>
        <Text style={styles.heroBody}>
          We send a 6-digit code to your email before you enter Dispute.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.inputLabel}>Full name</Text>
        <TextInput
          accessibilityLabel="Create account name"
          autoCapitalize="words"
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor="#677064"
          style={styles.textInput}
          value={name}
        />

        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          accessibilityLabel="Create account email"
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="name@example.com"
          placeholderTextColor="#677064"
          style={styles.textInput}
          value={email}
        />

        <Text style={styles.inputLabel}>Mobile number</Text>
        <TextInput
          accessibilityLabel="Create account mobile number"
          keyboardType="phone-pad"
          onChangeText={setPhone}
          placeholder="+65 9000 0000"
          placeholderTextColor="#677064"
          style={styles.textInput}
          value={phone}
        />

        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.passwordInputRow}>
          <TextInput
            accessibilityLabel="Create account password"
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

        <Text style={styles.inputLabel}>Confirm password</Text>
        <View style={styles.passwordInputRow}>
          <TextInput
            accessibilityLabel="Confirm account password"
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

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleCreateAccount}
          style={[styles.actionButton, isSubmitting && styles.disabledButton]}
        >
          <Text style={styles.actionButtonText}>
            {isSubmitting ? "Creating..." : "Create account"}
          </Text>
        </Pressable>

        {status ? <Text style={styles.muted}>{status}</Text> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onShowLogin}
        style={styles.authLinkButton}
      >
        <Text style={styles.authLinkText}>Already have an account? Login</Text>
      </Pressable>
    </View>
  );
}
