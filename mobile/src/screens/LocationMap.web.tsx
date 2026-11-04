import { Text, View } from "react-native";

import { styles } from "../styles";
import type { LocationReading } from "../work/locationEvidence";

export function LocationMap({ reading, locating = false }: { reading: LocationReading | null; locating?: boolean }) {
  return <View style={styles.locationMapFallback}>
    <Text style={styles.heading}>GPS location</Text>
    {reading?.latitude != null && reading.longitude != null ? <>
      <Text style={styles.body}>{reading.latitude.toFixed(6)}, {reading.longitude.toFixed(6)}</Text>
      <Text style={styles.locationMapAccuracy}>{reading.accuracy == null ? "Accuracy unknown" : `±${Math.round(reading.accuracy)} m`}</Text>
    </> : <Text style={styles.muted}>{locating ? "Getting GPS…" : "No GPS reading yet. Tap Refresh."}</Text>}
  </View>;
}
