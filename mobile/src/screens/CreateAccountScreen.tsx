import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";

import { type LocalAccount } from "../auth/localAuth";
import {
  normalizeEmailAddress,
  registerRemoteAccount,
  type PendingEmailVerification,
} from "../auth/remoteAuth";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { CountryCodePicker } from "../components/CountryCodePicker";
import { COUNTRY_CALLING_CODE_OPTIONS, formatPhoneWithCountry, getDefaultCountryCallingCode } from "../phone/countryPickerData";
import { styles, theme } from "../styles";
import { saveGuestTrial, startGuestTrial } from "../subscription/guestTrial";

type CreateAccountScreenProps = {
  onVerificationRequired: (pending: PendingEmailVerification) => void;
  onShowLogin: () => void;
  onLogin: (account: LocalAccount) => void;
};

const COUNTRY_CODE_OPTIONS = COUNTRY_CALLING_CODE_OPTIONS.map((option) => ({ code: option.dialCode, country: option.name }));

export function CreateAccountScreen({
  onVerificationRequired,
  onShowLogin,
  onLogin,
}: CreateAccountScreenProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+65");
  const [countryOption, setCountryOption] = useState(getDefaultCountryCallingCode);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  async function submit() {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await registerRemoteAccount({
        name,
        email: normalizeEmailAddress(email),
        phone: formatPhoneWithCountry(countryOption, phone),
        password,
      });
      if (!result.ok) {
        setStatus(result.message);
        return;
      }
      await saveGuestTrial(startGuestTrial(Date.now())).catch(() => undefined);
      onVerificationRequired(result.pending);
    } catch {
      setStatus("Unable to create the account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
      <Text style={styles.authInputLabel}>Mobile number</Text>
      {false ? <View style={styles.dropdownContainer}>
        <Pressable accessibilityLabel="Country code dropdown" accessibilityRole="button" accessibilityState={{ expanded: countryDropdownOpen }} onPress={() => setCountryDropdownOpen((current) => !current)} style={styles.dropdownBox}>
          <Text style={styles.dropdownValue}>{getCountryCodeLabel(countryCode)}</Text>
          <Text style={styles.dropdownChevron}>{countryDropdownOpen ? "▲" : "▼"}</Text>
        </Pressable>
        {countryDropdownOpen ? <View style={styles.dropdownMenu}>
          {COUNTRY_CODE_OPTIONS.map((option) => {
            const selected = option.code === countryCode;
            return <Pressable accessibilityLabel={`Country code ${option.country} ${option.code}`} accessibilityRole="button" accessibilityState={{ selected }} key={option.code} onPress={() => { setCountryCode(option.code); setCountryDropdownOpen(false); }} style={selected ? styles.dropdownOptionActive : styles.dropdownOption}>
              <Text style={selected ? styles.dropdownOptionActiveText : styles.dropdownOptionText}>{option.country} ({option.code})</Text>
            </Pressable>;
          })}
        </View> : null}
      </View> : null}
      <View style={styles.dropdownContainer}><CountryCodePicker onChange={setCountryOption} value={countryOption} /></View>
      <TextInput accessibilityLabel="Create account mobile number" keyboardType="phone-pad" onChangeText={setPhone} placeholder="9000 0000" placeholderTextColor={theme.colors.placeholder} style={styles.textInput} value={phone} />
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

function getCountryCodeLabel(countryCode: string): string {
  const option = COUNTRY_CODE_OPTIONS.find((item) => item.code === countryCode);
  return option ? `${option.country} (${option.code})` : countryCode;
}

function formatPhoneNumber(countryCode: string, phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed || !COUNTRY_CODE_OPTIONS.some((option) => option.code === countryCode)) return "";
  return trimmed.startsWith("+") ? trimmed : `${countryCode} ${trimmed}`;
}
