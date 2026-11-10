import * as Location from "expo-location";
import Constants from "expo-constants";
import type { AddressParts } from "./locationEvidence";
import { formatReadableAddress } from "./addressFormat";

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
  options: { prompt?: boolean; geocode?: boolean } = {},
): Promise<WorkLocationResult> {
  try {
    if (!Location.requestForegroundPermissionsAsync) {
      return nonBlockingLocationResult(
        "Location is off. Turn on location and try again.",
      );
    }

    // TIME OUT passes prompt:false so the permission dialog is only shown once, at TIME IN.
    let permission =
      options.prompt === false && Location.getForegroundPermissionsAsync
        ? await Location.getForegroundPermissionsAsync()
        : await Location.requestForegroundPermissionsAsync();
    if (options.prompt === false && permission.status === Location.PermissionStatus.UNDETERMINED) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      return nonBlockingLocationResult(
        "Location is off. Turn on location and try again.",
      );
    }

    if (Location.hasServicesEnabledAsync && !(await Location.hasServicesEnabledAsync())) {
      return nonBlockingLocationResult(
        "Location services are off. Turn on Location in Android settings.",
      );
    }

    if (!Location.getCurrentPositionAsync) {
      return nonBlockingLocationResult(
        "Location is off. Turn on location and try again.",
      );
    }

    const lastKnown = Location.getLastKnownPositionAsync
      ? await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 100 })
      : null;
    const position = await getCurrentPositionWithFallback(lastKnown);
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const geocoded = options.geocode ? await googleGeocodeAddress(latitude, longitude) : null;
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

export async function googleGeocodeAddress(
  latitude: number,
  longitude: number,
): Promise<{ address: string | null; addressParts: AddressParts } | null> {
  const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey;
  if (typeof apiKey !== "string" || !apiKey.trim()) return null;

  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const response = await Promise.race([
      fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${encodeURIComponent(apiKey)}`, {
        headers: {
          "X-Android-Package": "sg.claimproof.mobile.test",
          "X-Android-Cert": "BA7A124DB2C3A7728ED407E494C9C4B2C7B5591D",
        },
      }),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 4_000); }),
    ]).finally(() => { if (timer) clearTimeout(timer); });
    if (!response?.ok) return null;
    const payload = await response.json() as GoogleGeocodeResponse;
    const result = payload.status === "OK" ? payload.results[0] : undefined;
    if (!result) return null;
    const component = (type: string) => result.address_components.find((part) => part.types.includes(type))?.long_name ?? null;

    const addressParts: AddressParts = {
      name: component("premise") ?? component("point_of_interest"),
      streetNumber: component("street_number"),
      street: component("route"),
      district: component("sublocality_level_1") ?? component("neighborhood"),
      city: component("locality"),
    };
    return {
      address: formatReadableAddress({ ...addressParts, region: component("administrative_area_level_1"), postalCode: component("postal_code"), country: component("country") }),
      addressParts,
    };
  } catch {
    return null;
  }
}

type GoogleGeocodeResponse = {
  status: string;
  results: Array<{
    formatted_address: string;
    address_components: Array<{ long_name: string; types: string[] }>;
  }>;
};

async function getCurrentPositionWithFallback(
  lastKnown: Awaited<ReturnType<typeof Location.getLastKnownPositionAsync>> | null,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const current = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 15_000); }),
    ]);
    if (current) return current;
    if (lastKnown) return lastKnown;
    throw new Error("No GPS position available");
  } finally {
    if (timer) clearTimeout(timer);
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

export async function getWorkLocationWithTimeout(milliseconds: number, options: { prompt?: boolean; geocode?: boolean } = {}): Promise<WorkLocationResult | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getOptionalWorkLocationAddress(options),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), milliseconds); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
