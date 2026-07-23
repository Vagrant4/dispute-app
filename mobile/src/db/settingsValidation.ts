export type AppSettings = {
  id: string;
  userId: string;
  currency: string;
  rateBasis: "daily" | "monthly";
  baseRateCents: number;
  dailyHours: number;
  weeklyHours: number;
  normalWorkStartTime: string;
  normalWorkEndTime: string;
  overtimeMultiplier: number;
  offDayMultiplier: number;
  holidayMultiplier: number;
  status: "active" | "locked";
  lockHash: string | null;
  lockedAt: string | null;
};

export type AppSettingsPatch = Partial<
  Pick<
    AppSettings,
    | "currency"
    | "rateBasis"
    | "baseRateCents"
    | "dailyHours"
    | "weeklyHours"
    | "normalWorkStartTime"
    | "normalWorkEndTime"
    | "overtimeMultiplier"
    | "offDayMultiplier"
    | "holidayMultiplier"
  >
>;

export const DEFAULT_SETTINGS_ID = "default";
export const DEFAULT_USER_ID = "local-user";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: DEFAULT_SETTINGS_ID,
  userId: DEFAULT_USER_ID,
  currency: "SGD",
  rateBasis: "daily",
  baseRateCents: 0,
  dailyHours: 8,
  weeklyHours: 44,
  normalWorkStartTime: "08:00",
  normalWorkEndTime: "17:00",
  overtimeMultiplier: 1.5,
  offDayMultiplier: 2,
  holidayMultiplier: 2,
  status: "active",
  lockHash: null,
  lockedAt: null,
};

export function getSettingsIdForUser(userId: string): string {
  return `settings:${userId}`;
}

export function createDefaultAppSettings(userId = DEFAULT_USER_ID): AppSettings {
  return validateAppSettings({
    ...DEFAULT_APP_SETTINGS,
    id: getSettingsIdForUser(userId),
    userId,
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateAppSettings(settings: AppSettings): AppSettings {
  const errors: string[] = [];

  if (!settings.id.trim()) {
    errors.push("id is required");
  }
  if (!settings.userId.trim()) {
    errors.push("userId is required");
  }
  if (!/^[A-Z]{3}$/.test(settings.currency)) {
    errors.push("currency must be 3 uppercase letters");
  }
  if (settings.rateBasis !== "daily" && settings.rateBasis !== "monthly") {
    errors.push("rateBasis must be daily or monthly");
  }
  if (
    !Number.isInteger(settings.baseRateCents) ||
    settings.baseRateCents < 0 ||
    settings.baseRateCents > 100_000_000
  ) {
    errors.push("baseRateCents must be a safe non-negative cent amount");
  }
  if (!isFiniteNumber(settings.dailyHours) || settings.dailyHours < 1 || settings.dailyHours > 24) {
    errors.push("dailyHours must be between 1 and 24");
  }
  if (!isFiniteNumber(settings.weeklyHours) || settings.weeklyHours < 1 || settings.weeklyHours > 168) {
    errors.push("weeklyHours must be between 1 and 168");
  }
  if (settings.weeklyHours < settings.dailyHours) {
    errors.push("weeklyHours must be greater than or equal to dailyHours");
  }
  if (!isValidClockTime(settings.normalWorkStartTime)) {
    errors.push("normalWorkStartTime must be HH:MM");
  }
  if (!isValidClockTime(settings.normalWorkEndTime)) {
    errors.push("normalWorkEndTime must be HH:MM");
  }
  if (
    isValidClockTime(settings.normalWorkStartTime) &&
    isValidClockTime(settings.normalWorkEndTime) &&
    settings.normalWorkStartTime === settings.normalWorkEndTime
  ) {
    errors.push("normalWorkEndTime must be different from normalWorkStartTime");
  }
  if (
    !isFiniteNumber(settings.overtimeMultiplier) ||
    settings.overtimeMultiplier < 1 ||
    settings.overtimeMultiplier > 5
  ) {
    errors.push("overtimeMultiplier must be between 1 and 5");
  }
  if (
    !isFiniteNumber(settings.offDayMultiplier) ||
    settings.offDayMultiplier < 1 ||
    settings.offDayMultiplier > 5
  ) {
    errors.push("offDayMultiplier must be between 1 and 5");
  }
  if (
    !isFiniteNumber(settings.holidayMultiplier) ||
    settings.holidayMultiplier < 1 ||
    settings.holidayMultiplier > 5
  ) {
    errors.push("holidayMultiplier must be between 1 and 5");
  }
  if (settings.status !== "active" && settings.status !== "locked") {
    errors.push("status must be active or locked");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid app settings: ${errors.join(", ")}`);
  }

  return settings;
}

function isValidClockTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }
  const [hourText, minuteText] = value.split(":");
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function validateSettingsPatch(
  current: AppSettings,
  patch: AppSettingsPatch,
): AppSettings {
  return validateAppSettings({
    ...current,
    ...patch,
  });
}
