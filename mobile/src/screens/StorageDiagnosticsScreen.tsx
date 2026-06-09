import { Text, View } from "react-native";

import { styles } from "../styles";

const rows = [
  ["Storage engine", "Not configured"],
  ["Local database", "Not installed"],
  ["Cloud sync", "Disabled"],
  ["Last backup", "Not available"],
];

export function StorageDiagnosticsScreen() {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Diagnostics</Text>
      <Text style={styles.heading}>Storage status</Text>
      <Text style={styles.body}>
        This screen confirms that persistent mobile storage has not been enabled
        in Phase 1.
      </Text>

      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}
