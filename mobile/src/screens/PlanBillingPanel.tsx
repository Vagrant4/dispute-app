import { Pressable, Text, View } from "react-native";

import { styles } from "../styles";
import { planTrialLine, type SubscriptionEntitlement, type SubscriptionSettingsAction } from "../subscription/subscriptionClient";
import { formatMonthlyStorePrice } from "../subscription/useDisputeBasicStorePrice";

type PlanBillingPanelProps = {
  subscription: SubscriptionEntitlement | null;
  action: SubscriptionSettingsAction;
  actionStatus: string;
  localizedStorePrice: string | null;
  onManageSubscription: () => void;
  onSubscribe: () => void;
  exportNote?: string | null;
};

export function PlanBillingPanel({
  subscription,
  action,
  actionStatus,
  localizedStorePrice,
  onManageSubscription,
  onSubscribe,
  exportNote,
}: PlanBillingPanelProps) {
  const trialLine = planTrialLine(subscription);
  const monthlyPrice = formatMonthlyStorePrice(localizedStorePrice);

  return (
    <View style={styles.settingsSection}>
      <Text style={styles.todayTitle}>Plan</Text>
      {trialLine ? <Text style={styles.muted}>{trialLine}</Text> : null}
      <View style={styles.settingsValueRow}>
        <Text style={styles.rowLabel}>Plan</Text>
        <Text style={styles.rowValue}>Dispute Basic</Text>
      </View>
      {action !== "subscribe" ? (
        <View style={styles.settingsValueRow}>
          <Text style={styles.rowLabel}>Price</Text>
          <Text style={styles.rowValue}>{monthlyPrice}</Text>
        </View>
      ) : null}
      {subscription?.status === "TRIALING" && subscription.trialEndsAt ? (
        <Text style={styles.muted}>{`Your trial ends on ${formatTrialEnd(subscription.trialEndsAt)}. You can subscribe here after that.`}</Text>
      ) : exportNote ? (
        <Text style={styles.muted}>{exportNote.replaceAll("DISPUTE Basic", "Dispute Basic")}</Text>
      ) : null}
      {action === "subscribe" ? (
        <>
        <Pressable
          accessibilityRole="button"
          onPress={onSubscribe}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>Subscribe</Text>
        </Pressable>
        <View style={styles.subscriptionPriceNote}>
          <Text style={styles.body}>{monthlyPrice}</Text>
          {localizedStorePrice ? (
            <Text style={styles.muted}>Final price shown in Google Play.</Text>
          ) : null}
        </View>
        </>
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

function formatTrialEnd(endIso: string): string {
  return new Date(endIso).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}
