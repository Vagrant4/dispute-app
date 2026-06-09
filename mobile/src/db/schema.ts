export const LOCAL_DATABASE_NAME = "claimproof-sg-local.db";

export const CURRENT_SCHEMA_VERSION = 2;

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

export const MOBILE_SCHEMA_SQL = PHASE_2_MOBILE_SCHEMA_SQL.replace(
  "  caption TEXT,\n  captured_at TEXT,",
  "  caption TEXT,\n  evidence_type TEXT NOT NULL DEFAULT 'OTHER',\n  captured_at TEXT,\n  gps_latitude REAL,\n  gps_longitude REAL,\n  gps_message TEXT,",
).replace(
  "CREATE INDEX IF NOT EXISTS idx_photo_evidence_user_id ON photo_evidence(user_id);",
  "CREATE INDEX IF NOT EXISTS idx_photo_evidence_user_id ON photo_evidence(user_id);\nCREATE INDEX IF NOT EXISTS idx_photo_evidence_project_id ON photo_evidence(project_id);",
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
    version: CURRENT_SCHEMA_VERSION,
    name: "phase_5_photo_evidence_storage",
    sql: PHOTO_EVIDENCE_PHASE_5_MIGRATION_SQL,
  },
] as const;
