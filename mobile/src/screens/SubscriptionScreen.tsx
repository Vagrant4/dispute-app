import { Text, View } from "react-native";

import type { LocalAccount } from "../auth/localAuth";
import { subscriptionContent } from "../screenContent";
import { styles } from "../styles";
import {
  formatMonthlyStorePrice,
  useDisputeBasicStorePrice,
} from "../subscription/useDisputeBasicStorePrice";

type SubscriptionScreenProps = {
  account: LocalAccount;
};

export function SubscriptionScreen({ account }: SubscriptionScreenProps) {
  const storePrice = useDisputeBasicStorePrice(account);

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Subscription</Text>
        <Text style={styles.heading}>{subscriptionContent.heading}</Text>
        <Text style={styles.body}>{subscriptionContent.noCheckout}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{subscriptionContent.billingPath}</Text>
        <Text style={styles.metricValue}>{formatMonthlyStorePrice(storePrice)}</Text>
        <Text style={styles.body}>{subscriptionContent.policyGated}</Text>
      </View>
    </>
  );
}
