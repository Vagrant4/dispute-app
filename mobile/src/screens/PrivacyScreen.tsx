import { Linking, Pressable, Text, View } from "react-native";

import { getAuthApiBaseUrl } from "../auth/remoteAuth";
import { privacyContent } from "../screenContent";
import { styles } from "../styles";

export function PrivacyScreen() {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Privacy notice</Text>
        <Text style={styles.heading}>{privacyContent.heading}</Text>
        <Text style={styles.body}>{privacyContent.body}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{privacyContent.analyticsHeading}</Text>
        <Text style={styles.body}>{privacyContent.analyticsBody}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Privacy and deletion links</Text>
        <Text style={styles.body}>
          Read the public policy or use the web deletion page when the mobile app
          is unavailable.
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
