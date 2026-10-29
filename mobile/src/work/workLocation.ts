import * as Location from "expo-location";

export type WorkLocationResult = {
  address: string | null;
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
        "Location services are unavailable in this runtime. Turn on location.",
      );
    }

    // TIME OUT passes prompt:false so the permission dialog is only shown once, at TIME IN.
    const permission =
      options.prompt === false && Location.getForegroundPermissionsAsync
        ? await Location.getForegroundPermissionsAsync()
        : await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      return nonBlockingLocationResult(
        "Location permission was not granted. Turn on location.",
      );
    }

    if (!Location.getCurrentPositionAsync) {
      return nonBlockingLocationResult(
        "Location services are unavailable in this runtime. Turn on location.",
      );
    }

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const address = await reverseGeocodeAddress(latitude, longitude);
    return {
      address,
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
      error instanceof Error
        ? `Location unavailable: ${error.message}`
        : "Location unavailable. Turn on location.",
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
