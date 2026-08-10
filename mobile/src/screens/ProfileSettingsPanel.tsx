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
    <View style={styles.card}>
      <Text style={styles.heading}>Profile</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Name</Text>
        <Text numberOfLines={2} style={styles.rowValue}>
          {account.name || "Not set"}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Verified email</Text>
        <Text numberOfLines={2} style={styles.rowValue}>
          {account.email}
        </Text>
      </View>
      {account.phone ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Mobile</Text>
          <Text numberOfLines={2} style={styles.rowValue}>
            {account.phone}
          </Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onLogout}
        style={styles.clockSecondaryButton}
      >
        <Text style={styles.clockSecondaryButtonText}>Logout</Text>
      </Pressable>
    </View>
  );
}
