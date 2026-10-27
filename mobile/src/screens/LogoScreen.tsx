import { Image, Pressable, Text, View } from "react-native";

import { styles } from "../styles";

type LogoScreenProps = {
  onShowCreateAccount: () => void;
  onShowLogin: () => void;
  onStartTracking: () => void;
};

export function LogoScreen({
  onShowCreateAccount,
  onShowLogin,
  onStartTracking,
}: LogoScreenProps) {
  return (
    <View style={styles.logoPage}>
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel="DISPUTE app logo"
        resizeMode="contain"
        source={require("../../assets/logo-mark.png")}
        style={styles.logoImage}
      />

      <View style={styles.logoHero}>
        <Text style={styles.logoName}>DISPUTE</Text>
        <Text style={styles.logoTagline}>
          Time records, site photos, and claim reports in one clean field app.
        </Text>
      </View>

      <View style={styles.logoActionPanel}>
        <Pressable accessibilityRole="button" onPress={onStartTracking} style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Start tracking</Text>
        </Pressable>
        <Text style={styles.muted}>No account needed for 30 days. Records stay on this phone.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onShowLogin}
          style={styles.actionButtonSecondary}
        >
          <Text style={styles.actionButtonSecondaryText}>Login</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onShowCreateAccount}
          style={styles.actionButtonSecondary}
        >
          <Text style={styles.actionButtonSecondaryText}>Create account</Text>
        </Pressable>
      </View>
    </View>
  );
}
