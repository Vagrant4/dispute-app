import { Text, View } from "react-native";

import { styles } from "../styles";
import { formatCoordinateLabel, shortAddress } from "../work/addressFormat";
import type { LocationReading } from "../work/locationEvidence";

export function LocationMap({ reading, locating = false, showDetails = false }: { reading: LocationReading | null; locating?: boolean; showDetails?: boolean }) {
  const coordinateLabel = reading?.latitude != null && reading.longitude != null
    ? formatCoordinateLabel(reading.latitude, reading.longitude)
    : null;
  return <View style={styles.locationMapFallback}>
    <Text style={styles.heading}>GPS location</Text>
    {reading?.latitude != null && reading.longitude != null ? <>
      {showDetails ? <Text style={styles.body}>{shortAddress(reading) || coordinateLabel}</Text> : null}
    </> : <Text style={styles.muted}>{locating ? "Getting GPS…" : "No GPS reading yet. Tap the crosshair."}</Text>}
  </View>;
}
