import { Text, View } from "react-native";

import { styles } from "../styles";

export function PrivacyScreen() {
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Privacy notice</Text>
        <Text style={styles.heading}>Local-first in V1</Text>
        <Text style={styles.body}>
          ClaimProof SG V1 is designed around local-first records. Work logs,
          evidence notes, and status information are intended to stay on this
          device unless you choose an export or backup action in a later phase.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>No analytics in V1</Text>
        <Text style={styles.body}>
          This mobile foundation does not include analytics, tracking SDKs, cloud
          sync, or background evidence uploads.
        </Text>
      </View>
    </>
  );
}
