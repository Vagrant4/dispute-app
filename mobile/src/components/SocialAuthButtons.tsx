import { FontAwesome } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { type LocalAccount } from "../auth/localAuth";
import { signInWithApple, signInWithGoogle } from "../auth/socialAuth";
import { styles } from "../styles";

type SocialAuthButtonsProps = {
  onAuthenticated: (account: LocalAccount) => void;
};

export function SocialAuthButtons({ onAuthenticated }: SocialAuthButtonsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  async function continueWith(provider: "google" | "apple") {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const result = provider === "google" ? await signInWithGoogle() : await signInWithApple();
    setIsSubmitting(false);
    setStatus(result.message);
    if (result.ok) onAuthenticated(result.account);
  }

  return (
    <View style={styles.socialAuthGroup}>
      <Pressable accessibilityLabel="Continue with Google" accessibilityRole="button" disabled={isSubmitting} onPress={() => void continueWith("google")} style={[styles.socialAuthButton, isSubmitting && styles.disabledButton]}>
        <FontAwesome color="#4285F4" name="google" size={25} />
        <Text style={[styles.socialAuthButtonText, isSubmitting && styles.disabledButtonText]}>Continue with Google</Text>
      </Pressable>
      <Pressable accessibilityLabel="Continue with Apple" accessibilityRole="button" disabled={isSubmitting} onPress={() => void continueWith("apple")} style={[styles.socialAuthButton, isSubmitting && styles.disabledButton]}>
        <FontAwesome color="#FFFFFF" name="apple" size={29} />
        <Text style={[styles.socialAuthButtonText, isSubmitting && styles.disabledButtonText]}>Continue with Apple</Text>
      </Pressable>
      {status ? <Text accessibilityLiveRegion="polite" style={styles.socialAuthStatus}>{status}</Text> : null}
    </View>
  );
}
