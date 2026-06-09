import { MOBILE_TABLES } from "../db/schema";
import type { LocalDatabase } from "../db/localDatabase";
import type { BackupEnvelope, BackupRow, BackupTables, BackupTableName } from "./backupTypes";

type BackupSqlValue = string | number | boolean | null | Uint8Array | ArrayBuffer;

const DELETE_ORDER: BackupTableName[] = [
  "photo_evidence",
  "generated_documents",
  "time_entries",
  "projects",
  "clients",
  "subscription_entitlements",
  "app_settings",
  "schema_migrations",
];

const INSERT_ORDER: BackupTableName[] = [...MOBILE_TABLES];

export class BackupRepository {
  constructor(private readonly database: LocalDatabase) {}

  async exportTables(): Promise<BackupTables> {
    const tables: BackupTables = {};

    for (const tableName of MOBILE_TABLES) {
      tables[tableName] = await this.database.getAllAsync<BackupRow>(
        `SELECT * FROM ${quoteIdentifier(tableName)};`,
      );
    }

    return tables;
  }

  async applyBackup(envelope: BackupEnvelope): Promise<void> {
    await this.database.execAsync("BEGIN IMMEDIATE TRANSACTION;");
    try {
      await this.database.execAsync("PRAGMA foreign_keys = OFF;");
      for (const tableName of DELETE_ORDER) {
        await this.database.execAsync(`DELETE FROM ${quoteIdentifier(tableName)}`);
      }

      for (const tableName of INSERT_ORDER) {
        const rows = envelope.tables[tableName] ?? [];
        for (const row of rows) {
          await this.insertRow(tableName, row);
        }
      }

      await this.database.execAsync("PRAGMA foreign_keys = ON;");
      await this.database.execAsync("COMMIT;");
    } catch (error) {
      await this.database.execAsync("ROLLBACK;");
      await this.database.execAsync("PRAGMA foreign_keys = ON;");
      throw error;
    }
  }

  private async insertRow(tableName: BackupTableName, row: BackupRow): Promise<void> {
    const columns = Object.keys(row);
    if (columns.length === 0) {
      return;
    }

    const columnSql = columns.map(quoteIdentifier).join(", ");
    const placeholderSql = columns.map(() => "?").join(", ");
    const values = columns.map((columnName) =>
      toBackupSqlValue(row[columnName], tableName, columnName),
    );

    await this.database.runAsync(
      `INSERT INTO ${quoteIdentifier(tableName)} (${columnSql}) VALUES (${placeholderSql});`,
      values,
    );
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function toBackupSqlValue(
  value: unknown,
  tableName: string,
  columnName: string,
): BackupSqlValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer
  ) {
    return value;
  }

  throw new Error(
    `Backup value for ${tableName}.${columnName} must be a SQLite-compatible primitive.`,
  );
}
