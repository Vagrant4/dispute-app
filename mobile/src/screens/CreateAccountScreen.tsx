import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import {
  registerRemoteAccount,
  type PendingEmailVerification,
} from "../auth/remoteAuth";
import { styles, theme } from "../styles";
import { saveGuestTrial, startGuestTrial } from "../subscription/guestTrial";

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
  const [countryCode, setCountryCode] = useState("+65");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        phone: formatPhoneNumber(countryCode, phone),
        password,
      });
      if (result.ok) {
        await saveGuestTrial(startGuestTrial(Date.now())).catch(() => undefined);
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
        <Text style={styles.heroTitle}>Create your account</Text>
        <Text style={styles.heroBody}>
          We'll email you a 6-digit code. Your 30-day free trial starts when you're in.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.inputLabel}>Full name</Text>
        <TextInput
          accessibilityLabel="Create account name"
          autoCapitalize="words"
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={theme.colors.placeholder}
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
          placeholderTextColor={theme.colors.placeholder}
          style={styles.textInput}
          value={email}
        />

        <Text style={styles.inputLabel}>Mobile number</Text>
        <View style={styles.dropdownContainer}>
          <Pressable
            accessibilityLabel="Country code dropdown"
            accessibilityRole="button"
            accessibilityState={{ expanded: countryDropdownOpen }}
            onPress={() => setCountryDropdownOpen((current) => !current)}
            style={styles.dropdownBox}
          >
            <Text style={styles.dropdownValue}>
              {getCountryCodeLabel(countryCode)}
            </Text>
            <Text style={styles.dropdownChevron}>
              {countryDropdownOpen ? "▲" : "▼"}
            </Text>
          </Pressable>
          {countryDropdownOpen ? (
            <View style={styles.dropdownMenu}>
              {COUNTRY_CODE_OPTIONS.map((option) => {
                const selected = option.code === countryCode;
                return (
                  <Pressable
                    accessibilityLabel={`Country code ${option.country} ${option.code}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.code}
                    onPress={() => {
                      setCountryCode(option.code);
                      setCountryDropdownOpen(false);
                    }}
                    style={
                      selected ? styles.dropdownOptionActive : styles.dropdownOption
                    }
                  >
                    <Text
                      style={
                        selected
                          ? styles.dropdownOptionActiveText
                          : styles.dropdownOptionText
                      }
                    >
                      {option.country} ({option.code})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
        <TextInput
          accessibilityLabel="Create account mobile number"
          keyboardType="phone-pad"
          onChangeText={setPhone}
          placeholder="9000 0000"
          placeholderTextColor={theme.colors.placeholder}
          style={styles.textInput}
          value={phone}
        />

        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.passwordInputRow}>
          <TextInput
            accessibilityLabel="Create account password"
            onChangeText={setPassword}
            placeholder="Minimum 8 characters"
            placeholderTextColor={theme.colors.placeholder}
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
              {showPassword ? "Hide" : "Show"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleCreateAccount}
          style={[styles.actionButton, isSubmitting && styles.disabledButton]}
        >
          <Text style={[styles.actionButtonText, (isSubmitting) && styles.disabledButtonText]}>
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

const COUNTRY_CODE_OPTIONS = [
  { code: "+65", country: "Singapore" },
  { code: "+63", country: "Philippines" },
  { code: "+60", country: "Malaysia" },
  { code: "+62", country: "Indonesia" },
  { code: "+91", country: "India" },
  { code: "+880", country: "Bangladesh" },
  { code: "+95", country: "Myanmar" },
] as const;

function getCountryCodeLabel(countryCode: string): string {
  const option = COUNTRY_CODE_OPTIONS.find((item) => item.code === countryCode);
  return option ? `${option.country} (${option.code})` : countryCode;
}

function formatPhoneNumber(countryCode: string, phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("+")) {
    return trimmed;
  }
  return `${countryCode} ${trimmed}`;
}
