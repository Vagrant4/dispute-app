import type { LocalDatabase } from "./localDatabase";
import { REPOSITORY_HEALTH_SQL } from "./schema";
import {
  DEFAULT_SETTINGS_ID,
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
  daily_hours: number;
  weekly_hours: number;
  overtime_multiplier: number;
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
    dailyHours: row.daily_hours,
    weeklyHours: row.weekly_hours,
    overtimeMultiplier: row.overtime_multiplier,
    status: row.status,
    lockHash: row.lock_hash,
    lockedAt: row.locked_at,
  });
}

export class SettingsRepository {
  constructor(private readonly database: LocalDatabase) {}

  async getSettings(userId = DEFAULT_USER_ID): Promise<AppSettings> {
    const existing = await this.database.getFirstAsync<AppSettingsRow>(
      "SELECT id, user_id, currency, daily_hours, weekly_hours, overtime_multiplier, status, lock_hash, locked_at FROM app_settings WHERE user_id = ? LIMIT 1",
      [userId],
    );

    if (existing) {
      return fromRow(existing);
    }

    const defaults = createDefaultAppSettings(userId);
    await this.insertSettings(defaults);
    return defaults;
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
    daily_hours = ?,
    weekly_hours = ?,
    overtime_multiplier = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ?
`,
      [
        next.currency,
        next.dailyHours,
        next.weeklyHours,
        next.overtimeMultiplier,
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
INSERT INTO app_settings (
  id,
  user_id,
  currency,
  daily_hours,
  weekly_hours,
  overtime_multiplier,
  status,
  lock_hash,
  locked_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
      [
        settings.id || DEFAULT_SETTINGS_ID,
        settings.userId,
        settings.currency,
        settings.dailyHours,
        settings.weeklyHours,
        settings.overtimeMultiplier,
        settings.status,
        settings.lockHash,
        settings.lockedAt,
      ],
    );
  }
}
