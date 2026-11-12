import * as Location from "expo-location";

import type { PhotoGpsResult } from "./photoEvidenceTypes";

const PHOTO_GPS_TIMEOUT_MS = 5_000;

export async function getOptionalPhotoGps(timeoutMs = PHOTO_GPS_TIMEOUT_MS): Promise<PhotoGpsResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      readOptionalPhotoGps(),
      new Promise<PhotoGpsResult>((resolve) => {
        timeout = setTimeout(() => {
          console.warn("[DISPUTE photo] failed", { code: "PHOTO_GPS_TIMEOUT" });
          resolve(nonBlockingGpsResult("Location timed out. The photo is saved without a place."));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readOptionalPhotoGps(): Promise<PhotoGpsResult> {
  try {
    if (!Location.requestForegroundPermissionsAsync) {
      return nonBlockingGpsResult(
        "Location is off. The photo is saved without a place.",
      );
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      return nonBlockingGpsResult(
        "Location is off. The photo is saved without a place.",
      );
    }

    if (!Location.getCurrentPositionAsync) {
      return nonBlockingGpsResult(
        "Location is off. The photo is saved without a place.",
      );
    }

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    let address: string | null = null;
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      const place = results[0];
      if (place) address = [place.streetNumber, place.street, place.postalCode].filter(Boolean).join(" ") || null;
    } catch { /* Coordinates still provide evidence without a street name. */ }
    return {
      coordinates: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      },
      message: address ? `GPS address: ${address}` : "GPS point (no street name)",
      blocked: false,
    };
  } catch (error) {
    return nonBlockingGpsResult(
      "Location is off. The photo is saved without a place.",
    );
  }
}

function nonBlockingGpsResult(message: string): PhotoGpsResult {
  return {
    coordinates: null,
    message,
    blocked: false,
  };
}
