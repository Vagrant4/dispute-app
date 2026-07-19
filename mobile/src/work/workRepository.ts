import { calculateTotalHours } from "@claimproof/shared";

import type { LocalDatabase } from "../db/localDatabase";
import { DEFAULT_USER_ID } from "../db/settingsValidation";

export type WorkProject = {
  id: string;
  clientId: string;
  name: string;
  clientName: string;
  description: string | null;
  hourlyRateCents: number;
  currency: string;
  status: string;
};

export type WorkClient = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  status: string;
};

export type WorkEntry = {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  workDate: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  durationMinutes: number;
  activity: string;
  dayType: WorkDayType;
  locationText: string | null;
  clockInGpsLatitude: number | null;
  clockInGpsLongitude: number | null;
  clockOutGpsLatitude: number | null;
  clockOutGpsLongitude: number | null;
  status: "draft" | "finalized" | "locked";
};

export type WorkDayType = "normal" | "off_day" | "holiday";

export type WorkHomeState = {
  project: WorkProject | null;
  activeEntry: WorkEntry | null;
  recentEntries: WorkEntry[];
  totalMinutesToday: number;
};

export type ClockInParams = {
  userId?: string;
  projectId?: string;
  clockInAt?: Date;
  dayType?: WorkDayType;
  locationText?: string;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
};

export type ClockOutParams = {
  userId?: string;
  entryId: string;
  clockOutAt?: Date;
  breakMinutes?: number;
  activity?: string;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
};

export type CreateClientParams = {
  userId?: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
};

export type CreateProjectParams = {
  userId?: string;
  clientId: string;
  name: string;
  description?: string;
  hourlyRateCents?: number;
  currency?: string;
};

export type UpdateProjectParams = {
  userId?: string;
  projectId: string;
  name: string;
  description?: string | null;
};

export type CreateManualEntryParams = {
  userId?: string;
  projectId: string;
  clockInAt: Date;
  clockOutAt: Date;
  breakMinutes?: number;
  activity: string;
  dayType?: WorkDayType;
  locationText?: string;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
};

export type DeleteEntryParams = {
  userId?: string;
  entryId: string;
};

type EntryRow = {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number | null;
  duration_minutes: number;
  activity: string;
  day_type: WorkDayType | null;
  location_text: string | null;
  clock_in_gps_latitude: number | null;
  clock_in_gps_longitude: number | null;
  clock_out_gps_latitude: number | null;
  clock_out_gps_longitude: number | null;
  status: WorkEntry["status"];
};

type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  hourly_rate_cents: number | null;
  currency: string;
  client_name: string;
  status: string;
};

type ClientRow = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  status: string;
};

const DEFAULT_CLIENT_ID = "client:default";
const DEFAULT_PROJECT_ID = "project:steel-bracket-installation";

export class WorkRepository {
  constructor(private readonly database: LocalDatabase) {}

  async getHomeState(userId = DEFAULT_USER_ID): Promise<WorkHomeState> {
    await this.removeBuiltInDemoData(userId);
    const project = await this.getActiveProject(userId);
    const rows = await this.database.getAllAsync<EntryRow>(
      `${baseEntrySelect()}
      WHERE time_entries.user_id = ?
      ORDER BY time_entries.created_at DESC, time_entries.id DESC
      LIMIT 10`,
      [userId],
    );
    const entries = rows.map(mapEntryRow);
    const today = dateOnly(new Date());

    return {
      project,
      activeEntry:
        entries.find((entry) => entry.status === "draft" && !entry.endTime) ??
        null,
      recentEntries: entries,
      totalMinutesToday: entries
        .filter((entry) => entry.workDate === today)
        .reduce((sum, entry) => sum + entry.durationMinutes, 0),
    };
  }

  async clockIn(params: ClockInParams = {}): Promise<WorkEntry> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    await this.removeBuiltInDemoData(userId);
    const project = params.projectId
      ? await this.getProjectOrThrow(userId, params.projectId)
      : await this.getActiveProject(userId);
    if (!project) {
      throw new Error("Create a project before Time In.");
    }
    const clockInAt = params.clockInAt ?? new Date();
    const id = createLocalId("time");

    await this.database.runAsync(
      `
INSERT INTO time_entries (
  id,
  user_id,
  project_id,
  work_date,
  start_time,
  end_time,
  break_minutes,
  location_text,
  clock_in_gps_latitude,
  clock_in_gps_longitude,
  duration_minutes,
  activity,
  day_type,
  status
) VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, 0, ?, ?, 'draft')
`,
      [
        id,
        userId,
        project.id,
        dateOnly(clockInAt),
        clockInAt.toISOString(),
        normalizeOptionalText(params.locationText),
        params.gpsLatitude ?? null,
        params.gpsLongitude ?? null,
        "Clocked in on site.",
        normalizeDayType(params.dayType),
      ],
    );

    return this.getEntryOrThrow(userId, id);
  }

  async clockOut(params: ClockOutParams): Promise<WorkEntry> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    const existing = await this.getEntryOrThrow(userId, params.entryId);
    if (!existing.startTime) {
      throw new Error("Cannot clock out a time entry without clock-in time.");
    }
    if (existing.endTime) {
      return existing;
    }

    const clockOutAt = params.clockOutAt ?? new Date();
    const breakMinutes = Math.max(0, Math.floor(params.breakMinutes ?? 0));
    const totalHours = calculateTotalHours(
      new Date(existing.startTime),
      clockOutAt,
      breakMinutes,
    );
    const durationMinutes = Math.round(totalHours * 60);
    const activity =
      normalizeOptionalText(params.activity) ??
      `Worked at ${existing.locationText || existing.projectName}.`;

    await this.database.runAsync(
      `
UPDATE time_entries
SET end_time = ?,
    break_minutes = ?,
    clock_out_gps_latitude = ?,
    clock_out_gps_longitude = ?,
    duration_minutes = ?,
    activity = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ? AND end_time IS NULL
`,
      [
        clockOutAt.toISOString(),
        breakMinutes,
        params.gpsLatitude ?? null,
        params.gpsLongitude ?? null,
        durationMinutes,
        activity,
        params.entryId,
        userId,
      ],
    );

    return this.getEntryOrThrow(userId, params.entryId);
  }

  async createManualEntry(params: CreateManualEntryParams): Promise<WorkEntry> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    await this.getProjectOrThrow(userId, params.projectId);
    const breakMinutes = Math.max(0, Math.floor(params.breakMinutes ?? 0));
    const durationMinutes = Math.round(
      calculateTotalHours(params.clockInAt, params.clockOutAt, breakMinutes) * 60,
    );
    const id = createLocalId("time");

    await this.database.runAsync(
      `
INSERT INTO time_entries (
  id, user_id, project_id, work_date, start_time, end_time,
  break_minutes, location_text,
  clock_in_gps_latitude, clock_in_gps_longitude,
  clock_out_gps_latitude, clock_out_gps_longitude,
  duration_minutes, activity, day_type, status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'finalized')
`,
      [
        id,
        userId,
        params.projectId,
        dateOnly(params.clockInAt),
        params.clockInAt.toISOString(),
        params.clockOutAt.toISOString(),
        breakMinutes,
        normalizeOptionalText(params.locationText),
        params.gpsLatitude ?? null,
        params.gpsLongitude ?? null,
        durationMinutes,
        requireText(params.activity, "Work description"),
        normalizeDayType(params.dayType),
      ],
    );

    return this.getEntryOrThrow(userId, id);
  }

  async deleteEntry(params: DeleteEntryParams): Promise<void> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    const existing = await this.getEntryOrThrow(userId, params.entryId);

    await this.database.runAsync(
      `
UPDATE photo_evidence
SET time_entry_id = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = ? AND project_id = ? AND time_entry_id = ?
`,
      [userId, existing.projectId, params.entryId],
    );

    await this.database.runAsync(
      `DELETE FROM time_entries WHERE id = ? AND user_id = ?`,
      [params.entryId, userId],
    );
  }

  async listClients(userId = DEFAULT_USER_ID): Promise<WorkClient[]> {
    await this.removeBuiltInDemoData(userId);
    const rows = await this.database.getAllAsync<ClientRow>(
      `
SELECT id, name, contact_name, contact_email, status
FROM clients
WHERE user_id = ?
ORDER BY updated_at DESC, name ASC
`,
      [userId],
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      status: row.status,
    }));
  }

  async listProjects(userId = DEFAULT_USER_ID): Promise<WorkProject[]> {
    await this.removeBuiltInDemoData(userId);
    const rows = await this.database.getAllAsync<ProjectRow>(
      `
SELECT projects.id,
       projects.client_id,
       projects.name,
       projects.description,
       projects.hourly_rate_cents,
       projects.currency,
       projects.status,
       clients.name AS client_name
FROM projects
JOIN clients ON clients.id = projects.client_id AND clients.user_id = projects.user_id
WHERE projects.user_id = ?
ORDER BY projects.updated_at DESC, projects.name ASC
`,
      [userId],
    );

    return rows.map(mapProjectRow);
  }

  async createClient(params: CreateClientParams): Promise<WorkClient> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    const name = requireText(params.name, "Client name");
    const id = createLocalId("client");

    await this.database.runAsync(
      `
INSERT INTO clients (
  id,
  user_id,
  name,
  contact_name,
  contact_email,
  status
) VALUES (?, ?, ?, ?, ?, 'active')
`,
      [
        id,
        userId,
        name,
        normalizeOptionalText(params.contactName),
        normalizeOptionalText(params.contactEmail),
      ],
    );

    return {
      id,
      name,
      contactName: normalizeOptionalText(params.contactName),
      contactEmail: normalizeOptionalText(params.contactEmail),
      status: "active",
    };
  }

  async createProject(params: CreateProjectParams): Promise<WorkProject> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    const name = requireText(params.name, "Project name");
    const id = createLocalId("project");
    const currency = normalizeCurrency(params.currency);

    await this.database.runAsync(
      `
INSERT INTO projects (
  id,
  user_id,
  client_id,
  name,
  description,
  hourly_rate_cents,
  currency,
  status
) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
`,
      [
        id,
        userId,
        params.clientId,
        name,
        normalizeOptionalText(params.description),
        Math.max(0, Math.floor(params.hourlyRateCents ?? 0)),
        currency,
      ],
    );

    const row = await this.database.getFirstAsync<ProjectRow>(
      `
SELECT projects.id,
       projects.client_id,
       projects.name,
       projects.description,
       projects.hourly_rate_cents,
       projects.currency,
       projects.status,
       clients.name AS client_name
FROM projects
JOIN clients ON clients.id = projects.client_id AND clients.user_id = projects.user_id
WHERE projects.id = ? AND projects.user_id = ?
LIMIT 1
`,
      [id, userId],
    );

    if (!row) {
      throw new Error("Project could not be created on this device.");
    }

    return mapProjectRow(row);
  }

  async updateProject(params: UpdateProjectParams): Promise<WorkProject> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    const name = requireText(params.name, "Project name");

    await this.database.runAsync(
      `
UPDATE projects
SET name = ?,
    description = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND user_id = ?
`,
      [
        name,
        normalizeOptionalText(params.description),
        params.projectId,
        userId,
      ],
    );

    return this.getProjectOrThrow(userId, params.projectId);
  }

  private async getActiveProject(userId: string): Promise<WorkProject | null> {
    const project = await this.database.getFirstAsync<ProjectRow>(
      `
SELECT projects.id,
       projects.client_id,
       projects.name,
       projects.description,
       projects.hourly_rate_cents,
       projects.currency,
       projects.status,
       clients.name AS client_name
FROM projects
JOIN clients ON clients.id = projects.client_id AND clients.user_id = projects.user_id
WHERE projects.user_id = ? AND projects.status = 'active'
ORDER BY projects.updated_at DESC, projects.created_at DESC, projects.id DESC
LIMIT 1
`,
      [userId],
    );

    return project ? mapProjectRow(project) : null;
  }

  private async removeBuiltInDemoData(userId: string): Promise<void> {
    await this.database.runAsync(
      `DELETE FROM generated_documents WHERE user_id = ? AND project_id = ?`,
      [userId, DEFAULT_PROJECT_ID],
    );
    await this.database.runAsync(
      `DELETE FROM photo_evidence WHERE user_id = ? AND project_id = ?`,
      [userId, DEFAULT_PROJECT_ID],
    );
    await this.database.runAsync(
      `DELETE FROM time_entries WHERE user_id = ? AND project_id = ?`,
      [userId, DEFAULT_PROJECT_ID],
    );
    await this.database.runAsync(
      `DELETE FROM projects WHERE user_id = ? AND id = ?`,
      [userId, DEFAULT_PROJECT_ID],
    );
    await this.database.runAsync(
      `DELETE FROM clients WHERE user_id = ? AND id = ?`,
      [userId, DEFAULT_CLIENT_ID],
    );
  }

  private async getProjectOrThrow(
    userId: string,
    projectId: string,
  ): Promise<WorkProject> {
    const row = await this.database.getFirstAsync<ProjectRow>(
      `
SELECT projects.id,
       projects.client_id,
       projects.name,
       projects.description,
       projects.hourly_rate_cents,
       projects.currency,
       projects.status,
       clients.name AS client_name
FROM projects
JOIN clients ON clients.id = projects.client_id AND clients.user_id = projects.user_id
WHERE projects.id = ? AND projects.user_id = ?
LIMIT 1
`,
      [projectId, userId],
    );
    if (!row) {
      throw new Error("Selected project was not found on this device.");
    }
    return mapProjectRow(row);
  }

  private async getEntryOrThrow(
    userId: string,
    entryId: string,
  ): Promise<WorkEntry> {
    const row = await this.database.getFirstAsync<EntryRow>(
      `${baseEntrySelect()}
      WHERE time_entries.id = ? AND time_entries.user_id = ?
      LIMIT 1`,
      [entryId, userId],
    );

    if (!row) {
      throw new Error("Time entry not found on this device.");
    }

    return mapEntryRow(row);
  }
}

function baseEntrySelect(): string {
  return `
SELECT time_entries.id,
       time_entries.project_id,
       projects.name AS project_name,
       clients.name AS client_name,
       time_entries.work_date,
       time_entries.start_time,
       time_entries.end_time,
       time_entries.break_minutes,
       time_entries.duration_minutes,
       time_entries.activity,
       time_entries.day_type,
       time_entries.location_text,
       time_entries.clock_in_gps_latitude,
       time_entries.clock_in_gps_longitude,
       time_entries.clock_out_gps_latitude,
       time_entries.clock_out_gps_longitude,
       time_entries.status
FROM time_entries
JOIN projects ON projects.id = time_entries.project_id AND projects.user_id = time_entries.user_id
JOIN clients ON clients.id = projects.client_id AND clients.user_id = projects.user_id`;
}

function mapEntryRow(row: EntryRow): WorkEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    clientName: row.client_name,
    workDate: row.work_date,
    startTime: row.start_time,
    endTime: row.end_time,
    breakMinutes: row.break_minutes ?? 0,
    durationMinutes: row.duration_minutes,
    activity: row.activity,
    dayType: normalizeDayType(row.day_type),
    locationText: row.location_text,
    clockInGpsLatitude: row.clock_in_gps_latitude,
    clockInGpsLongitude: row.clock_in_gps_longitude,
    clockOutGpsLatitude: row.clock_out_gps_latitude,
    clockOutGpsLongitude: row.clock_out_gps_longitude,
    status: row.status,
  };
}

function mapProjectRow(row: ProjectRow): WorkProject {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    clientName: row.client_name,
    description: row.description,
    hourlyRateCents: row.hourly_rate_cents ?? 0,
    currency: row.currency,
    status: row.status,
  };
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeCurrency(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase() || "SGD";
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "SGD";
}

function normalizeDayType(value: WorkDayType | string | null | undefined): WorkDayType {
  return value === "off_day" || value === "holiday" ? value : "normal";
}

function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

function createLocalId(prefix: string): string {
  return `${prefix}:${Date.now().toString(36)}:${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
