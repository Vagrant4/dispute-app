import type { AppSettings } from "../db/settingsValidation";

/** Converts the worker's saved rate to the hourly cents used by pay calculations. */
export function ownRateToHourlyCents(settings: Pick<AppSettings, "rateBasis" | "baseRateCents" | "dailyHours" | "weeklyHours">): number {
  const { baseRateCents, dailyHours, rateBasis, weeklyHours } = settings;
  if (!Number.isFinite(baseRateCents) || baseRateCents <= 0) return 0;
  if (rateBasis === "hourly") return Math.round(baseRateCents);
  if (rateBasis === "daily") return Number.isFinite(dailyHours) && dailyHours > 0 ? Math.round(baseRateCents / dailyHours) : 0;
  return Number.isFinite(weeklyHours) && weeklyHours > 0 ? Math.round((baseRateCents * 12) / (52 * weeklyHours)) : 0;
}
