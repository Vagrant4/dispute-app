import { Text, View } from "react-native";

import { styles } from "../styles";

export function HomeScreen() {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Mobile foundation</Text>
        <Text style={styles.heading}>Evidence-first records for freelancers</Text>
        <Text style={styles.body}>
          This mobile shell prepares ClaimProof SG for local-first work logs,
          project activity, photo evidence, pay summaries, and progress claim
          reports.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Phase 1 scope</Text>
        <View style={styles.list}>
          <Text style={styles.body}>Authentication and sync are not connected.</Text>
          <Text style={styles.body}>SQLite storage is reserved for a later phase.</Text>
          <Text style={styles.body}>Camera, gallery, and optional GPS are prepared for photo evidence.</Text>
        </View>
      </View>
    </>
  );
}
