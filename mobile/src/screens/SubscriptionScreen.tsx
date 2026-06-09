import { Text, View } from "react-native";

import { subscriptionContent } from "../screenContent";
import { styles } from "../styles";

export function SubscriptionScreen() {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Subscription</Text>
        <Text style={styles.heading}>{subscriptionContent.heading}</Text>
        <Text style={styles.body}>{subscriptionContent.noCheckout}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{subscriptionContent.billingPath}</Text>
        <Text style={styles.body}>{subscriptionContent.policyGated}</Text>
      </View>
    </>
  );
}
