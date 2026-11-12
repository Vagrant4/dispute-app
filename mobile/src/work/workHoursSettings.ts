import { Platform } from "react-native";
import { validateSettingsPatch, type AppSettingsPatch } from "../db/settingsValidation";
import { readWebWorkHours } from "./webWorkHours";
export async function loadWorkHours(userId: string) {
  if (Platform.OS === "web") return readWebWorkHours(userId);
  const { settings } = await (await import("../db/repositories")).getLocalRepositories(userId);
  return { settings: await settings.getSettings(userId), ...await settings.getReportPreferences(userId) };
}
export async function saveWorkHours(userId: string, patch: AppSettingsPatch, reportName?: string) {
  if (Platform.OS === "web") {
    const previous = readWebWorkHours(userId);
    const settings = validateSettingsPatch(previous.settings, patch);
    globalThis.localStorage.setItem(`dispute-work-hours:${encodeURIComponent(userId)}`, JSON.stringify({ settings, reportName: reportName ?? previous.reportName }));
    return settings;
  }
  const repositories = await (await import("../db/repositories")).getLocalRepositories(userId);
  const settings = await repositories.settings.updateSettings(patch, userId);
  await repositories.settings.saveReportPreferences(userId, reportName);
  return settings;
}
export function calculateNormalHours(startTime: string, endTime: string): number {
  const minutes = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
  const start = minutes(startTime); let end = minutes(endTime);
  if (end <= start) end += 1440;
  return Number(((end - start) / 60).toFixed(2));
}
