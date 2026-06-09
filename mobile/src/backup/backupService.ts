import { CURRENT_SCHEMA_VERSION, MOBILE_TABLES } from "../db/schema";
import {
  BACKUP_APP_MARKER,
  BACKUP_CREATED_BY,
  BACKUP_SCHEMA_VERSION,
  type BackupEnvelope,
  type BackupImportOptions,
  type BackupImportResult,
  type BackupTables,
  type BackupTableName,
} from "./backupTypes";

export {
  BACKUP_APP_MARKER,
  BACKUP_CREATED_BY,
  BACKUP_SCHEMA_VERSION,
} from "./backupTypes";

export type BackupRepositoryPort = {
  exportTables?: () => Promise<BackupTables>;
  applyBackup: (envelope: BackupEnvelope) => Promise<void>;
};

export function createBackupEnvelope(tables: BackupTables): BackupEnvelope {
  return {
    app: BACKUP_APP_MARKER,
    version: BACKUP_SCHEMA_VERSION,
    schema: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    createdBy: BACKUP_CREATED_BY,
    tables,
  };
}

export async function exportBackupJson(
  repository: Required<Pick<BackupRepositoryPort, "exportTables">>,
): Promise<string> {
  const tables = await repository.exportTables();
  return JSON.stringify(createBackupEnvelope(tables), null, 2);
}

export function parseBackupJson(json: string): BackupEnvelope {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Backup JSON is malformed. Check the file contents and try again.");
  }

  if (!isRecord(parsed)) {
    throw new Error("Backup JSON must contain a backup object.");
  }

  if (parsed.app !== BACKUP_APP_MARKER) {
    throw new Error("This is not a ClaimProof SG mobile backup.");
  }

  if (parsed.version !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup version: ${String(parsed.version)}.`);
  }

  if (parsed.schema !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported local schema version: ${String(parsed.schema)}.`);
  }

  if (!isRecord(parsed.tables)) {
    throw new Error("Backup JSON must contain a tables object.");
  }

  const tables: BackupTables = {};

  for (const tableName of MOBILE_TABLES) {
    const tableRows = parsed.tables[tableName];
    if (tableRows === undefined) {
      continue;
    }
    if (!Array.isArray(tableRows)) {
      throw new Error(`Backup table ${tableName} must be an array.`);
    }
    tables[tableName] = tableRows.map((row, index) => {
      if (!isRecord(row)) {
        throw new Error(`Backup table ${tableName} row ${index + 1} must be an object.`);
      }
      return { ...row };
    });
  }

  return {
    app: BACKUP_APP_MARKER,
    version: BACKUP_SCHEMA_VERSION,
    schema: CURRENT_SCHEMA_VERSION,
    exportedAt:
      typeof parsed.exportedAt === "string"
        ? parsed.exportedAt
        : new Date(0).toISOString(),
    createdBy:
      parsed.createdBy === BACKUP_CREATED_BY
        ? BACKUP_CREATED_BY
        : BACKUP_CREATED_BY,
    tables,
  };
}

export async function importBackupJson(
  json: string,
  repository: BackupRepositoryPort,
  options: BackupImportOptions = {},
): Promise<BackupImportResult> {
  const envelope = parseBackupJson(json);

  if (options.mode !== "overwrite") {
    throw new Error("Import requires explicit overwrite mode before replacing local records.");
  }

  await repository.applyBackup(envelope);

  return {
    importedTableCounts: getImportedTableCounts(envelope.tables),
  };
}

function getImportedTableCounts(
  tables: BackupTables,
): Partial<Record<BackupTableName, number>> {
  const counts: Partial<Record<BackupTableName, number>> = {};

  for (const tableName of MOBILE_TABLES) {
    const rows = tables[tableName];
    if (rows) {
      counts[tableName] = rows.length;
    }
  }

  return counts;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
