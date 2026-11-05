import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { styles } from "../styles";
import { formatCoordinateLabel, shortAddress } from "../work/addressFormat";
import { openDeviceMaps } from "../work/openDeviceMaps";
import type { LocationReading } from "../work/locationEvidence";

/**
 * In-app location confirmation. Avoids react-native-maps MapView on Android:
 * without a Google Maps API key in the manifest, MapView native-crashes and
 * kills the process (user lands on the launcher). This screen keeps a fixed
 * GPS pin + accuracy ring, and opens the device maps app as a safe fallback.
 */
export function LocationMap({ reading, locating = false }: { reading: LocationReading | null; locating?: boolean }) {
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [openingMaps, setOpeningMaps] = useState(false);

  const ringSize = useMemo(() => {
    const accuracy = reading?.accuracy;
    if (accuracy == null || !Number.isFinite(accuracy)) return 120;
    return Math.max(72, Math.min(220, Math.round(accuracy * 4)));
  }, [reading?.accuracy]);

  if (reading?.latitude == null || reading.longitude == null) {
    return (
      <View style={styles.locationMapFallback}>
        <Text style={styles.muted}>{locating ? "Getting GPS…" : "No GPS reading yet. Tap Refresh."}</Text>
      </View>
    );
  }

  const coordinateLabel = formatCoordinateLabel(reading.latitude, reading.longitude);
  const label = shortAddress(reading) || coordinateLabel;

  async function handleOpenInMaps() {
    if (openingMaps || reading?.latitude == null || reading.longitude == null) return;
    setOpeningMaps(true);
    setMapsError(null);
    try {
      const result = await openDeviceMaps({
        latitude: reading.latitude,
        longitude: reading.longitude,
        label,
      });
      if (!result.ok) setMapsError(result.message);
    } catch {
      setMapsError("Couldn't open a maps app on this phone.");
    } finally {
      setOpeningMaps(false);
    }
  }

  return (
    <View style={styles.locationMapFallback}>
      <View style={styles.locationMapCanvas} accessibilityLabel="GPS pin and accuracy circle">
        <View
          style={[
            styles.locationMapAccuracyRing,
            { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
          ]}
        />
        <View style={styles.locationMapPin} />
      </View>
      <Text style={styles.heading}>{label}</Text>
      <Text style={styles.body}>{coordinateLabel}</Text>
      <Text style={styles.muted}>GPS pin is fixed · not draggable</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open in Maps"
        accessibilityState={{ disabled: openingMaps }}
        disabled={openingMaps}
        onPress={() => void handleOpenInMaps()}
        style={[styles.actionButtonSecondary, openingMaps && styles.disabledButton]}
      >
        <Text style={[styles.actionButtonSecondaryText, openingMaps && styles.disabledButtonText]}>
          {openingMaps ? "Opening Maps…" : "Open in Maps"}
        </Text>
      </Pressable>
      {mapsError ? <Text style={styles.muted}>{mapsError}</Text> : null}
    </View>
  );
}
