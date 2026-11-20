import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";

import {
  registerRemoteAccount,
  normalizeEmailAddress,
  type PendingEmailVerification,
} from "../auth/remoteAuth";
import { styles, theme } from "../styles";
import { saveGuestTrial, startGuestTrial } from "../subscription/guestTrial";
import { type LocalAccount } from "../auth/localAuth";
import { SocialAuthButtons } from "../components/SocialAuthButtons";

type CreateAccountScreenProps = {
  onVerificationRequired: (pending: PendingEmailVerification) => void;
  onShowLogin: () => void;
  onLogin: (account: LocalAccount) => void;
};

export function CreateAccountScreen({
  onVerificationRequired,
  onShowLogin,
  onLogin,
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
        email: normalizeEmailAddress(email),
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
    <ModernCreateAccountScreen
      onLogin={onLogin}
      onShowLogin={onShowLogin}
      onVerificationRequired={onVerificationRequired}
    />
  );

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
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="name@example.com"
          placeholderTextColor={theme.colors.placeholder}
          spellCheck={false}
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

function ModernCreateAccountScreen({
  onVerificationRequired,
  onShowLogin,
  onLogin,
}: CreateAccountScreenProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  async function submit() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const result = await registerRemoteAccount({ name, email: normalizeEmailAddress(email), password });
    setIsSubmitting(false);
    if (!result.ok) return setStatus(result.message);
    await saveGuestTrial(startGuestTrial(Date.now())).catch(() => undefined);
    onVerificationRequired(result.pending);
  }

  return <View style={styles.authPage}>
    <View style={styles.heroPanel}>
      <Image accessibilityIgnoresInvertColors accessibilityLabel="DISPUTE app logo" resizeMode="contain" source={require("../../assets/logo-mark.png")} style={styles.authLogoImage} />
      <Text style={styles.heroTitle}>Create your account</Text>
    </View>
    <SocialAuthButtons onAuthenticated={onLogin} />
    <View style={styles.authDivider} accessibilityLabel="Or continue with email"><View style={styles.authDividerLine} /><Text style={styles.authDividerText}>OR</Text><View style={styles.authDividerLine} /></View>
    <View style={styles.authFormCard}>
      <Text style={styles.authInputLabel}>Full name</Text>
      <TextInput accessibilityLabel="Create account name" autoCapitalize="words" onChangeText={setName} placeholder="Your name" placeholderTextColor={theme.colors.placeholder} style={styles.textInput} value={name} />
      <Text style={styles.authInputLabel}>Email</Text>
      <TextInput accessibilityLabel="Create account email" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor={theme.colors.placeholder} spellCheck={false} style={styles.textInput} value={email} />
      <Text style={styles.authInputLabel}>Password</Text>
      <View style={styles.passwordInputRow}>
        <TextInput accessibilityLabel="Create account password" onChangeText={setPassword} placeholder="Minimum 8 characters" placeholderTextColor={theme.colors.placeholder} secureTextEntry={!showPassword} style={[styles.textInput, styles.passwordTextInput]} value={password} />
        <Pressable accessibilityLabel={showPassword ? "Hide password" : "Show password"} accessibilityRole="button" onPress={() => setShowPassword((current) => !current)} style={styles.passwordToggleButton}>
          <Ionicons color={theme.colors.textMuted} name={showPassword ? "eye-off-outline" : "eye-outline"} size={23} />
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void submit()} style={[styles.actionButton, styles.authActionButton, isSubmitting && styles.disabledButton]}><Text style={[styles.actionButtonText, styles.authActionButtonText, isSubmitting && styles.disabledButtonText]}>{isSubmitting ? "Creating..." : "Create account"}</Text></Pressable>
      {status ? <Text style={styles.muted}>{status}</Text> : null}
    </View>
    <View style={styles.authFooterRow}><Text style={styles.authFooterText}>Already have an account? </Text><Pressable accessibilityRole="button" onPress={onShowLogin}><Text style={styles.authFooterLink}>Login</Text></Pressable></View>
  </View>;
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
