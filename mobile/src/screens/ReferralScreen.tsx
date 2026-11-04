import { useEffect, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";

import { fetchReferralSummary, type ReferralSummary } from "../referrals/referralClient";
import { styles } from "../styles";
import { formatReferralCodeForDisplay } from "../referrals/formatReferralCodeForDisplay";

export function ReferralScreen() {
  const [referral, setReferral] = useState<ReferralSummary | null>(null);
  const [status, setStatus] = useState("");
  const [codeLoading, setCodeLoading] = useState(true);

  useEffect(() => {
    void loadReferral();
  }, []);

  async function loadReferral() {
    setCodeLoading(true);
    const result = await fetchReferralSummary();
    setCodeLoading(false);
    if (!result.ok) {
      setReferral(null);
      setStatus("");
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
    <View style={styles.settingsSection}>
      <Text style={styles.todayTitle}>Refer a friend</Text>
      <Text style={styles.body}>
        A referral counts after the new user completes two paid months. Five counted referrals earn one free month.
      </Text>
      <Text style={styles.inputLabel}>Your code</Text>
      <Text selectable style={[styles.settingsRowLabel, styles.referralCodeSlot, !referral && styles.muted]}>
        {codeLoading ? "Getting your code…" : referral ? formatReferralCodeForDisplay(referral.code) : "Connect to the internet to see your code"}
      </Text>
      {!codeLoading && !referral ? (
        <View style={styles.referralOfflineRow}><Text style={styles.muted}>Offline.</Text><Pressable accessibilityRole="button" onPress={() => void loadReferral()}><Text style={styles.body}>Try again</Text></Pressable></View>
      ) : null}
      <Text selectable style={styles.muted}>{referral?.shareUrl ?? ""}</Text>
      <View style={styles.referralStatsRow}>
        <View style={styles.referralStatTile}>
          <Text style={styles.referralStatValue}>{referral?.qualifiedCount ?? 0}</Text>
          <Text style={styles.metricLabel}>counted</Text>
        </View>
        <View style={styles.referralStatTile}>
          <Text style={styles.referralStatValue}>{referral?.earnedRewardMonths ?? 0}</Text>
          <Text style={styles.metricLabel}>reward months</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={!referral}
        onPress={() => void handleShare()}
        style={[styles.actionButtonSecondary, !referral && styles.disabledButton]}
      >
        <Text style={[styles.actionButtonSecondaryText, (!referral) && styles.disabledButtonText]}>Share referral link</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void loadReferral()} style={styles.actionButtonSecondary}>
        <Text style={styles.actionButtonSecondaryText}>Refresh referral progress</Text>
      </Pressable>
      <Text style={styles.statusMessage}>{status}</Text>
      <Text style={styles.muted}>
        Free months are recorded first, then given only in a store-approved way. Accounts that reuse a registered phone number do not count. Rewards may be checked before they are given.
      </Text>
    </View>
  );
}
