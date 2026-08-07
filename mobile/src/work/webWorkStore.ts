import { buildProgressClaimSnapshot } from "../reports/progressClaimSnapshot";
import type { ProgressClaimSnapshot } from "../reports/progressClaimTypes";
import type {
  ClockInParams,
  ClockOutParams,
  WorkEntry,
  WorkHomeState,
  WorkClient,
  WorkProject,
  CreateClientParams,
  CreateProjectParams,
  UpdateProjectParams,
  CreateManualEntryParams,
  DeleteEntryParams,
} from "./workRepository";
import { DEFAULT_USER_ID } from "../db/settingsValidation";

const STORAGE_KEY = "claimproof-sg-web-work-state";

type WebWorkState = {
  clients: WorkClient[];
  projects: WorkProject[];
  project: WorkProject | null;
  entries: WorkEntry[];
};

export const webWorkStore = {
  async getHomeState(userId = DEFAULT_USER_ID): Promise<WorkHomeState> {
    return toHomeState(readState(userId));
  },

  async listClients(userId = DEFAULT_USER_ID): Promise<WorkClient[]> {
    return readState(userId).clients;
  },

  async listProjects(userId = DEFAULT_USER_ID): Promise<WorkProject[]> {
    return readState(userId).projects;
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

    const project: WorkProject = {
      id: createLocalId("web-project"),
      clientId: client.id,
      name: requireText(params.name, "Project name"),
      clientName: client.name,
      description: normalizeOptionalText(params.description),
      hourlyRateCents: Math.max(0, Math.floor(params.hourlyRateCents ?? 0)),
      currency: normalizeCurrency(params.currency),
      status: "active",
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

    const savedProject: WorkProject = {
      ...existingProject,
      name: requireText(params.name, "Project name"),
      description: normalizeOptionalText(params.description),
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
      locationText: normalizeOptionalText(params.locationText),
      clockInGpsLatitude: params.gpsLatitude ?? null,
      clockInGpsLongitude: params.gpsLongitude ?? null,
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
    const clockOutAt = params.clockOutAt ?? new Date();
    const breakMinutes = Math.max(0, Math.floor(params.breakMinutes ?? 0));
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
        clockOutGpsLatitude: params.gpsLatitude ?? entry.clockInGpsLatitude ?? null,
        clockOutGpsLongitude: params.gpsLongitude ?? entry.clockInGpsLongitude ?? null,
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
    return buildProgressClaimSnapshot({
      generatedAt: new Date().toISOString(),
      worker: {
        name: "Local worker",
      },
      client: {
        name: "Client not selected",
      },
      project: {
        name: "Project not selected",
        hourlyRateCents: 0,
        currency: "SGD",
      },
      pay: {
        currency: "SGD",
        dailyNormalMinutes: 480,
        normalWorkStartTime: "08:00",
        normalWorkEndTime: "17:00",
        overtimeMultiplier: 1.5,
        offDayMultiplier: 2,
        holidayMultiplier: 2,
      },
    });
  }
  return buildProgressClaimSnapshot({
    generatedAt: new Date().toISOString(),
    worker: {
      name: "Local worker",
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
      hourlyRateCents: selectedProject.hourlyRateCents,
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
        clockInGpsLatitude: entry.clockInGpsLatitude,
        clockInGpsLongitude: entry.clockInGpsLongitude,
        clockOutGpsLatitude: entry.clockOutGpsLatitude,
        clockOutGpsLongitude: entry.clockOutGpsLongitude,
      })),
    pay: {
      currency: selectedProject.currency,
      hourlyRateCents: selectedProject.hourlyRateCents,
      dailyNormalMinutes: 480,
      normalWorkStartTime: "08:00",
      normalWorkEndTime: "17:00",
      overtimeMultiplier: 1.5,
      offDayMultiplier: 2,
      holidayMultiplier: 2,
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
      )
    : [];
  const project =
    state.project?.id && state.project.id !== "project:steel-bracket-installation"
      ? state.project
      : projects[0] ?? null;

  return {
    clients,
    projects,
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
