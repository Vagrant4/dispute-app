import type { LocationSource } from "../work/locationEvidence";
import type { LocalDatabase } from "../db/localDatabase";
import {
  PAY_REPORT_HOURLY_RATE_ERROR,
  PAY_REPORT_PROJECT_REQUIRED_ERROR,
} from "../work/projectRates";
import { ownRateToHourlyCents } from "../work/ownRateConversion";
import { buildProgressClaimSnapshot } from "./progressClaimSnapshot";
import type {
  PhotoEvidenceSnapshotInput,
  ProgressClaimSnapshot,
  ProgressClaimSnapshotInput,
  TimeEntrySnapshotInput,
} from "./progressClaimTypes";
import { buildTaskSegments, type BreakInterval, type TaskSwitch } from "../work/shiftTimeline";

type SettingsRow = {
  report_name?: string | null;
  currency: string;
  rate_basis: "daily" | "monthly" | "hourly" | null;
  base_rate_cents: number | null;
  daily_hours: number;
  weekly_hours: number;
  normal_work_start_time: string | null;
  normal_work_end_time: string | null;
  overtime_multiplier: number;
  off_day_multiplier: number | null;
  holiday_multiplier: number | null;
  lunch_minutes: number | null;
  dinner_minutes: number | null;
  dinner_start_time: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  site_address: string | null;
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
  clock_out_location_text: string | null;
  clock_in_location_source: LocationSource;
  clock_out_location_source: LocationSource;
  clock_in_gps_accuracy_m: number | null;
  clock_out_gps_accuracy_m: number | null;
  clock_in_located_at: string | null;
  clock_out_located_at: string | null;
  location_note: string | null;
  location_history_json: string | null;
  break_minutes: number;
  break_intervals_json: string;
  task_switches_json: string;

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
  capture_source: string | null;
  capture_time_source: string | null;
  lock_hash: string | null;
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
      `SELECT report_name, currency, rate_basis, base_rate_cents, daily_hours, weekly_hours, normal_work_start_time, normal_work_end_time, overtime_multiplier, off_day_multiplier, holiday_multiplier, lunch_minutes, dinner_minutes, dinner_start_time
      FROM app_settings
      WHERE user_id = ?`,
      [params.userId],
    );
    const project = params.projectId
      ? await this.database.getFirstAsync<ProjectRow>(
          `SELECT id, name, description, site_address, hourly_rate_cents, currency, client_id
          FROM projects
          WHERE id = ? AND user_id = ?`,
          [params.projectId, params.userId],
        )
      : await this.database.getFirstAsync<ProjectRow>(
          `SELECT id, name, description, site_address, hourly_rate_cents, currency, client_id
          FROM projects
          WHERE user_id = ?
          ORDER BY updated_at DESC
          LIMIT 1`,
          [params.userId],
        );

    if (!project) {
      throw new Error(PAY_REPORT_PROJECT_REQUIRED_ERROR);
    }
    const hourlyRateCents = ownRateToHourlyCents({
      rateBasis: settings?.rate_basis ?? "daily",
      baseRateCents: settings?.base_rate_cents ?? 0,
      dailyHours: settings?.daily_hours ?? 8,
      weeklyHours: settings?.weekly_hours ?? 40,
    });

    const [client, timeEntries, photoEvidence, taskRows, evidenceAudit] = await Promise.all([
      this.database.getFirstAsync<ClientRow>(
        `SELECT name, contact_name, contact_email
        FROM clients
        WHERE id = ? AND user_id = ?`,
        [project.client_id, params.userId],
      ),
      this.database.getAllAsync<TimeEntryRow>(
        `SELECT id, work_date, start_time, end_time, duration_minutes, activity, day_type, location_text, clock_out_location_text, clock_in_location_source, clock_out_location_source, clock_in_gps_accuracy_m, clock_out_gps_accuracy_m, clock_in_located_at, clock_out_located_at, location_note, location_history_json, break_minutes, break_intervals_json, task_switches_json, clock_in_gps_latitude, clock_in_gps_longitude, clock_out_gps_latitude, clock_out_gps_longitude
        FROM time_entries
        WHERE project_id = ? AND user_id = ?
        ORDER BY work_date ASC, id ASC`,
        [project.id, params.userId],
      ),
      this.database.getAllAsync<PhotoEvidenceRow>(
        `SELECT id, time_entry_id, local_uri, caption, evidence_type, captured_at, capture_source, capture_time_source, lock_hash
        FROM photo_evidence
        WHERE project_id = ? AND user_id = ?
        ORDER BY COALESCE(captured_at, created_at) ASC, id ASC`,
        [project.id, params.userId],
      ),
      this.database.getAllAsync<{ id: string; name: string }>("SELECT id, name FROM project_tasks WHERE project_id = ? AND user_id = ?", [project.id, params.userId]),
      this.database.getAllAsync<{ message: string; event_at: string; captured_at: string | null }>("SELECT message, event_at, captured_at FROM evidence_audit WHERE project_id = ? AND user_id = ? ORDER BY event_at", [project.id, params.userId]),
    ]);

    return {
      generatedAt: params.generatedAt,
      claimPeriod: inferClaimPeriod(timeEntries),
      worker: { name: settings?.report_name || "Worker" },
      client: {
        name: client?.name ?? "Client not recorded",
        contactName: client?.contact_name ?? null,
        contactEmail: client?.contact_email ?? null,
      },
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        siteAddress: project.site_address,
        hourlyRateCents,
        currency: project.currency,
      },
      timeEntries: mapTimeEntries(timeEntries, new Map(taskRows.map((task) => [task.id, task.name]))),
      photoEvidence: mapPhotoEvidence(photoEvidence),
      evidenceAudit: evidenceAudit.map((event) => ({ message: event.message, eventAt: event.event_at, capturedAt: event.captured_at })),
      pay: {
        currency: settings?.currency ?? project.currency,
        hourlyRateCents,
        rateBasis: settings?.rate_basis ?? "daily",
        baseRateCents: settings?.base_rate_cents ?? 0,
        dailyNormalMinutes: Math.round((settings?.daily_hours ?? 8) * 60),
        normalWorkStartTime: settings?.normal_work_start_time ?? "08:00",
        normalWorkEndTime: settings?.normal_work_end_time ?? "17:00",
        overtimeMultiplier: settings?.overtime_multiplier ?? 1.5,
        offDayMultiplier: settings?.off_day_multiplier ?? 2,
        holidayMultiplier: settings?.holiday_multiplier ?? 2,
        lunchMinutes: settings?.lunch_minutes ?? 0,
        dinnerMinutes: settings?.dinner_minutes ?? 0,
        dinnerStartTime: settings?.dinner_start_time ?? null,
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

function mapTimeEntries(rows: TimeEntryRow[], taskNames: Map<string, string>): TimeEntrySnapshotInput[] {
  return rows.map((row) => {
    const breaks = parseArray<BreakInterval>(row.break_intervals_json); const switches = parseArray<TaskSwitch>(row.task_switches_json);
    const segments = row.start_time && row.end_time ? buildTaskSegments({ shiftStart: row.start_time, shiftEnd: row.end_time, switches, breaks }) : [];
    return ({
    id: row.id,
    workDate: row.work_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    activity: row.activity,
    dayType: row.day_type,
    locationText: row.location_text,
    clockOutLocationText: row.clock_out_location_text,
    clockInLocationSource: row.clock_in_location_source,
    clockOutLocationSource: row.clock_out_location_source,
    clockInGpsAccuracyM: row.clock_in_gps_accuracy_m,
    clockOutGpsAccuracyM: row.clock_out_gps_accuracy_m,
    clockInLocatedAt: row.clock_in_located_at,
    clockOutLocatedAt: row.clock_out_located_at,
    locationNote: row.location_note,
    locationHistoryJson: row.location_history_json,
    breakMinutes: row.break_minutes,
    breakIntervals: breaks,
    taskSwitches: switches,
    taskSegments: segments.map((segment) => ({ ...segment, taskName: segment.taskId ? taskNames.get(segment.taskId) ?? "Renamed task unavailable" : "Unassigned" })),

    clockInGpsLatitude: row.clock_in_gps_latitude,
    clockInGpsLongitude: row.clock_in_gps_longitude,
    clockOutGpsLatitude: row.clock_out_gps_latitude,
    clockOutGpsLongitude: row.clock_out_gps_longitude,
  }); });
}

function parseArray<T>(value: string | null | undefined): T[] { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }

function mapPhotoEvidence(rows: PhotoEvidenceRow[]): PhotoEvidenceSnapshotInput[] {
  return rows.map((row) => ({
    id: row.id,
    timeEntryId: row.time_entry_id,
    localUri: row.local_uri,
    caption: row.caption,
    evidenceType: row.evidence_type,
    capturedAt: row.captured_at,
    captureSource: row.capture_source,
    captureTimeSource: row.capture_time_source,
    lockHash: row.lock_hash,
  }));
}
