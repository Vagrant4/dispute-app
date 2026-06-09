import * as SQLite from "expo-sqlite";

import {
  CURRENT_SCHEMA_VERSION,
  LOCAL_DATABASE_NAME,
  LOCAL_MIGRATIONS,
} from "./schema";

export type LocalDatabase = Pick<
  SQLite.SQLiteDatabase,
  "execAsync" | "getFirstAsync" | "runAsync"
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
  await database.execAsync(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

  const current = await getCurrentMigrationVersion(database);

  for (const migration of LOCAL_MIGRATIONS) {
    if (migration.version > current) {
      await database.execAsync(migration.sql);
      await database.runAsync(
        "INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
        [migration.version, migration.name],
      );
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
