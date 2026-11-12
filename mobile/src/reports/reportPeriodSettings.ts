import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { sanitizeSecureStoreKeyPart } from "../auth/secureStoreKey";

export type ReportPeriod = "week" | "month";
const webKey = (userId: string) => `dispute-report-period:${encodeURIComponent(userId)}`;

export function getReportPeriodSecureStoreKey(userId: string): string {
  return `dispute.report-period.${sanitizeSecureStoreKeyPart(userId)}`;
}

export async function loadReportPeriod(userId: string): Promise<ReportPeriod> {
  try {
    const value = Platform.OS === "web"
      ? globalThis.localStorage?.getItem(webKey(userId))
      : await SecureStore.getItemAsync(getReportPeriodSecureStoreKey(userId));
    return value === "month" ? "month" : "week";
  } catch (error) {
    const code = error instanceof Error ? error.name : "unknown";
    console.warn("[DISPUTE settings] report_period_load_failed", { code });
    return "week";
  }
}

export async function saveReportPeriod(userId: string, value: ReportPeriod): Promise<void> {
  if (Platform.OS === "web") globalThis.localStorage?.setItem(webKey(userId), value);
  else await SecureStore.setItemAsync(getReportPeriodSecureStoreKey(userId), value);
}

export function getReportPeriodRange(period: ReportPeriod, now = new Date()): { start: string; end: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  if (period === "month") start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
