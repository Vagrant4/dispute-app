import { Text, View } from "react-native";

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
    </>
  );
}
