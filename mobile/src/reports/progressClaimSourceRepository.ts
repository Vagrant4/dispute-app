import type { LocalDatabase } from "../db/localDatabase";
import { buildProgressClaimSnapshot } from "./progressClaimSnapshot";
import type {
  PhotoEvidenceSnapshotInput,
  ProgressClaimSnapshot,
  ProgressClaimSnapshotInput,
  TimeEntrySnapshotInput,
} from "./progressClaimTypes";

type SettingsRow = {
  currency: string;
  daily_hours: number;
  normal_work_start_time: string | null;
  normal_work_end_time: string | null;
  overtime_multiplier: number;
  off_day_multiplier: number | null;
  holiday_multiplier: number | null;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  hourly_rate_cents: number | null;
  currency: string;
  client_id: string;
};

type ClientRow = {
  name: string;
  contact_name: string | null;
  contact_email: string | null;
};

type TimeEntryRow = {
  id: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  activity: string;
  day_type: "normal" | "off_day" | "holiday" | null;
  location_text: string | null;
  clock_in_gps_latitude: number | null;
  clock_in_gps_longitude: number | null;
  clock_out_gps_latitude: number | null;
  clock_out_gps_longitude: number | null;
};

type PhotoEvidenceRow = {
  id: string;
  time_entry_id: string | null;
  local_uri: string;
  caption: string | null;
  evidence_type: string | null;
  captured_at: string | null;
};

export class ProgressClaimSourceRepository {
  constructor(private readonly database: LocalDatabase) {}

  async buildLatestProgressClaimSnapshot(params: {
    userId: string;
    projectId?: string;
    generatedAt?: string;
  }): Promise<ProgressClaimSnapshot> {
    const input = await this.getProgressClaimSnapshotInput(params);
    return buildProgressClaimSnapshot(input);
  }

  async getProgressClaimSnapshotInput(params: {
    userId: string;
    projectId?: string;
    generatedAt?: string;
  }): Promise<ProgressClaimSnapshotInput> {
    const settings = await this.database.getFirstAsync<SettingsRow>(
      `SELECT currency, daily_hours, normal_work_start_time, normal_work_end_time, overtime_multiplier, off_day_multiplier, holiday_multiplier
      FROM app_settings
      WHERE user_id = ?`,
      [params.userId],
    );
    const project = params.projectId
      ? await this.database.getFirstAsync<ProjectRow>(
          `SELECT id, name, description, hourly_rate_cents, currency, client_id
          FROM projects
          WHERE id = ? AND user_id = ?`,
          [params.projectId, params.userId],
        )
      : await this.database.getFirstAsync<ProjectRow>(
          `SELECT id, name, description, hourly_rate_cents, currency, client_id
          FROM projects
          WHERE user_id = ?
          ORDER BY updated_at DESC
          LIMIT 1`,
          [params.userId],
        );

    if (!project) {
      return {
        generatedAt: params.generatedAt,
        worker: { name: "Local worker" },
        client: { name: "Client not selected" },
        project: {
          name: "Project not selected",
          currency: settings?.currency ?? "SGD",
          hourlyRateCents: 0,
        },
        pay: {
          currency: settings?.currency ?? "SGD",
          dailyNormalMinutes: Math.round((settings?.daily_hours ?? 8) * 60),
          normalWorkStartTime: settings?.normal_work_start_time ?? "08:00",
          normalWorkEndTime: settings?.normal_work_end_time ?? "17:00",
          overtimeMultiplier: settings?.overtime_multiplier ?? 1.5,
          offDayMultiplier: settings?.off_day_multiplier ?? 2,
          holidayMultiplier: settings?.holiday_multiplier ?? 2,
        },
      };
    }

    const [client, timeEntries, photoEvidence] = await Promise.all([
      this.database.getFirstAsync<ClientRow>(
        `SELECT name, contact_name, contact_email
        FROM clients
        WHERE id = ? AND user_id = ?`,
        [project.client_id, params.userId],
      ),
      this.database.getAllAsync<TimeEntryRow>(
        `SELECT id, work_date, start_time, end_time, duration_minutes, activity, day_type, location_text, clock_in_gps_latitude, clock_in_gps_longitude, clock_out_gps_latitude, clock_out_gps_longitude
        FROM time_entries
        WHERE project_id = ? AND user_id = ?
        ORDER BY work_date ASC, id ASC`,
        [project.id, params.userId],
      ),
      this.database.getAllAsync<PhotoEvidenceRow>(
        `SELECT id, time_entry_id, local_uri, caption, evidence_type, captured_at
        FROM photo_evidence
        WHERE project_id = ? AND user_id = ?
        ORDER BY COALESCE(captured_at, created_at) ASC, id ASC`,
        [project.id, params.userId],
      ),
    ]);

    return {
      generatedAt: params.generatedAt,
      claimPeriod: inferClaimPeriod(timeEntries),
      worker: { name: "Local worker" },
      client: {
        name: client?.name ?? "Client not recorded",
        contactName: client?.contact_name ?? null,
        contactEmail: client?.contact_email ?? null,
      },
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        hourlyRateCents: project.hourly_rate_cents,
        currency: project.currency,
      },
      timeEntries: mapTimeEntries(timeEntries),
      photoEvidence: mapPhotoEvidence(photoEvidence),
      pay: {
        currency: settings?.currency ?? project.currency,
        hourlyRateCents: project.hourly_rate_cents,
        dailyNormalMinutes: Math.round((settings?.daily_hours ?? 8) * 60),
        normalWorkStartTime: settings?.normal_work_start_time ?? "08:00",
        normalWorkEndTime: settings?.normal_work_end_time ?? "17:00",
        overtimeMultiplier: settings?.overtime_multiplier ?? 1.5,
        offDayMultiplier: settings?.off_day_multiplier ?? 2,
        holidayMultiplier: settings?.holiday_multiplier ?? 2,
      },
    };
  }
}

function inferClaimPeriod(timeEntries: TimeEntryRow[]):
  | { start: string; end: string }
  | undefined {
  if (timeEntries.length === 0) {
    return undefined;
  }

  const dates = timeEntries.map((entry) => entry.work_date).sort();
  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
}

function mapTimeEntries(rows: TimeEntryRow[]): TimeEntrySnapshotInput[] {
  return rows.map((row) => ({
    id: row.id,
    workDate: row.work_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    activity: row.activity,
    dayType: row.day_type,
    locationText: row.location_text,
    clockInGpsLatitude: row.clock_in_gps_latitude,
    clockInGpsLongitude: row.clock_in_gps_longitude,
    clockOutGpsLatitude: row.clock_out_gps_latitude,
    clockOutGpsLongitude: row.clock_out_gps_longitude,
  }));
}

function mapPhotoEvidence(rows: PhotoEvidenceRow[]): PhotoEvidenceSnapshotInput[] {
  return rows.map((row) => ({
    id: row.id,
    timeEntryId: row.time_entry_id,
    localUri: row.local_uri,
    caption: row.caption,
    evidenceType: row.evidence_type,
    capturedAt: row.captured_at,
  }));
}
