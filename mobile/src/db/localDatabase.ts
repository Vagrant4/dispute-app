import * as SQLite from "expo-sqlite";

import {
  CURRENT_SCHEMA_VERSION,
  LOCAL_DATABASE_NAME,
  LOCAL_MIGRATIONS,
  SCHEMA_MIGRATIONS_TABLE_SQL,
} from "./schema";

export type LocalDatabase = Pick<
  SQLite.SQLiteDatabase,
  "execAsync" | "getAllAsync" | "getFirstAsync" | "runAsync"
>;

type MigrationRow = {
  version: number;
};

export async function openLocalDatabase(): Promise<SQLite.SQLiteDatabase> {
  return SQLite.openDatabaseAsync(LOCAL_DATABASE_NAME);
}

export async function initializeLocalDatabase(
  database: LocalDatabase,
): Promise<void> {
  await database.execAsync("PRAGMA foreign_keys = ON;");
  await database.execAsync(SCHEMA_MIGRATIONS_TABLE_SQL);

  const current = await getCurrentMigrationVersion(database);

  for (const migration of LOCAL_MIGRATIONS) {
    if (migration.version > current) {
      await database.execAsync("BEGIN IMMEDIATE TRANSACTION;");
      try {
        await database.execAsync(migration.sql);
        await database.runAsync(
          "INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (?, ?)",
          [migration.version, migration.name],
        );
        await database.execAsync("COMMIT;");
      } catch (error) {
        await database.execAsync("ROLLBACK;");
        throw error;
      }
    }
  }
}

export async function getCurrentMigrationVersion(
  database: LocalDatabase,
): Promise<number> {
  const row = await database.getFirstAsync<MigrationRow>(
    "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations",
  );

  return row?.version ?? 0;
}

export async function openAndInitializeLocalDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await openLocalDatabase();
  await initializeLocalDatabase(database);
  return database;
}

export function getExpectedSchemaVersion(): number {
  return CURRENT_SCHEMA_VERSION;
}
