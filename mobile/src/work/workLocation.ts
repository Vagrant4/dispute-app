import * as Location from "expo-location";
import type { AddressParts } from "./locationEvidence";

export type WorkLocationResult = {
  address: string | null;
  addressParts?: AddressParts | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string | null;
  message: string;
  blocked: boolean;
};

export async function getOptionalWorkLocationAddress(
  options: { prompt?: boolean } = {},
): Promise<WorkLocationResult> {
  try {
    if (!Location.requestForegroundPermissionsAsync) {
      return nonBlockingLocationResult(
        "Location is off. Turn on location and try again.",
      );
    }

    // TIME OUT passes prompt:false so the permission dialog is only shown once, at TIME IN.
    const permission =
      options.prompt === false && Location.getForegroundPermissionsAsync
        ? await Location.getForegroundPermissionsAsync()
        : await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      return nonBlockingLocationResult(
        "Location is off. Turn on location and try again.",
      );
    }

    if (!Location.getCurrentPositionAsync) {
      return nonBlockingLocationResult(
        "Location is off. Turn on location and try again.",
      );
    }

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const geocoded = await reverseGeocodeAddress(latitude, longitude);
    const address = geocoded?.address ?? null;
    return {
      address,
      addressParts: geocoded?.addressParts ?? null,
      accuracy: position.coords.accuracy,
      timestamp: new Date(position.timestamp).toISOString(),
      latitude,
      longitude,
      message: address
        ? "Address filled from device location."
        : "Coordinates filled from device location. Address lookup was unavailable.",
      blocked: false,
    };
  } catch (error) {
    return nonBlockingLocationResult(
      "Location is off. Turn on location and try again.",
    );
  }
}

async function reverseGeocodeAddress(
  latitude: number,
  longitude: number,
): Promise<{ address: string | null; addressParts: AddressParts } | null> {
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
    return { address: [...new Set(parts)].join(", ") || null, addressParts: { name: address.name, streetNumber: address.streetNumber, street: address.street, district: address.district, city: address.city } };
  } catch {
    return null;
  }
}

function nonBlockingLocationResult(message: string): WorkLocationResult {
  return {
    accuracy: null,
    timestamp: null,
    address: null,
    latitude: null,
    longitude: null,
    message,
    blocked: false,
  };
}

export async function getWorkLocationWithTimeout(milliseconds: number, options: { prompt?: boolean } = {}): Promise<WorkLocationResult | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getOptionalWorkLocationAddress(options),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), milliseconds); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
