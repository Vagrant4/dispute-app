import { Linking, Pressable, Text, View } from "react-native";

import { getAuthApiBaseUrl } from "../auth/remoteAuth";
import { privacyContent } from "../screenContent";
import { styles } from "../styles";

export function PrivacyScreen({ supportOnly = false }: { supportOnly?: boolean } = {}) {
  return (
    <>
      {!supportOnly ? <>
      <View style={styles.settingsSection}>
        <Text style={styles.todayTitle}>Privacy &amp; data</Text>
        <Text style={styles.rowLabel}>{privacyContent.heading}</Text>
        <Text style={styles.body}>{privacyContent.body}</Text>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.rowLabel}>{privacyContent.accountHeading}</Text>
        <Text style={styles.body}>{privacyContent.accountBody}</Text>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.rowLabel}>{privacyContent.analyticsHeading}</Text>
        <Text style={styles.body}>{privacyContent.analyticsBody}</Text>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.rowLabel}>{privacyContent.subscriptionHeading}</Text>
        <Text style={styles.body}>{privacyContent.subscriptionBody}</Text>
      </View>

      </> : null}
      <View style={styles.settingsSection}>
        <Text style={supportOnly ? styles.todayTitle : styles.rowLabel}>{supportOnly ? "Support" : "Privacy and deletion links"}</Text>
        <Text style={styles.body}>
          {supportOnly ? "Questions or problems? See our privacy and help pages." : "Read the privacy policy below. Delete your account here in Settings, or use the web deletion page if you cannot use the app."}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`${getAuthApiBaseUrl()}/privacy`)}
          style={styles.actionButtonSecondary}
        >
          <Text style={styles.actionButtonSecondaryText}>Open Privacy Policy</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`${getAuthApiBaseUrl()}/account-deletion`)}
          style={styles.actionButtonSecondary}
        >
          <Text style={styles.actionButtonSecondaryText}>Open web account deletion</Text>
        </Pressable>
      </View>
    </>
  );
}
