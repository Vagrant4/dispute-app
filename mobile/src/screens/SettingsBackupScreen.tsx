import { Text, View } from "react-native";

import { backupWarning } from "../screenContent";
import { styles } from "../styles";

export function SettingsBackupScreen() {
  return (
    <>
      <View style={[styles.card, styles.warningCard]}>
        <Text style={styles.eyebrow}>Backup warning</Text>
        <Text style={styles.body}>{backupWarning}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Backup tools</Text>
        <Text style={styles.body}>
          Backup, restore, and export controls are placeholders in this phase.
          They will be implemented after the local storage design is added.
        </Text>
      </View>
    </>
  );
}
