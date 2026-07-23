export const LOCAL_DATABASE_NAME = "claimproof-sg-local.db";

export const CURRENT_SCHEMA_VERSION = 7;

export const MOBILE_TABLES = [
  "schema_migrations",
  "app_settings",
  "clients",
  "projects",
  "time_entries",
  "photo_evidence",
  "generated_documents",
  "subscription_entitlements",
] as const;

export const SCHEMA_MIGRATIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export const PHASE_2_MOBILE_SCHEMA_SQL = `
${SCHEMA_MIGRATIONS_TABLE_SQL}

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  daily_hours REAL NOT NULL,
  weekly_hours REAL NOT NULL,
  overtime_multiplier REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  lock_hash TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  lock_hash TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  hourly_rate_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'SGD',
  status TEXT NOT NULL DEFAULT 'draft',
  lock_hash TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, user_id),
  FOREIGN KEY (client_id, user_id) REFERENCES clients(id, user_id)
);

CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  work_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  duration_minutes INTEGER NOT NULL,
  activity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  lock_hash TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, user_id),
  UNIQUE (id, project_id, user_id),
  FOREIGN KEY (project_id, user_id) REFERENCES projects(id, user_id)
);

CREATE TABLE IF NOT EXISTS photo_evidence (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  time_entry_id TEXT,
  local_uri TEXT NOT NULL,
  caption TEXT,
  captured_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  lock_hash TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, user_id),
  FOREIGN KEY (project_id, user_id) REFERENCES projects(id, user_id),
  FOREIGN KEY (time_entry_id, project_id, user_id) REFERENCES time_entries(id, project_id, user_id)
);

CREATE TABLE IF NOT EXISTS generated_documents (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  project_id TEXT,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  local_uri TEXT,
  period_start TEXT,
  period_end TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  lock_hash TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, user_id),
  FOREIGN KEY (project_id, user_id) REFERENCES projects(id, user_id)
);

CREATE TABLE IF NOT EXISTS subscription_entitlements (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'placeholder',
  starts_at TEXT,
  ends_at TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  lock_hash TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_app_settings_user_id ON app_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_evidence_user_id ON photo_evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_user_id ON generated_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_entitlements_user_id ON subscription_entitlements(user_id);
`;

export const PHOTO_EVIDENCE_PHASE_5_MIGRATION_SQL = `
ALTER TABLE photo_evidence ADD COLUMN evidence_type TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE photo_evidence ADD COLUMN gps_latitude REAL;
ALTER TABLE photo_evidence ADD COLUMN gps_longitude REAL;
ALTER TABLE photo_evidence ADD COLUMN gps_message TEXT;
CREATE INDEX IF NOT EXISTS idx_photo_evidence_project_id ON photo_evidence(project_id);
`;

export const GENERATED_DOCUMENTS_PHASE_6_MIGRATION_SQL = `
ALTER TABLE generated_documents ADD COLUMN file_hash TEXT;
ALTER TABLE generated_documents ADD COLUMN metadata_json TEXT;
ALTER TABLE generated_documents ADD COLUMN snapshot_json TEXT;
CREATE INDEX IF NOT EXISTS idx_generated_documents_project_id ON generated_documents(project_id);
`;

export const TIME_ENTRY_CLOCK_PHASE_7_MIGRATION_SQL = `
ALTER TABLE time_entries ADD COLUMN break_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN location_text TEXT;
ALTER TABLE time_entries ADD COLUMN clock_in_gps_latitude REAL;
ALTER TABLE time_entries ADD COLUMN clock_in_gps_longitude REAL;
ALTER TABLE time_entries ADD COLUMN clock_out_gps_latitude REAL;
ALTER TABLE time_entries ADD COLUMN clock_out_gps_longitude REAL;
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
`;

export const NORMAL_WORK_HOURS_PHASE_8_MIGRATION_SQL = `
ALTER TABLE app_settings ADD COLUMN normal_work_start_time TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE app_settings ADD COLUMN normal_work_end_time TEXT NOT NULL DEFAULT '17:00';
`;

export const SPECIAL_DAY_RATES_PHASE_9_MIGRATION_SQL = `
ALTER TABLE app_settings ADD COLUMN off_day_multiplier REAL NOT NULL DEFAULT 2;
ALTER TABLE app_settings ADD COLUMN holiday_multiplier REAL NOT NULL DEFAULT 2;
ALTER TABLE time_entries ADD COLUMN day_type TEXT NOT NULL DEFAULT 'normal';
`;

export const RATE_ENTRY_SETTINGS_PHASE_10_MIGRATION_SQL = `
ALTER TABLE app_settings ADD COLUMN rate_basis TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE app_settings ADD COLUMN base_rate_cents INTEGER NOT NULL DEFAULT 0;
`;

export const MOBILE_SCHEMA_SQL = PHASE_2_MOBILE_SCHEMA_SQL.replace(
  "  end_time TEXT,\n  duration_minutes INTEGER NOT NULL,",
  "  end_time TEXT,\n  break_minutes INTEGER NOT NULL DEFAULT 0,\n  location_text TEXT,\n  clock_in_gps_latitude REAL,\n  clock_in_gps_longitude REAL,\n  clock_out_gps_latitude REAL,\n  clock_out_gps_longitude REAL,\n  duration_minutes INTEGER NOT NULL,",
).replace(
  "  activity TEXT NOT NULL,\n  status TEXT NOT NULL DEFAULT 'draft',",
  "  activity TEXT NOT NULL,\n  day_type TEXT NOT NULL DEFAULT 'normal',\n  status TEXT NOT NULL DEFAULT 'draft',",
).replace(
  "  overtime_multiplier REAL NOT NULL,\n  status TEXT NOT NULL DEFAULT 'active',",
  "  overtime_multiplier REAL NOT NULL,\n  rate_basis TEXT NOT NULL DEFAULT 'daily',\n  base_rate_cents INTEGER NOT NULL DEFAULT 0,\n  normal_work_start_time TEXT NOT NULL DEFAULT '08:00',\n  normal_work_end_time TEXT NOT NULL DEFAULT '17:00',\n  off_day_multiplier REAL NOT NULL DEFAULT 2,\n  holiday_multiplier REAL NOT NULL DEFAULT 2,\n  status TEXT NOT NULL DEFAULT 'active',",
).replace(
  "  caption TEXT,\n  captured_at TEXT,",
  "  caption TEXT,\n  evidence_type TEXT NOT NULL DEFAULT 'OTHER',\n  captured_at TEXT,\n  gps_latitude REAL,\n  gps_longitude REAL,\n  gps_message TEXT,",
).replace(
  "  local_uri TEXT,\n  period_start TEXT,",
  "  local_uri TEXT,\n  file_hash TEXT,\n  metadata_json TEXT,\n  snapshot_json TEXT,\n  period_start TEXT,",
).replace(
  "CREATE INDEX IF NOT EXISTS idx_photo_evidence_user_id ON photo_evidence(user_id);",
  "CREATE INDEX IF NOT EXISTS idx_photo_evidence_user_id ON photo_evidence(user_id);\nCREATE INDEX IF NOT EXISTS idx_photo_evidence_project_id ON photo_evidence(project_id);",
).replace(
  "CREATE INDEX IF NOT EXISTS idx_generated_documents_user_id ON generated_documents(user_id);",
  "CREATE INDEX IF NOT EXISTS idx_generated_documents_user_id ON generated_documents(user_id);\nCREATE INDEX IF NOT EXISTS idx_generated_documents_project_id ON generated_documents(project_id);",
);

export const REPOSITORY_HEALTH_SQL = {
  settingsCount: "SELECT COUNT(*) AS count FROM app_settings",
  generatedDocumentsCount: "SELECT COUNT(*) AS count FROM generated_documents",
} as const;

export const LOCAL_MIGRATIONS = [
  {
    version: 1,
    name: "phase_2_local_storage",
    sql: PHASE_2_MOBILE_SCHEMA_SQL,
  },
  {
    version: 2,
    name: "phase_5_photo_evidence_storage",
    sql: PHOTO_EVIDENCE_PHASE_5_MIGRATION_SQL,
  },
  {
    version: 3,
    name: "phase_6_generated_document_archive",
    sql: GENERATED_DOCUMENTS_PHASE_6_MIGRATION_SQL,
  },
  {
    version: 4,
    name: "phase_7_persistent_clock_evidence",
    sql: TIME_ENTRY_CLOCK_PHASE_7_MIGRATION_SQL,
  },
  {
    version: 5,
    name: "phase_8_normal_work_hours",
    sql: NORMAL_WORK_HOURS_PHASE_8_MIGRATION_SQL,
  },
  {
    version: 6,
    name: "phase_9_special_day_rates",
    sql: SPECIAL_DAY_RATES_PHASE_9_MIGRATION_SQL,
  },
  {
    version: 7,
    name: "phase_10_rate_entry_settings",
    sql: RATE_ENTRY_SETTINGS_PHASE_10_MIGRATION_SQL,
  },
] as const;
