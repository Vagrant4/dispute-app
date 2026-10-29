import * as FileSystem from "expo-file-system/legacy";
import { createEvidenceLock, type EvidenceLockOptions } from "../evidence/evidenceLock";
import type { PhotoEvidenceRow } from "./photoEvidenceRepository";
import type { PhotoGpsResult } from "./photoEvidenceTypes";

// EXIF without an offset is the device-local wall clock recorded by the file.
export function parseExifDateTimeOriginal(exif: Record<string, unknown> | null | undefined): string | null {
  const value = exif?.DateTimeOriginal;
  if (typeof value !== "string") return null;
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) return null;
  return date.toISOString();
}

export function photoCaptureMetadata(source: "camera" | "gallery", exif?: Record<string, unknown> | null, now = new Date().toISOString()) {
  const capturedAt = source === "camera" ? now : parseExifDateTimeOriginal(exif);
  return { capturedAt, captureSource: source, captureTimeSource: source === "camera" ? "device_clock" as const : capturedAt ? "exif" as const : "unknown" as const };
}

export async function sealPhoto(params: { localUri: string; capturedAt: string | null; gps: PhotoGpsResult | null }, options: EvidenceLockOptions & { readBase64?: (uri: string) => Promise<string> } = {}) {
  try {
    const fileBase64 = await (options.readBase64 ?? ((uri) => FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })))(params.localUri);
    if (!fileBase64) throw new Error("Photo bytes unavailable");
    const lock = await createEvidenceLock({ fileBase64, captured_at: params.capturedAt, latitude: params.gps?.coordinates?.latitude ?? null, longitude: params.gps?.coordinates?.longitude ?? null }, undefined, options);
    return { lockHash: lock.hash, lockedAt: lock.lockedAt };
  } catch {
    return { lockHash: null, lockedAt: null };
  }
}

export function photoSealBadge(photo: Pick<PhotoEvidenceRow, "capture_source" | "capture_time_source" | "lock_hash" | "gps_latitude" | "gps_longitude">): string {
  if (photo.capture_source === "gallery") return photo.capture_time_source !== "exif" ? "Gallery · time unknown" : "Gallery · not sealed at capture";
  if (photo.capture_source === "camera" && photo.lock_hash) return `Sealed on this phone${photo.gps_latitude != null && photo.gps_longitude != null ? " · GPS" : ""}`;
  return "Seal unavailable";
}

export function photoTimeLabel(photo: Pick<PhotoEvidenceRow, "captured_at" | "capture_source" | "capture_time_source">): string {
  if (!photo.captured_at) return photo.capture_source === "gallery" ? "Gallery · time unknown" : "Time unknown";
  const time = new Date(photo.captured_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return photo.capture_source === "gallery" ? `Taken ${time} (from file)` : time;
}
