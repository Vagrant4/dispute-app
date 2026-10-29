import type { AddressParts, LocationReading } from "./locationEvidence";

export function shortAddress(reading: { address?: string | null; addressParts?: AddressParts | null } | null): string | null {
  const parts = reading?.addressParts;
  const streetLine = parts?.name?.trim() || [parts?.streetNumber?.trim(), parts?.street?.trim()].filter(Boolean).join(" ");
  const area = parts?.district?.trim() || parts?.city?.trim();
  const values = streetLine || area ? [streetLine, area] : reading?.address?.split(",");
  const distinct = [...new Set(values?.map((value) => value?.trim()).filter(Boolean))];
  return distinct.slice(0, 2).join(", ") || null;
}

export function formatClockTime(date: Date): string {
  return date.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
}
export function formatIdleClock(date: Date): { time: string; period: string } {
  const [time, period] = formatClockTime(date).split(" ");
  return { time, period };
}
export function formatWorkedClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 3600)}:${String(Math.floor(total / 60) % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
export function formatLocationRow(reading: LocationReading | null, options: { working: boolean; locating: boolean; locationOff: boolean }): { title: string; subtitle: string } {
  const time = reading?.locatedAt ? formatClockTime(new Date(reading.locatedAt)) : "time unknown";
  const accuracy = reading?.accuracy == null ? "Accuracy unknown" : `±${Math.round(reading.accuracy)} m`;
  if (!reading || reading.source !== "gps") return { title: "Add your location", subtitle: options.working ? `Saved at ${time}` : options.locating ? "Locating…" : options.locationOff ? "Location is off · Open settings" : "Tap to take a GPS reading" };
  return { title: shortAddress(reading) || "Location saved", subtitle: options.working ? `Saved at ${time}` : options.locating ? "Locating…" : reading.address ? `Tap to update · ${accuracy}` : `${accuracy} · ${time}` };
}

export function workedSecondsToday(completedMinutes: number, clockInAt: Date | null, now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const activeSeconds = clockInAt ? Math.max(0, Math.floor((now.getTime() - Math.max(midnight, clockInAt.getTime())) / 1000)) : 0;
  return completedMinutes * 60 + activeSeconds;
}
