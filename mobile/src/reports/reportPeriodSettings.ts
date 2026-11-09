import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export type ReportPeriod = "week" | "month";
const key = (userId: string) => `dispute-report-period:${encodeURIComponent(userId)}`;

export async function loadReportPeriod(userId: string): Promise<ReportPeriod> {
  const value = Platform.OS === "web"
    ? globalThis.localStorage?.getItem(key(userId))
    : await SecureStore.getItemAsync(key(userId));
  return value === "month" ? "month" : "week";
}

export async function saveReportPeriod(userId: string, value: ReportPeriod): Promise<void> {
  if (Platform.OS === "web") globalThis.localStorage?.setItem(key(userId), value);
  else await SecureStore.setItemAsync(key(userId), value);
}

export function getReportPeriodRange(period: ReportPeriod, now = new Date()): { start: string; end: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  if (period === "month") start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
