import { CURRENT_SCHEMA_VERSION } from "../db/schema";

export const BACKUP_APP_MARKER = "ClaimProof SG Mobile";
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_CREATED_BY = "claimproof-sg-mobile";

export const BACKUP_TABLES = [
  "app_settings",
  "clients",
  "projects",
  "time_entries",
  "photo_evidence",
  "generated_documents",
  "subscription_entitlements",
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];
export type BackupRow = Record<string, unknown>;
export type BackupTables = Partial<Record<BackupTableName, BackupRow[]>>;

export type BackupEnvelope = {
  app: typeof BACKUP_APP_MARKER;
  version: typeof BACKUP_SCHEMA_VERSION;
  schema: typeof CURRENT_SCHEMA_VERSION;
  exportedAt: string;
  createdBy: typeof BACKUP_CREATED_BY;
  tables: BackupTables;
};

export type BackupImportMode = "overwrite";

export type BackupImportOptions = {
  mode?: BackupImportMode;
};

export type BackupImportResult = {
  importedTableCounts: Partial<Record<BackupTableName, number>>;
};
