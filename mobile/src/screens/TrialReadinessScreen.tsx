import { Text, View } from "react-native";

import { trialReadinessContent } from "../screenContent";
import { styles } from "../styles";

export function TrialReadinessScreen() {
  return (
    <>
      <View style={[styles.card, styles.warningCard]}>
        <Text style={styles.eyebrow}>Trial readiness</Text>
        <Text style={styles.heading}>{trialReadinessContent.heading}</Text>
        <Text style={styles.body}>{trialReadinessContent.warning}</Text>
        <Text style={styles.body}>{trialReadinessContent.backupReminder}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Goals</Text>
        <View style={styles.list}>
          {trialReadinessContent.goals.map((goal) => (
            <Text key={goal} style={styles.body}>
              {goal}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Tester checklist</Text>
        <View style={styles.list}>
          {trialReadinessContent.checklist.map((item) => (
            <Text key={item} style={styles.body}>
              {item}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Privacy and limits</Text>
        <Text style={styles.body}>{trialReadinessContent.localOnly}</Text>
        <Text style={styles.body}>{trialReadinessContent.privacy}</Text>
        <Text style={styles.muted}>{trialReadinessContent.limitations}</Text>
      </View>
    </>
  );
}
