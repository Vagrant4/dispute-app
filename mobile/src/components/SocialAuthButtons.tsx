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
        <View style={styles.socialAuthButtonContent}>
          <GoogleMark />
          <Text style={[styles.socialAuthButtonText, isSubmitting && styles.disabledButtonText]}>Continue with Google</Text>
        </View>
      </Pressable>
      <Pressable accessibilityLabel="Continue with Apple" accessibilityRole="button" disabled={isSubmitting} onPress={() => void continueWith("apple")} style={[styles.socialAuthButton, isSubmitting && styles.disabledButton]}>
        <View style={styles.socialAuthButtonContent}>
          <FontAwesome color="#FFFFFF" name="apple" size={22} />
          <Text style={[styles.socialAuthButtonText, isSubmitting && styles.disabledButtonText]}>Continue with Apple</Text>
        </View>
      </Pressable>
      {status ? <Text accessibilityLiveRegion="polite" style={styles.socialAuthStatus}>{status}</Text> : null}
    </View>
  );
}

function GoogleMark() {
  // FontAwesome supplies the Google "G" outline on iOS, Android, and web.
  // Clipping four copies gives it the official Google colour treatment without
  // adding a native SVG dependency solely for this small brand mark.
  return <View accessibilityLabel="Google logo" style={styles.googleMark}>
    <View style={[styles.googleMarkClip, styles.googleMarkTopLeft]}><FontAwesome color="#EA4335" name="google" size={22} style={styles.googleMarkGlyph} /></View>
    <View style={[styles.googleMarkClip, styles.googleMarkTopRight]}><FontAwesome color="#4285F4" name="google" size={22} style={[styles.googleMarkGlyph, styles.googleMarkGlyphRight]} /></View>
    <View style={[styles.googleMarkClip, styles.googleMarkBottomLeft]}><FontAwesome color="#FBBC05" name="google" size={22} style={[styles.googleMarkGlyph, styles.googleMarkGlyphBottom]} /></View>
    <View style={[styles.googleMarkClip, styles.googleMarkBottomRight]}><FontAwesome color="#34A853" name="google" size={22} style={[styles.googleMarkGlyph, styles.googleMarkGlyphRight, styles.googleMarkGlyphBottom]} /></View>
  </View>;
}
