import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { styles } from "../styles";
import { formatCoordinateLabel, shortAddress } from "../work/addressFormat";
import type { LocationReading } from "../work/locationEvidence";

const MAP_ZOOM = 16;
const DEFAULT_LATITUDE = 1.3521;
const DEFAULT_LONGITUDE = 103.8198;

export function LocationMap({ reading, locating = false, showDetails = false }: { reading: LocationReading | null; locating?: boolean; showDetails?: boolean }) {
  const map = useRef<MapView>(null);
  const [mapSize, setMapSize] = useState({ width: 360, height: 260 });
  const hasFix = reading?.latitude != null && reading.longitude != null;
  const latitude = reading?.latitude ?? DEFAULT_LATITUDE;
  const longitude = reading?.longitude ?? DEFAULT_LONGITUDE;
  const coordinate = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);

  useEffect(() => {
    map.current?.animateCamera({ center: coordinate, zoom: MAP_ZOOM }, { duration: 350 });
  }, [coordinate]);

  const coordinateLabel = hasFix ? formatCoordinateLabel(latitude, longitude) : null;
  const label = hasFix ? shortAddress(reading) || coordinateLabel : null;

  function handleMapLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setMapSize({ width, height });
  }

  return (
    <View style={styles.locationMapContent}>
      <View
        accessibilityLabel={hasFix ? "Street map with fixed GPS pin and accuracy circle" : "Street map centered on Singapore"}
        onLayout={handleMapLayout}
        style={styles.locationMapCanvas}
      >
        <MapView
          initialCamera={{ center: coordinate, heading: 0, pitch: 0, zoom: MAP_ZOOM }}
          mapType="standard"
          provider={PROVIDER_GOOGLE}
          ref={map}
          style={{ width: mapSize.width, height: mapSize.height }}
          toolbarEnabled={false}
        >
          {hasFix ? <Circle center={coordinate} radius={Math.max(reading?.accuracy ?? 0, 1)} fillColor="rgba(183,255,42,0.12)" strokeColor="rgba(183,255,42,0.65)" /> : null}
          {hasFix ? <Marker coordinate={coordinate} tracksViewChanges={false} /> : null}
        </MapView>
      </View>
      {showDetails && hasFix ? <View style={styles.locationMapDetails}>
        <Text style={styles.heading}>{label}</Text>
        <Text style={styles.body}>{coordinateLabel}</Text>
        <Text style={styles.muted}>GPS pin is fixed · cannot be moved</Text>
      </View> : null}
    </View>
  );
}
