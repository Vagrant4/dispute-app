export type AppSettings = {
  id: string;
  userId: string;
  currency: string;
  dailyHours: number;
  weeklyHours: number;
  overtimeMultiplier: number;
  status: "active" | "locked";
  lockHash: string | null;
  lockedAt: string | null;
};

export type AppSettingsPatch = Partial<
  Pick<AppSettings, "currency" | "dailyHours" | "weeklyHours" | "overtimeMultiplier">
>;

export const DEFAULT_SETTINGS_ID = "default";
export const DEFAULT_USER_ID = "local-user";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: DEFAULT_SETTINGS_ID,
  userId: DEFAULT_USER_ID,
  currency: "SGD",
  dailyHours: 8,
  weeklyHours: 44,
  overtimeMultiplier: 1.5,
  status: "active",
  lockHash: null,
  lockedAt: null,
};

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
  if (!isFiniteNumber(settings.dailyHours) || settings.dailyHours < 1 || settings.dailyHours > 24) {
    errors.push("dailyHours must be between 1 and 24");
  }
  if (!isFiniteNumber(settings.weeklyHours) || settings.weeklyHours < 1 || settings.weeklyHours > 168) {
    errors.push("weeklyHours must be between 1 and 168");
  }
  if (settings.weeklyHours < settings.dailyHours) {
    errors.push("weeklyHours must be greater than or equal to dailyHours");
  }
  if (
    !isFiniteNumber(settings.overtimeMultiplier) ||
    settings.overtimeMultiplier < 1 ||
    settings.overtimeMultiplier > 5
  ) {
    errors.push("overtimeMultiplier must be between 1 and 5");
  }
  if (settings.status !== "active" && settings.status !== "locked") {
    errors.push("status must be active or locked");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid app settings: ${errors.join(", ")}`);
  }

  return settings;
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
