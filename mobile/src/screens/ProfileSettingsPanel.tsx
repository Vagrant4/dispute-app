import { Pressable, Text, View } from "react-native";

import type { LocalAccount } from "../auth/localAuth";
import { styles } from "../styles";

type ProfileSettingsPanelProps = {
  account: LocalAccount;
  onLogout: () => void;
};

export function ProfileSettingsPanel({
  account,
  onLogout,
}: ProfileSettingsPanelProps) {
  return (
    <View style={styles.settingsSection}>
      <Text style={styles.todayTitle}>Name</Text>
      <Text style={styles.muted}>{account.isGuest ? "On this phone · no account yet" : `Signed in as ${account.name}`}</Text>
      {account.emailVerified ? <Text style={styles.muted}>Email verified</Text> : null}
      <View style={styles.settingsValueRow}>
        <Text style={styles.rowLabel}>Name</Text>
        <Text numberOfLines={2} style={styles.rowValue}>
          {account.name || "Not set"}
        </Text>
      </View>
      <View style={styles.settingsValueRow}>
        <Text style={styles.rowLabel}>Verified email</Text>
        <Text numberOfLines={2} style={styles.rowValue}>
          {account.email}
        </Text>
      </View>
      {account.phone ? (
        <View style={styles.settingsValueRow}>
          <Text style={styles.rowLabel}>Mobile</Text>
          <Text numberOfLines={2} style={styles.rowValue}>
            {account.phone}
          </Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onLogout}
        style={styles.actionButtonSecondary}
      >
        <Text style={styles.actionButtonSecondaryText}>Logout</Text>
      </Pressable>
    </View>
  );
}
