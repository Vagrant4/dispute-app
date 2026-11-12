import { locationReading, appendLocationHistory, assertRefreshPhase, type LocationParams } from "./locationEvidence";
import { buildProgressClaimSnapshot } from "../reports/progressClaimSnapshot";
import { ownRateToHourlyCents } from "./ownRateConversion";
import type { ProgressClaimSnapshot } from "../reports/progressClaimTypes";
import type {
  ClockInParams,
  ClockOutParams,
  WorkEntry,
  WorkHomeState,
  WorkClient,
  WorkProject,
  ProjectSummary,
  CreateClientParams,
  CreateProjectParams,
  UpdateProjectParams,
  CreateManualEntryParams,
  DeleteEntryParams,
  WorkTask,
} from "./workRepository";
import { buildTaskSegments, closeOpenBreak, summarizeBreaks } from "./shiftTimeline";
import { DEFAULT_USER_ID } from "../db/settingsValidation";
import {
  PAY_REPORT_HOURLY_RATE_ERROR,
  PAY_REPORT_PROJECT_REQUIRED_ERROR,
  requirePositiveProjectHourlyRateCents,
  normalizeProjectHourlyRateCents,
} from "./projectRates";

import { readWebWorkHours } from "./webWorkHours";
import { normalizeProjectStatus } from "./projectDiscovery";

const STORAGE_KEY = "claimproof-sg-web-work-state";

type WebWorkState = {
  clients: WorkClient[];
  projects: WorkProject[];
  project: WorkProject | null;
  entries: WorkEntry[];
  tasks: WorkTask[];
};

export const webWorkStore = {
  async getHomeState(userId = DEFAULT_USER_ID): Promise<WorkHomeState> {
    return toHomeState(readState(userId));
  },

  async completeStartLocation(params: LocationParams & { userId: string; entryId: string }): Promise<boolean> {
    const state = readState(params.userId);
    const entry = state.entries.find((item) => item.id === params.entryId);
    if (!entry || entry.endTime || entry.clockInLocationSource !== "none") return false;
    const reading = locationReading(params, "start");
    Object.assign(entry, { locationText: reading.address, clockInLocationSource: reading.source, clockInGpsLatitude: reading.latitude, clockInGpsLongitude: reading.longitude, clockInGpsAccuracyM: reading.accuracy, clockInLocatedAt: reading.locatedAt });
    writeState(state, params.userId);
    return true;
  },

  async refreshLocation(params: LocationParams & { userId: string; entryId: string; phase: "start" | "stop" }): Promise<void> {
    const state = readState(params.userId);
    const entry = state.entries.find((item) => item.id === params.entryId);
    if (!entry) throw new Error("Time entry not found.");
    assertRefreshPhase(entry, params.phase);
    entry.locationHistoryJson = appendLocationHistory(entry.locationHistoryJson, locationReading(params, params.phase));
    writeState(state, params.userId);
  },

  async saveLocationNote(params: { userId: string; entryId: string; note: string }): Promise<void> {
    const state = readState(params.userId);
    const entry = state.entries.find((item) => item.id === params.entryId);
    if (!entry) throw new Error("Time entry not found.");
    entry.locationNote = params.note.trim() || null;
    writeState(state, params.userId);
  },
  async listTasks(userId: string, projectId: string): Promise<WorkTask[]> { return readState(userId).tasks.filter((task) => task.projectId === projectId); },
  async addTask(params: { userId: string; projectId: string; name: string }): Promise<WorkTask> { const state = readState(params.userId); const task = { id: createLocalId("web-task"), projectId: params.projectId, name: requireText(params.name, "Task name") }; state.tasks.push(task); writeState(state, params.userId); return task; },
  async renameTask(params: { userId: string; taskId: string; name: string }): Promise<void> { const state = readState(params.userId); const task = state.tasks.find((item) => item.id === params.taskId); if (!task) throw new Error("Task not found."); task.name = requireText(params.name, "Task name"); writeState(state, params.userId); },
  async startBreak(params: { userId: string; entryId: string; at?: Date }): Promise<WorkEntry> { const state = readState(params.userId); const entry = state.entries.find((item) => item.id === params.entryId); if (!entry) throw new Error("Time entry not found."); if (!entry.breakIntervals.some((item) => !item.endedAt)) entry.breakIntervals.push({ startedAt: (params.at ?? new Date()).toISOString(), endedAt: null }); writeState(state, params.userId); return entry; },
  async endBreak(params: { userId: string; entryId: string; at?: Date }): Promise<WorkEntry> { const state = readState(params.userId); const entry = state.entries.find((item) => item.id === params.entryId); if (!entry) throw new Error("Time entry not found."); entry.breakIntervals = closeOpenBreak(entry.breakIntervals, params.at ?? new Date()); entry.breakMinutes = summarizeBreaks(entry.breakIntervals).minutes; writeState(state, params.userId); return entry; },
  async switchTask(params: { userId: string; entryId: string; taskId: string; at?: Date }): Promise<WorkEntry> { const state = readState(params.userId); const entry = state.entries.find((item) => item.id === params.entryId); if (!entry || !state.tasks.some((task) => task.id === params.taskId && task.projectId === entry.projectId)) throw new Error("Task not found."); entry.currentTaskId = params.taskId; entry.taskSwitches.push({ taskId: params.taskId, at: (params.at ?? new Date()).toISOString() }); writeState(state, params.userId); return entry; },

  async listClients(userId = DEFAULT_USER_ID): Promise<WorkClient[]> {
    return readState(userId).clients;
  },

  async listProjects(userId = DEFAULT_USER_ID): Promise<WorkProject[]> {
    return readState(userId).projects;
  },

  async listProjectSummaries(userId: string, weekStart: string): Promise<ProjectSummary[]> {
    const state = readState(userId);
    const end = new Date(`${weekStart}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 7);
    const photos = JSON.parse(globalThis.localStorage?.getItem(`dispute-web-saved-photo-evidence:${encodeURIComponent(userId)}`) || "[]") as Array<{ project_id: string; local_uri?: string }>;
    return state.projects.map((project) => {
      const entries = state.entries.filter((entry) => entry.projectId === project.id).sort((a, b) => (b.startTime || "").localeCompare(a.startTime || ""));
      const last = entries[0];
      const stopFix = last?.clockOutGpsLatitude != null && last?.clockOutGpsLongitude != null;
      const startFix = last?.clockInGpsLatitude != null && last?.clockInGpsLongitude != null;
      return { id: project.id, name: project.name, status: project.status,
        projectStatus: normalizeProjectStatus(project.projectStatus), groupId: project.groupId ?? null,
        siteAddress: project.siteAddress ?? null, siteLatitude: project.siteLatitude ?? null, siteLongitude: project.siteLongitude ?? null,
        latestPhotoUri: photos.find((photo) => photo.project_id === project.id)?.local_uri ?? null,
        lastSiteAddress: stopFix ? last.clockOutLocationText ?? null : startFix ? last.locationText : null,
        lastSiteLatitude: stopFix ? last.clockOutGpsLatitude : startFix ? last.clockInGpsLatitude : null,
        lastSiteLongitude: stopFix ? last.clockOutGpsLongitude : startFix ? last.clockInGpsLongitude : null,
        lastSiteAccuracyM: (stopFix ? last.clockOutGpsAccuracyM : startFix ? last.clockInGpsAccuracyM : null) ?? null,
        lastWorkedAt: last?.startTime ?? null,
        minutesThisWeek: entries.filter((entry) => entry.workDate >= weekStart && entry.workDate < end.toISOString().slice(0, 10)).reduce((sum, entry) => sum + entry.durationMinutes, 0),
        photoCount: photos.filter((photo) => photo.project_id === project.id).length,
        isActive: entries.some((entry) => entry.status === "draft" && !entry.endTime) };
    }).sort((a, b) => (b.lastWorkedAt || "").localeCompare(a.lastWorkedAt || "") || a.name.localeCompare(b.name));
  },

  async listProjectEntries(userId: string, projectId: string): Promise<WorkEntry[]> {
    return readState(userId).entries.filter((entry) => entry.projectId === projectId).sort((a, b) => (b.startTime || "").localeCompare(a.startTime || ""));
  },

  async setProjectStatus(userId: string, projectId: string, status: "active" | "archived"): Promise<void> {
    const state = readState(userId);
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) throw new Error("Project not found.");
    if (status === "archived" && state.entries.some((entry) => entry.projectId === projectId && entry.status === "draft" && !entry.endTime)) throw new Error("Stop work before finishing this project.");
    project.status = status;
    writeState(state, userId);
  },

  async createClient(params: CreateClientParams): Promise<WorkClient> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    const state = readState(userId);
    const client: WorkClient = {
      id: createLocalId("web-client"),
      name: requireText(params.name, "Client name"),
      contactName: normalizeOptionalText(params.contactName),
      contactEmail: normalizeOptionalText(params.contactEmail),
      status: "active",
    };
    writeState({
      ...state,
      clients: [client, ...state.clients],
    }, userId);
    return client;
  },

  async createProject(params: CreateProjectParams): Promise<WorkProject> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    const state = readState(userId);
    const client =
      state.clients.find((item) => item.id === params.clientId) ??
      state.clients[0];
    if (!client) {
      throw new Error("Create a client before adding a project.");
    }
    const hourlyRateCents = normalizeProjectHourlyRateCents(
      params.hourlyRateCents,
    );

    const project: WorkProject = {
      id: createLocalId("web-project"),
      clientId: client.id,
      name: requireText(params.name, "Project name"),
      clientName: client.name,
      description: normalizeOptionalText(params.description),
      hourlyRateCents,
      currency: normalizeCurrency(params.currency),
      status: "active",
      projectStatus: "active",
      groupId: null,
      siteAddress: normalizeOptionalText(params.siteAddress),
      siteLatitude: params.siteLatitude ?? null,
      siteLongitude: params.siteLongitude ?? null,
    };
    writeState({
      ...state,
      project,
      projects: [project, ...state.projects],
    }, userId);
    return project;
  },

  async updateProject(params: UpdateProjectParams): Promise<WorkProject> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    const state = readState(userId);
    const existingProject = state.projects.find(
      (project) => project.id === params.projectId,
    );

    if (!existingProject) {
      throw new Error("Selected project was not found in browser preview storage.");
    }
    const hourlyRateCents = normalizeProjectHourlyRateCents(
      params.hourlyRateCents,
    );

    const savedProject: WorkProject = {
      ...existingProject,
      name: requireText(params.name, "Project name"),
      description: normalizeOptionalText(params.description),
      hourlyRateCents,
    };
    const projects = state.projects.map((project) =>
      project.id === params.projectId ? savedProject : project,
    );

    writeState({
      ...state,
      project:
        state.project?.id === params.projectId ? savedProject : state.project,
      projects,
      entries: state.entries.map((entry) =>
        entry.projectId === params.projectId
          ? { ...entry, projectName: savedProject.name }
          : entry,
      ),
    }, userId);
    return savedProject;
  },

  async clockIn(params: ClockInParams = {}): Promise<WorkEntry> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    const state = readState(userId);
    const clockInAt = params.clockInAt ?? new Date();
    const project =
      state.projects.find((item) => item.id === params.projectId) ?? state.project;
    if (!project) {
      throw new Error("Create a project before Time In.");
    }
    const reading = locationReading(params, "start");
    const entry: WorkEntry = {
      id: createLocalId("web-time"),
      projectId: project.id,
      projectName: project.name,
      clientName: project.clientName,
      workDate: clockInAt.toISOString().slice(0, 10),
      startTime: clockInAt.toISOString(),
      endTime: null,
      breakMinutes: 0,
      durationMinutes: 0,
      activity: "Clocked in on site.",
      dayType: params.dayType ?? "normal",
      locationText: reading.address,
      clockInLocationSource: reading.source,
      clockOutLocationSource: "none",
      clockInGpsAccuracyM: reading.accuracy,
      clockInLocatedAt: reading.locatedAt,
      locationNote: params.locationNote?.trim() || null,
      locationHistoryJson: "[]",
      breakIntervals: [],
      taskSwitches: [{ taskId: params.taskId ?? null, at: clockInAt.toISOString() }],
      currentTaskId: params.taskId ?? null,
      clockInGpsLatitude: reading.latitude,
      clockInGpsLongitude: reading.longitude,
      clockOutGpsLatitude: null,
      clockOutGpsLongitude: null,
      status: "draft",
    };
    writeState({
      ...state,
      entries: [entry, ...state.entries],
    }, userId);
    return entry;
  },

  async createManualEntry(params: CreateManualEntryParams): Promise<WorkEntry> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    const state = readState(userId);
    const project = state.projects.find((item) => item.id === params.projectId);
    if (!project) {
      throw new Error("Selected project was not found in browser preview storage.");
    }
    const rawMinutes = Math.floor(
      (params.clockOutAt.getTime() - params.clockInAt.getTime()) / 60000,
    );
    const breakMinutes = Math.max(0, Math.floor(params.breakMinutes ?? 0));
    if (rawMinutes <= 0) {
      throw new Error("Clock-out must be after clock-in");
    }
    if (breakMinutes > rawMinutes) {
      throw new Error("Break minutes cannot exceed total duration");
    }
    const entry: WorkEntry = {
      id: createLocalId("web-time"),
      projectId: project.id,
      projectName: project.name,
      clientName: project.clientName,
      workDate: params.clockInAt.toISOString().slice(0, 10),
      startTime: params.clockInAt.toISOString(),
      endTime: params.clockOutAt.toISOString(),
      breakMinutes,
      durationMinutes: rawMinutes - breakMinutes,
      activity: requireText(params.activity, "Work description"),
      dayType: params.dayType ?? "normal",
      locationText: normalizeOptionalText(params.locationText),
      clockInGpsLatitude: params.gpsLatitude ?? null,
      clockInGpsLongitude: params.gpsLongitude ?? null,
      clockOutGpsLatitude: null,
      clockOutGpsLongitude: null,
      status: "finalized",
      breakIntervals: [], taskSwitches: [], currentTaskId: null,
    };
    writeState({ ...state, entries: [entry, ...state.entries] }, userId);
    return entry;
  },

  async deleteEntry(params: DeleteEntryParams): Promise<void> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    const state = readState(userId);
    const entries = state.entries.filter((entry) => entry.id !== params.entryId);
    if (entries.length === state.entries.length) {
      throw new Error("Time entry not found in browser preview storage.");
    }
    writeState({ ...state, entries }, userId);
  },

  async clockOut(params: ClockOutParams): Promise<WorkEntry> {
    const userId = params.userId ?? DEFAULT_USER_ID;
    const state = readState(userId);
    const reading = locationReading(params, "stop");
    const clockOutAt = params.clockOutAt ?? new Date();
    const target = state.entries.find((entry) => entry.id === params.entryId);
    if (target) target.breakIntervals = closeOpenBreak(target.breakIntervals, clockOutAt);
    const breakMinutes = target?.breakIntervals.length ? summarizeBreaks(target.breakIntervals).minutes : Math.max(0, Math.floor(params.breakMinutes ?? 0));
    let updated: WorkEntry | null = null;
    const entries = state.entries.map((entry) => {
      if (entry.id !== params.entryId || entry.endTime || !entry.startTime) {
        return entry;
      }

      const rawMinutes = Math.max(
        0,
        Math.floor(
          (clockOutAt.getTime() - new Date(entry.startTime).getTime()) / 60000,
        ),
      );
      updated = {
        ...entry,
        endTime: clockOutAt.toISOString(),
        breakMinutes,
        durationMinutes: Math.max(0, rawMinutes - breakMinutes),
        activity:
          normalizeOptionalText(params.activity) ??
          `Worked at ${entry.locationText || entry.projectName}.`,
        clockOutLocationText: reading.address,
        clockOutLocationSource: reading.source,
        clockOutGpsAccuracyM: reading.accuracy,
        clockOutLocatedAt: reading.locatedAt,
        clockOutGpsLatitude: reading.latitude,
        clockOutGpsLongitude: reading.longitude,
      };
      return updated;
    });

    if (!updated) {
      throw new Error("Time entry not found in browser preview storage.");
    }

    writeState({ ...state, entries }, userId);
    return updated;
  },
};

export function buildWebWorkProgressClaimSnapshot(params: {
  userId?: string;
  projectId?: string;
} = {}): ProgressClaimSnapshot {
  const state = readState(params.userId ?? DEFAULT_USER_ID);
  const selectedProject =
    (params.projectId
      ? state.projects.find((project) => project.id === params.projectId)
      : state.project) ?? null;
  if (!selectedProject) {
    throw new Error(PAY_REPORT_PROJECT_REQUIRED_ERROR);
  }
  const preferences = readWebWorkHours(params.userId ?? DEFAULT_USER_ID);
  const hourlyRateCents = ownRateToHourlyCents(preferences.settings);
  return buildProgressClaimSnapshot({
    generatedAt: new Date().toISOString(),
    worker: {
      name: preferences.reportName || "Worker",
    },
    client: {
      name: selectedProject.clientName,
      contactName: "Site Supervisor",
      contactEmail: "site@abc-construction.sg",
    },
    project: {
      id: selectedProject.id,
      name: selectedProject.name,
      description: selectedProject.description,
      siteAddress: selectedProject.siteAddress,
      hourlyRateCents,
      currency: selectedProject.currency,
    },
    timeEntries: state.entries
      .filter((entry) => entry.projectId === selectedProject.id && entry.durationMinutes > 0)
      .map((entry) => ({
        id: entry.id,
        workDate: entry.workDate,
        startTime: entry.startTime,
        endTime: entry.endTime,
        durationMinutes: entry.durationMinutes,
        activity: entry.activity,
        dayType: entry.dayType,
        locationText: entry.locationText,
        clockOutLocationText: entry.clockOutLocationText,
        clockInLocationSource: entry.clockInLocationSource,
        clockOutLocationSource: entry.clockOutLocationSource,
        clockInGpsAccuracyM: entry.clockInGpsAccuracyM,
        clockOutGpsAccuracyM: entry.clockOutGpsAccuracyM,
        clockInLocatedAt: entry.clockInLocatedAt,
        clockOutLocatedAt: entry.clockOutLocatedAt,
        locationNote: entry.locationNote,
        locationHistoryJson: entry.locationHistoryJson,
        breakMinutes: entry.breakMinutes,
        breakIntervals: entry.breakIntervals,
        taskSwitches: entry.taskSwitches,
        taskSegments: entry.startTime && entry.endTime ? buildTaskSegments({ shiftStart: entry.startTime, shiftEnd: entry.endTime, switches: entry.taskSwitches, breaks: entry.breakIntervals }).map((segment) => ({ ...segment, taskName: segment.taskId ? state.tasks.find((task) => task.id === segment.taskId)?.name ?? "Renamed task unavailable" : "Unassigned" })) : [],

        clockInGpsLatitude: entry.clockInGpsLatitude,
        clockInGpsLongitude: entry.clockInGpsLongitude,
        clockOutGpsLatitude: entry.clockOutGpsLatitude,
        clockOutGpsLongitude: entry.clockOutGpsLongitude,
      })),
    pay: {
      currency: selectedProject.currency,
      hourlyRateCents,
      dailyNormalMinutes: preferences.settings.dailyHours * 60,
      normalWorkStartTime: preferences.settings.normalWorkStartTime,
      normalWorkEndTime: preferences.settings.normalWorkEndTime,
      overtimeMultiplier: preferences.settings.overtimeMultiplier,
      offDayMultiplier: preferences.settings.offDayMultiplier,
      holidayMultiplier: preferences.settings.holidayMultiplier,
    },
  });
}

function toHomeState(state: WebWorkState): WorkHomeState {
  const today = new Date().toISOString().slice(0, 10);
  const activeEntry =
    state.entries.find((entry) => entry.status === "draft" && !entry.endTime) ??
    null;

  return {
    project: state.project,
    activeEntry,
    recentEntries: state.entries.slice(0, 10),
    totalMinutesToday: state.entries
      .filter((entry) => entry.workDate === today)
      .reduce((sum, entry) => sum + entry.durationMinutes, 0),
  };
}

function readState(userId = DEFAULT_USER_ID): WebWorkState {
  if (typeof localStorage !== "undefined") {
    try {
      const key = getStorageKey(userId);
      const raw = localStorage.getItem(key);
      if (raw) {
        return normalizeState(JSON.parse(raw) as WebWorkState);
      }
    } catch {
      // Fall through to default state.
    }
  }

  return normalizeState({
    clients: [],
    projects: [],
    project: null,
    entries: [],
    tasks: [],
  });
}

function writeState(state: WebWorkState, userId = DEFAULT_USER_ID): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(
      getStorageKey(userId),
      JSON.stringify(normalizeState(state)),
    );
  }
}

export function hasLegacyWebWorkData(): boolean {
  return typeof localStorage !== "undefined" && Boolean(localStorage.getItem(STORAGE_KEY));
}

export function claimLegacyWebWorkData(userId: string): boolean {
  if (typeof localStorage === "undefined" || userId === DEFAULT_USER_ID) {
    return false;
  }
  const key = getStorageKey(userId);
  if (localStorage.getItem(key)) {
    return false;
  }
  const legacy = localStorage.getItem(STORAGE_KEY);
  if (!legacy) {
    return false;
  }
  localStorage.setItem(key, legacy);
  localStorage.removeItem(STORAGE_KEY);
  return true;
}

function getStorageKey(userId: string): string {
  return userId === DEFAULT_USER_ID
    ? STORAGE_KEY
    : `${STORAGE_KEY}:${encodeURIComponent(userId)}`;
}

function normalizeState(state: WebWorkState): WebWorkState {
  const clients = Array.isArray(state.clients)
    ? state.clients.filter((client) => client.id !== "client:default")
    : [];
  const projects = Array.isArray(state.projects)
    ? state.projects.filter(
        (project) => project.id !== "project:steel-bracket-installation",
      ).map((project) => ({ ...project, projectStatus: normalizeProjectStatus(project.projectStatus) }))
    : [];
  const project =
    state.project?.id && state.project.id !== "project:steel-bracket-installation"
      ? state.project
      : projects[0] ?? null;

  return {
    clients,
    projects,
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
    project,
    entries: Array.isArray(state.entries)
      ? state.entries.filter(
          (entry) => entry.projectId !== "project:steel-bracket-installation",
        ).map((entry) => ({
          ...entry,
          dayType: entry.dayType ?? "normal",
          clockInGpsLatitude: entry.clockInGpsLatitude ?? null,
          clockInGpsLongitude: entry.clockInGpsLongitude ?? null,
          clockOutGpsLatitude: entry.clockOutGpsLatitude ?? null,
          clockOutGpsLongitude: entry.clockOutGpsLongitude ?? null,
          breakIntervals: entry.breakIntervals ?? [],
          taskSwitches: entry.taskSwitches ?? [],
          currentTaskId: entry.currentTaskId ?? null,
        }))
      : [],
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeCurrency(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase() || "SGD";
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "SGD";
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
