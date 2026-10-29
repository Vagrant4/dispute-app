export type LocationSource = "gps" | "none" | "legacy";
export type LocationReading = {
  phase: "start" | "stop";
  source: LocationSource;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locatedAt: string | null;
};
export type LocationParams = {
  locationText?: string;
  clockOutLocationText?: string;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  gpsAccuracyM?: number | null;
  locatedAt?: string | null;
  locationNote?: string | null;
};
export function locationReading(params: LocationParams, phase: "start" | "stop"): LocationReading {
  const hasFix = params.gpsLatitude != null && params.gpsLongitude != null;
  return {
    phase, source: hasFix ? "gps" : "none",
    address: hasFix ? (phase === "stop" ? params.clockOutLocationText ?? params.locationText : params.locationText)?.trim() || null : null,
    latitude: hasFix ? params.gpsLatitude! : null,
    longitude: hasFix ? params.gpsLongitude! : null,
    accuracy: hasFix ? params.gpsAccuracyM ?? null : null,
    locatedAt: hasFix ? params.locatedAt ?? new Date().toISOString() : null,
  };
}
export function appendLocationHistory(history: string | null | undefined, reading: LocationReading): string {
  const previous = history ? JSON.parse(history) : [];
  return JSON.stringify([...previous, reading]);
}
export function formatLocationChip(reading: LocationReading | null, locating = false): string {
  if (locating) return "Locating…";
  if (!reading || reading.source !== "gps") return "No GPS · Turn on location";
  const accuracy = reading.accuracy == null ? "accuracy unknown" : `±${Math.round(reading.accuracy)} m`;
  const time = reading.locatedAt ? new Date(reading.locatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "time unknown";
  return `${reading.address || "GPS point (no street name)"} · ${accuracy}${reading.accuracy != null && reading.accuracy > 50 ? " · approximate" : ""} · ${time} ⟳`;
}
export function assertRefreshPhase(entry: { endTime: string | null }, phase: "start" | "stop", now = Date.now()): void {
  if (entry.endTime ? phase !== "stop" || now - new Date(entry.endTime).getTime() > 10 * 60_000 : phase !== "start") {
    throw new Error("Location refresh is available while working or within 10 minutes after stopping.");
  }
}
