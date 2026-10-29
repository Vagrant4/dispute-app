import { createDefaultAppSettings, validateSettingsPatch } from "../db/settingsValidation";
export function readWebWorkHours(userId: string) {
  const raw = globalThis.localStorage?.getItem(`dispute-work-hours:${encodeURIComponent(userId)}`);
  const saved = raw ? JSON.parse(raw) : null;
  return { settings: validateSettingsPatch(createDefaultAppSettings(userId), saved?.settings ?? {}), hasWorkHours: Boolean(saved), reportName: String(saved?.reportName ?? "") };
}
