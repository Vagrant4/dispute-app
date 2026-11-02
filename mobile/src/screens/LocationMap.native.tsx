import MapView, { Circle, Marker } from "react-native-maps";
import { Text, View } from "react-native";

import { styles } from "../styles";
import type { LocationReading } from "../work/locationEvidence";

export function LocationMap({ reading }: { reading: LocationReading | null }) {
  if (reading?.latitude == null || reading.longitude == null) {
    return <View style={styles.locationMapFallback}><Text style={styles.muted}>No GPS reading yet.</Text></View>;
  }
  const coordinate = { latitude: reading.latitude, longitude: reading.longitude };
  return <MapView
    mapType="standard"
    region={{ ...coordinate, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
    rotateEnabled={false}
    pitchEnabled={false}
    style={styles.locationMap}
  >
    {reading.accuracy != null ? <Circle center={coordinate} radius={reading.accuracy} fillColor="rgba(168, 255, 26, 0.14)" strokeColor="#A8FF1A" /> : null}
    <Marker coordinate={coordinate} draggable={false} title="Current GPS reading" description={reading.accuracy == null ? "Accuracy unknown" : `±${Math.round(reading.accuracy)} m`} />
  </MapView>;
}
