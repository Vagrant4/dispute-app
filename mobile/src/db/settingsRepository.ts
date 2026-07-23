import type { LocalDatabase } from "./localDatabase";
import { REPOSITORY_HEALTH_SQL } from "./schema";
import {
  DEFAULT_USER_ID,
  type AppSettings,
  type AppSettingsPatch,
  createDefaultAppSettings,
  validateAppSettings,
  validateSettingsPatch,
} from "./settingsValidation";

type AppSettingsRow = {
  id: string;
  user_id: string;
  currency: string;
  rate_basis: AppSettings["rateBasis"] | null;
  base_rate_cents: number | null;
  daily_hours: number;
  weekly_hours: number;
  normal_work_start_time: string | null;
  normal_work_end_time: string | null;
  overtime_multiplier: number;
  off_day_multiplier: number | null;
  holiday_multiplier: number | null;
  status: AppSettings["status"];
  lock_hash: string | null;
  locked_at: string | null;
};

type CountRow = {
  count: number;
};

export type RepositoryHealth = {
  settingsCount: number;
  generatedDocumentsCount: number;
};

function fromRow(row: AppSettingsRow): AppSettings {
  return validateAppSettings({
    id: row.id,
    userId: row.user_id,
    currency: row.currency,
    rateBasis: row.rate_basis ?? "daily",
    baseRateCents: row.base_rate_cents ?? 0,
    dailyHours: row.daily_hours,
    weeklyHours: row.weekly_hours,
    normalWorkStartTime: row.normal_work_start_time ?? "08:00",
    normalWorkEndTime: row.normal_work_end_time ?? "17:00",
    overtimeMultiplier: row.overtime_multiplier,
    offDayMultiplier: row.off_day_multiplier ?? 2,
    holidayMultiplier: row.holiday_multiplier ?? 2,
    status: row.status,
    lockHash: row.lock_hash,
    lockedAt: row.locked_at,
  });
}

export class SettingsRepository {
  constructor(private readonly database: LocalDatabase) {}

  async getSettings(userId = DEFAULT_USER_ID): Promise<AppSettings> {
    const defaults = createDefaultAppSettings(userId);
    await this.insertSettings(defaults);
    const current = await this.database.getFirstAsync<AppSettingsRow>(
      "SELECT id, user_id, currency, rate_basis, base_rate_cents, daily_hours, weekly_hours, normal_work_start_time, normal_work_end_time, overtime_multiplier, off_day_multiplier, holiday_multiplier, status, lock_hash, locked_at FROM app_settings WHERE id = ? AND user_id = ? LIMIT 1",
      [defaults.id, userId],
    );

    if (!current) {
      throw new Error(`App settings could not be initialized for user ${userId}`);
    }

    return fromRow(current);
  }

  async updateSettings(
    patch: AppSettingsPatch,
    userId = DEFAULT_USER_ID,
  ): Promise<AppSettings> {
    const current = await this.getSettings(userId);
    const next = validateSettingsPatch(current, patch);

    await this.database.runAsync(
      `
UPDATE app_settings
SET currency = ?,
    rate_basis = ?,
    base_rate_cents = ?,
    daily_hours = ?,
    weekly_hours = ?,
    normal_work_start_time = ?,
    normal_work_end_time = ?,
    overtime_multiplier = ?,
    off_day_multiplier = ?,
    holiday_multiplier = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ?
`,
      [
        next.currency,
        next.rateBasis,
        next.baseRateCents,
        next.dailyHours,
        next.weeklyHours,
        next.normalWorkStartTime,
        next.normalWorkEndTime,
        next.overtimeMultiplier,
        next.offDayMultiplier,
        next.holidayMultiplier,
        next.id,
        next.userId,
      ],
    );

    return next;
  }

  async getHealth(): Promise<RepositoryHealth> {
    const settings = await this.database.getFirstAsync<CountRow>(
      REPOSITORY_HEALTH_SQL.settingsCount,
    );
    const generatedDocuments = await this.database.getFirstAsync<CountRow>(
      REPOSITORY_HEALTH_SQL.generatedDocumentsCount,
    );

    return {
      settingsCount: settings?.count ?? 0,
      generatedDocumentsCount: generatedDocuments?.count ?? 0,
    };
  }

  private async insertSettings(settings: AppSettings): Promise<void> {
    await this.database.runAsync(
      `
INSERT OR IGNORE INTO app_settings (
  id,
  user_id,
  currency,
  rate_basis,
  base_rate_cents,
  daily_hours,
  weekly_hours,
  normal_work_start_time,
  normal_work_end_time,
  overtime_multiplier,
  off_day_multiplier,
  holiday_multiplier,
  status,
  lock_hash,
  locked_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
      [
        settings.id,
        settings.userId,
        settings.currency,
        settings.rateBasis,
        settings.baseRateCents,
        settings.dailyHours,
        settings.weeklyHours,
        settings.normalWorkStartTime,
        settings.normalWorkEndTime,
        settings.overtimeMultiplier,
        settings.offDayMultiplier,
        settings.holidayMultiplier,
        settings.status,
        settings.lockHash,
        settings.lockedAt,
      ],
    );
  }
}
