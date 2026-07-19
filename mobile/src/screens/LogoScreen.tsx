import { Image, Pressable, Text, View } from "react-native";

import { styles } from "../styles";

type LogoScreenProps = {
  onShowCreateAccount: () => void;
  onShowLogin: () => void;
};

export function LogoScreen({
  onShowCreateAccount,
  onShowLogin,
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
        <Pressable
          accessibilityRole="button"
          onPress={onShowLogin}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>Login</Text>
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
