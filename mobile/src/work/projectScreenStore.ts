import { Platform } from "react-native";
export async function getProjectScreenStore(userId: string) {
  if (Platform.OS === "web") return (await import("./webWorkStore")).webWorkStore;
  return (await (await import("../db/repositories")).getLocalRepositories(userId)).work;
}
export function currentWeekStart(now = new Date()): string {
  const date = new Date(`${new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}
export function needsPayStep({ hourlyRateCents, hasWorkHours }: { hourlyRateCents: number; hasWorkHours: boolean }): boolean {
  return hourlyRateCents === 0 && !hasWorkHours;
}
