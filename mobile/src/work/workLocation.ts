import * as Location from "expo-location";

export type WorkLocationResult = {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  message: string;
  blocked: boolean;
};

export async function getOptionalWorkLocationAddress(): Promise<WorkLocationResult> {
  try {
    if (!Location.requestForegroundPermissionsAsync) {
      return nonBlockingLocationResult(
        "Location services are unavailable in this runtime. Enter the site address manually.",
      );
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      return nonBlockingLocationResult(
        "Location permission was not granted. Enter the site address manually.",
      );
    }

    if (!Location.getCurrentPositionAsync) {
      return nonBlockingLocationResult(
        "Location services are unavailable in this runtime. Enter the site address manually.",
      );
    }

    const position = await Location.getCurrentPositionAsync({});
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const address = await reverseGeocodeAddress(latitude, longitude);
    return {
      address: address ?? `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      latitude,
      longitude,
      message: address
        ? "Address filled from device location."
        : "Coordinates filled from device location. Address lookup was unavailable.",
      blocked: false,
    };
  } catch (error) {
    return nonBlockingLocationResult(
      error instanceof Error
        ? `Location unavailable: ${error.message}`
        : "Location unavailable. Enter the site address manually.",
    );
  }
}

async function reverseGeocodeAddress(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (!Location.reverseGeocodeAsync) {
    return null;
  }

  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!address) {
      return null;
    }

    const parts = [
      address.name,
      address.street,
      address.district,
      address.city,
      address.region,
      address.postalCode,
      address.country,
    ]
      .map((value) => value?.trim())
      .filter(Boolean);
    return [...new Set(parts)].join(", ") || null;
  } catch {
    return null;
  }
}

function nonBlockingLocationResult(message: string): WorkLocationResult {
  return {
    address: null,
    latitude: null,
    longitude: null,
    message,
    blocked: false,
  };
}
