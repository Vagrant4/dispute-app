import { useEffect, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";

import { fetchReferralSummary, type ReferralSummary } from "../referrals/referralClient";
import { styles } from "../styles";

export function ReferralScreen() {
  const [referral, setReferral] = useState<ReferralSummary | null>(null);
  const [status, setStatus] = useState("Loading your referral code...");

  useEffect(() => {
    void loadReferral();
  }, []);

  async function loadReferral() {
    const result = await fetchReferralSummary();
    if (!result.ok) {
      setReferral(null);
      setStatus(result.message);
      return;
    }
    setReferral(result.referral);
    setStatus(result.referral.rewardMessage);
  }

  async function handleShare() {
    if (!referral) return;
    await Share.share({
      title: "Join DISPUTE",
      message: `Try DISPUTE with my referral code ${referral.code}: ${referral.shareUrl}`,
      url: referral.shareUrl,
    });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Referral pilot</Text>
      <Text style={styles.heading}>Invite another worker</Text>
      <Text style={styles.body}>
        A referral qualifies after the new user completes two paid months. Five qualified referrals earn one reward month.
      </Text>
      <Text style={styles.inputLabel}>Your code</Text>
      <Text selectable style={styles.metricValue}>{referral?.code ?? "Loading"}</Text>
      <Text selectable style={styles.muted}>{referral?.shareUrl ?? ""}</Text>
      <View style={styles.metricGrid}>
        <View style={styles.metricTile}>
          <Text style={styles.metricValue}>{referral?.qualifiedCount ?? 0}</Text>
          <Text style={styles.metricLabel}>qualified</Text>
        </View>
        <View style={styles.metricTile}>
          <Text style={styles.metricValue}>{referral?.earnedRewardMonths ?? 0}</Text>
          <Text style={styles.metricLabel}>reward months</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={!referral}
        onPress={() => void handleShare()}
        style={[styles.actionButton, !referral && styles.disabledButton]}
      >
        <Text style={styles.actionButtonText}>Share referral link</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void loadReferral()} style={styles.actionButtonSecondary}>
        <Text style={styles.actionButtonSecondaryText}>Refresh referral progress</Text>
      </Pressable>
      <Text style={styles.statusMessage}>{status}</Text>
      <Text style={styles.muted}>
        Reward months are recorded first and fulfilled only through a store-compliant process. Accounts that reuse a registered mobile number do not qualify. Rewards may be reviewed before fulfillment.
      </Text>
    </View>
  );
}
