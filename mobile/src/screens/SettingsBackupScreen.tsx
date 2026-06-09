import { Text, View } from "react-native";

import { styles } from "../styles";

const backupWarning =
  "ClaimProof SG stores records locally on this device. If you delete the app, change phone, or lose the device, your records may be lost unless you export or back them up.";

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
