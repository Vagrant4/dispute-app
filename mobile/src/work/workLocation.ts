import * as Location from "expo-location";
import type { AddressParts } from "./locationEvidence";
import { formatReadableAddress, isCountryOnly, isUnitNumber } from "./addressFormat";

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
    const geocoded = options.geocode ? await reverseGeocodeAddress(latitude, longitude) : null;
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

export async function reverseGeocodeAddress(
  latitude: number,
  longitude: number,
): Promise<{ address: string | null; addressParts: AddressParts } | null> {
  const timeout = Symbol("geocoder-timeout");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Location.reverseGeocodeAsync({ latitude, longitude }),
      new Promise<typeof timeout>((resolve) => { timer = setTimeout(() => resolve(timeout), 5_000); }),
    ]);
    if (result === timeout) {
      console.warn("[DISPUTE geocode] failed", { code: "GEOCODER_TIMEOUT" });
      return null;
    }
    const location = result[0];
    if (!location) {
      console.warn("[DISPUTE geocode] failed", { code: "GEOCODER_EMPTY" });
      return null;
    }

    const addressParts: AddressParts = {
      name: location.name,
      streetNumber: location.streetNumber,
      street: location.street,
      district: location.district,
      subregion: location.subregion,
      city: location.city,
      region: location.region,
      postalCode: location.postalCode,
      country: location.country,
      formattedAddress: location.formattedAddress,
    };
    const formatted = formatReadableAddress(addressParts);
    const fallback = isUsableFormattedAddress(location.formattedAddress) ? location.formattedAddress!.trim() : null;
    if (!formatted && !fallback) {
      console.warn("[DISPUTE geocode] failed", { code: "GEOCODER_EMPTY" });
    }
    return {
      address: formatted ?? fallback,
      addressParts,
    };
  } catch (error) {
    const detail = error && typeof error === "object" && "code" in error
      ? String(error.code)
      : error instanceof Error ? error.name : "UNKNOWN";
    console.warn("[DISPUTE geocode] failed", { code: `GEOCODER_ERROR:${detail}` });
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isUsableFormattedAddress(value: string | null | undefined): boolean {
  const candidate = value?.trim();
  if (!candidate || /^[-+]?\d+(?:\.\d+)?\s*°?\s*[NS]?\s*,\s*[-+]?\d+(?:\.\d+)?\s*°?\s*[EW]?$/i.test(candidate)) return false;
  const parts = candidate.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.some((part) => !isUnitNumber(part) && !isCountryOnly(part));
}

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
