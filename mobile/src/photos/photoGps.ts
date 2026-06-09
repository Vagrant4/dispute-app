import * as Location from "expo-location";

import type { PhotoGpsResult } from "./photoEvidenceTypes";

export async function getOptionalPhotoGps(): Promise<PhotoGpsResult> {
  try {
    if (!Location.requestForegroundPermissionsAsync) {
      return nonBlockingGpsResult(
        "Location services are unavailable in this runtime. Photo evidence can still be saved without coordinates.",
      );
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      return nonBlockingGpsResult(
        "Location permission was not granted. Photo evidence can still be saved without coordinates.",
      );
    }

    if (!Location.getCurrentPositionAsync) {
      return nonBlockingGpsResult(
        "Location services are unavailable in this runtime. Photo evidence can still be saved without coordinates.",
      );
    }

    const position = await Location.getCurrentPositionAsync({});
    return {
      coordinates: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      message: "Location attached by device permission.",
      blocked: false,
    };
  } catch (error) {
    return nonBlockingGpsResult(
      error instanceof Error
        ? `Location unavailable: ${error.message}`
        : "Location unavailable. Photo evidence can still be saved without coordinates.",
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
