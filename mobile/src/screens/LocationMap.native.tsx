import { useMemo, useState } from "react";
import { Image, Linking, Pressable, Text, View, type LayoutChangeEvent } from "react-native";

import { styles } from "../styles";
import { formatCoordinateLabel, shortAddress } from "../work/addressFormat";
import type { LocationReading } from "../work/locationEvidence";
import { buildOpenStreetMapTileUrl, TILE_CACHE_VERSION, TILE_USER_AGENT } from "../maps/tileConfig";

const TILE_SIZE = 256;
const MAP_ZOOM = 16;
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
export { TILE_CACHE_VERSION, TILE_USER_AGENT } from "../maps/tileConfig";

type MapSize = { width: number; height: number };
type StreetTile = { key: string; left: number; top: number; url: string };

export function getTileRequestSource(uri: string) {
  return { uri, headers: { "User-Agent": TILE_USER_AGENT } };
}

function longitudeToWorldX(longitude: number, zoom: number): number {
  return ((longitude + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

function latitudeToWorldY(latitude: number, zoom: number): number {
  const boundedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = (boundedLatitude * Math.PI) / 180;
  return (
    (1 - Math.asinh(Math.tan(radians)) / Math.PI) /
    2 *
    TILE_SIZE *
    2 ** zoom
  );
}

export function getOpenStreetMapTiles(
  latitude: number,
  longitude: number,
  size: MapSize,
  zoom = MAP_ZOOM,
): StreetTile[] {
  const worldX = longitudeToWorldX(longitude, zoom);
  const worldY = latitudeToWorldY(latitude, zoom);
  const leftWorld = worldX - size.width / 2;
  const topWorld = worldY - size.height / 2;
  const firstX = Math.floor(leftWorld / TILE_SIZE);
  const lastX = Math.floor((leftWorld + size.width) / TILE_SIZE);
  const firstY = Math.floor(topWorld / TILE_SIZE);
  const lastY = Math.floor((topWorld + size.height) / TILE_SIZE);
  const tileCount = 2 ** zoom;
  const tiles: StreetTile[] = [];

  for (let tileY = firstY; tileY <= lastY; tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = firstX; tileX <= lastX; tileX += 1) {
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}-${wrappedX}-${tileY}`,
        left: tileX * TILE_SIZE - leftWorld,
        top: tileY * TILE_SIZE - topWorld,
        url: buildOpenStreetMapTileUrl(zoom, wrappedX, tileY),
      });
    }
  }
  return tiles;
}

export function LocationMap({ reading, locating = false }: { reading: LocationReading | null; locating?: boolean }) {
  const [mapSize, setMapSize] = useState<MapSize>({ width: 360, height: 260 });

  const tiles = useMemo(
    () => reading?.latitude == null || reading.longitude == null
      ? []
      : getOpenStreetMapTiles(reading.latitude, reading.longitude, mapSize),
    [mapSize, reading?.latitude, reading?.longitude],
  );
  const ringSize = useMemo(() => {
    const accuracy = reading?.accuracy;
    const latitude = reading?.latitude;
    if (accuracy == null || latitude == null || !Number.isFinite(accuracy)) return 72;
    const metresPerPixel =
      Math.cos((latitude * Math.PI) / 180) *
      EARTH_CIRCUMFERENCE_M /
      (TILE_SIZE * 2 ** MAP_ZOOM);
    const diameter = (accuracy * 2) / Math.max(metresPerPixel, 0.01);
    return Math.max(24, Math.min(Math.min(mapSize.width, mapSize.height) * 0.8, diameter));
  }, [mapSize, reading?.accuracy, reading?.latitude]);

  if (reading?.latitude == null || reading.longitude == null) {
    return (
      <View style={styles.locationMapEmpty}>
        <Text style={styles.muted}>{locating ? "Getting GPS…" : "No GPS reading yet. Tap Refresh."}</Text>
      </View>
    );
  }

  const coordinateLabel = formatCoordinateLabel(reading.latitude, reading.longitude);
  const label = shortAddress(reading) || coordinateLabel;

  function handleMapLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setMapSize({ width, height });
  }

  return (
    <View style={styles.locationMapContent}>
      <View
        accessibilityLabel="Street map with fixed GPS pin and accuracy circle"
        onLayout={handleMapLayout}
        style={styles.locationMapCanvas}
      >
        {tiles.map((tile) => (
          <Image
            key={tile.key}
            source={getTileRequestSource(tile.url)}
            style={[styles.locationMapTile, { left: tile.left, top: tile.top }]}
          />
        ))}
        <View
          pointerEvents="none"
          style={[
            styles.locationMapAccuracyRing,
            { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
          ]}
        />
        <View pointerEvents="none" style={styles.locationMapPin} />
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL("https://www.openstreetmap.org/copyright")}
          style={styles.locationMapAttribution}
        >
          <Text style={styles.locationMapAttributionText}>(c) OpenStreetMap contributors</Text>
        </Pressable>
      </View>
      <View style={styles.locationMapDetails}>
        <Text style={styles.heading}>{label}</Text>
        <Text style={styles.body}>{coordinateLabel}</Text>
        <Text style={styles.muted}>GPS pin is fixed · cannot be moved</Text>
      </View>
    </View>
  );
}
