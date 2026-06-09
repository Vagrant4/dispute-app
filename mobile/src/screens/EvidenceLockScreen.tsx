import { Text, View } from "react-native";

import { evidenceLockStates } from "../screenContent";
import { styles } from "../styles";

export function EvidenceLockScreen() {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Evidence Lock</Text>
        <Text style={styles.heading}>Intro and status</Text>
        <Text style={styles.body}>
          Evidence Lock is not enforced in Phase 1. This screen introduces the
          statuses that will protect records once evidence storage is added.
        </Text>
      </View>

      {evidenceLockStates.map((state) => (
        <View key={state.title} style={styles.card}>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{state.title}</Text>
          </View>
          <Text style={styles.body}>{state.description}</Text>
        </View>
      ))}
    </>
  );
}
