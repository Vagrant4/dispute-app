import { Text, View } from "react-native";

import { styles } from "../styles";

export function SubscriptionScreen() {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Subscription</Text>
        <Text style={styles.heading}>Status unavailable</Text>
        <Text style={styles.body}>
          Billing is not active in this mobile foundation. No direct Stripe
          checkout button is provided in the app.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Billing path</Text>
        <Text style={styles.body}>
          Future billing access is policy-gated and will be handled through the
          approved path for the product phase that enables subscriptions.
        </Text>
      </View>
    </>
  );
}
