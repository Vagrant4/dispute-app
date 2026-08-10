import { Pressable, Text, View } from "react-native";

import { styles } from "../styles";
import type { SubscriptionSettingsAction } from "../subscription/subscriptionClient";
import { formatMonthlyStorePrice } from "../subscription/useDisputeBasicStorePrice";

type PlanBillingPanelProps = {
  action: SubscriptionSettingsAction;
  actionStatus: string;
  localizedStorePrice: string | null;
  onManageSubscription: () => void;
  onSubscribe: () => void;
};

export function PlanBillingPanel({
  action,
  actionStatus,
  localizedStorePrice,
  onManageSubscription,
  onSubscribe,
}: PlanBillingPanelProps) {
  const monthlyPrice = formatMonthlyStorePrice(localizedStorePrice);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Plan & billing</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Plan</Text>
        <Text style={styles.rowValue}>DISPUTE Basic</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Price</Text>
        <Text style={styles.rowValue}>{monthlyPrice}</Text>
      </View>
      {action === "subscribe" ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSubscribe}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>Subscribe</Text>
          <Text style={styles.actionButtonSubtext}>
            DISPUTE Basic - {monthlyPrice}
          </Text>
        </Pressable>
      ) : null}
      {action === "manage" ? (
        <Pressable
          accessibilityRole="button"
          onPress={onManageSubscription}
          style={styles.actionButtonSecondary}
        >
          <Text style={styles.actionButtonSecondaryText}>Manage subscription</Text>
        </Pressable>
      ) : null}
      {actionStatus ? (
        <Text style={styles.statusMessage}>{actionStatus}</Text>
      ) : null}
    </View>
  );
}
