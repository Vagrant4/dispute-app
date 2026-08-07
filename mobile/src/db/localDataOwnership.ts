import type { LocalDatabase } from "./localDatabase";
import { DEFAULT_USER_ID } from "./settingsValidation";

const WORK_DATA_TABLES = [
  "photo_evidence",
  "generated_documents",
  "time_entries",
  "projects",
  "clients",
] as const;

const AUXILIARY_TABLES = [
  "app_settings",
  "subscription_entitlements",
] as const;

const USER_OWNED_TABLES = [...WORK_DATA_TABLES, ...AUXILIARY_TABLES] as const;

type CountRow = { count: number };

export async function claimLegacyLocalDataForUser(
  database: LocalDatabase,
  userId: string,
): Promise<boolean> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId || normalizedUserId === DEFAULT_USER_ID) {
    return false;
  }

  if ((await countRows(database, normalizedUserId, WORK_DATA_TABLES)) > 0) {
    return false;
  }
  if ((await countOwnedRows(database, DEFAULT_USER_ID)) === 0) {
    return false;
  }

  await database.execAsync("BEGIN IMMEDIATE TRANSACTION;");
  try {
    await database.execAsync("PRAGMA defer_foreign_keys = ON;");
    for (const table of WORK_DATA_TABLES) {
      await database.runAsync(
        `UPDATE ${table} SET user_id = ? WHERE user_id = ?`,
        [normalizedUserId, DEFAULT_USER_ID],
      );
    }
    for (const table of AUXILIARY_TABLES) {
      if ((await countRows(database, normalizedUserId, [table])) === 0) {
        await database.runAsync(
          `UPDATE ${table} SET user_id = ? WHERE user_id = ?`,
          [normalizedUserId, DEFAULT_USER_ID],
        );
      }
    }
    await database.execAsync("COMMIT;");
    return true;
  } catch (error) {
    await database.execAsync("ROLLBACK;");
    throw error;
  }
}

export async function hasLegacyLocalData(
  database: LocalDatabase,
): Promise<boolean> {
  return (await countOwnedRows(database, DEFAULT_USER_ID)) > 0;
}

async function countOwnedRows(
  database: LocalDatabase,
  userId: string,
): Promise<number> {
  return countRows(database, userId, USER_OWNED_TABLES);
}

async function countRows(
  database: LocalDatabase,
  userId: string,
  tables: readonly string[],
): Promise<number> {
  let count = 0;
  for (const table of tables) {
    const row = await database.getFirstAsync<CountRow>(
      `SELECT COUNT(*) AS count FROM ${table} WHERE user_id = ?`,
      [userId],
    );
    count += row?.count ?? 0;
  }
  return count;
}
