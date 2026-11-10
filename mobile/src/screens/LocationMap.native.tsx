import { useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { styles } from "../styles";
import { todayLayout } from "../theme/tokens";
import { shortAddress } from "../work/addressFormat";
import type { LocationReading } from "../work/locationEvidence";

const MAP_ZOOM = 16;
const DEFAULT_LATITUDE = 1.3521;
const DEFAULT_LONGITUDE = 103.8198;
const DEFAULT_REGION_DELTA = 0.01;

export function LocationMap({ reading, locating = false, showDetails = false }: { reading: LocationReading | null; locating?: boolean; showDetails?: boolean }) {
  const map = useRef<MapView>(null);
  const tileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tilesLoaded = useRef(false);
  const tileWarningLogged = useRef(false);
  const hasFix = reading?.latitude != null && reading.longitude != null;
  const latitude = reading?.latitude ?? DEFAULT_LATITUDE;
  const longitude = reading?.longitude ?? DEFAULT_LONGITUDE;
  const coordinate = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);

  useEffect(() => {
    map.current?.animateCamera({ center: coordinate, zoom: MAP_ZOOM }, { duration: 350 });
  }, [coordinate]);

  useEffect(() => () => {
    if (tileTimer.current) clearTimeout(tileTimer.current);
  }, []);

  const label = hasFix ? (locating ? "Finding address…" : shortAddress(reading) || "Address unavailable") : null;

  function handleMapReady() {
    if (tilesLoaded.current || tileWarningLogged.current || tileTimer.current) return;
    tileTimer.current = setTimeout(() => {
      tileTimer.current = null;
      if (!tilesLoaded.current && !tileWarningLogged.current) {
        tileWarningLogged.current = true;
        console.warn("[DISPUTE map] tiles_not_loaded", { code: "MAP_TILES_TIMEOUT" });
      }
    }, 10_000);
  }

  function handleMapLoaded() {
    tilesLoaded.current = true;
    if (tileTimer.current) clearTimeout(tileTimer.current);
    tileTimer.current = null;
  }

  return (
    <View style={styles.locationMapContent}>
      <View
        accessibilityLabel={hasFix ? "Street map with fixed GPS pin and accuracy circle" : "Street map centered on Singapore"}
        style={styles.locationMapCanvas}
      >
        <MapView
          initialCamera={{ center: coordinate, heading: 0, pitch: 0, zoom: MAP_ZOOM }}
          initialRegion={{
            latitude,
            longitude,
            latitudeDelta: DEFAULT_REGION_DELTA,
            longitudeDelta: DEFAULT_REGION_DELTA,
          }}
          mapType="standard"
          mapPadding={{ top: 0, right: 0, bottom: todayLayout.mapPaddingBottom, left: todayLayout.mapPaddingBottom }}
          onMapLoaded={handleMapLoaded}
          onMapReady={handleMapReady}
          provider={PROVIDER_GOOGLE}
          ref={map}
          style={{ width: "100%", height: "100%" }}
          toolbarEnabled={false}
        >
          {hasFix ? <Circle center={coordinate} radius={Math.max(reading?.accuracy ?? 0, 1)} fillColor="rgba(183,255,42,0.12)" strokeColor="rgba(183,255,42,0.65)" /> : null}
          {hasFix ? <Marker coordinate={coordinate} tracksViewChanges={false} /> : null}
        </MapView>
      </View>
      {showDetails && hasFix ? <View style={styles.todayAddressChip} testID="today-address-chip">
        <Text numberOfLines={2} style={styles.todayAddressText}>{label}</Text>
      </View> : null}
    </View>
  );
}
