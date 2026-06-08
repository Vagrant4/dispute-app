const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issues?: unknown
  ) {
    super(message);
  }
}

interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: HeadersInit;
}

export interface AuthUser {
  id: string;
  email: string | null;
  role: 'WORKER' | 'ADMIN_PLACEHOLDER';
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkerProfileInput {
  fullName: string;
  phone: string;
  workerIdentifier?: string | null;
  finNric?: string | null;
  trade: string;
  employmentType: 'HOURLY' | 'DAILY' | 'MONTHLY' | 'FREELANCER';
  defaultHourlyRate: number | null;
  defaultDailyRate: number | null;
  defaultMonthlySalary: number | null;
}

export interface WorkerProfile extends WorkerProfileInput {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyInput {
  name: string;
  uen?: string | null;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

export interface Company extends CompanyInput {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';

export interface ProjectInput {
  companyId?: string | null;
  projectName: string;
  siteAddress: string;
  poOrWorkOrderNumber?: string | null;
  startDate: string;
  endDate?: string | null;
  description: string;
  defaultHourlyRate: number | null;
  defaultDailyRate: number | null;
  status: ProjectStatus;
}

export interface Project extends Omit<ProjectInput, 'defaultHourlyRate' | 'defaultDailyRate'> {
  id: string;
  userId: string;
  defaultHourlyRate: string | number | null;
  defaultDailyRate: string | number | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthResponse {
  user: AuthUser;
}

interface ProfileResponse {
  profile: WorkerProfile | null;
}

interface CompanyResponse {
  company: Company;
}

interface CompaniesResponse {
  companies: Company[];
}

interface ProjectResponse {
  project: Project;
}

interface ProjectsResponse {
  projects: Project[];
}

export type TimeEntryStatus = 'DRAFT' | 'FINALIZED';

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  date: string;
  clockInTime: string;
  clockOutTime: string | null;
  breakMinutes: number;
  totalHours: number;
  overtimeHours: number;
  workDescription: string;
  manualEntryFlag: boolean;
  locationText: string;
  clockInGpsLat: number | null;
  clockInGpsLng: number | null;
  clockOutGpsLat: number | null;
  clockOutGpsLng: number | null;
  notes: string;
  status: TimeEntryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntryInput {
  projectId: string;
  date?: string;
  clockInTime: string;
  clockOutTime: string;
  breakMinutes: number;
  workDescription?: string;
  locationText?: string;
  clockInGpsLat?: number | null;
  clockInGpsLng?: number | null;
  clockOutGpsLat?: number | null;
  clockOutGpsLng?: number | null;
  notes?: string;
  manualEntryFlag?: true;
}

export interface ClockInInput {
  projectId: string;
  date?: string;
  clockInTime?: string;
  workDescription?: string;
  locationText?: string;
  clockInGpsLat?: number | null;
  clockInGpsLng?: number | null;
  notes?: string;
}

export interface ClockOutInput {
  clockOutTime: string;
  breakMinutes: number;
  clockOutGpsLat?: number | null;
  clockOutGpsLng?: number | null;
  locationText?: string;
  workDescription?: string;
  notes?: string;
}

interface TimeEntryResponse {
  timeEntry: TimeEntry;
}

interface TimeEntriesResponse {
  timeEntries: TimeEntry[];
}

interface SettingsResponse {
  settings: {
    userId: string;
  };
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined;

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const errorBody = await readJson<{ error?: string; message?: string; issues?: unknown }>(response);
    const message = errorBody?.error ?? errorBody?.message ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, errorBody?.issues);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export async function loginRequest(email: string, password: string): Promise<AuthUser> {
  const response = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  return response.user;
}

export async function registerRequest(email: string, password: string): Promise<AuthUser> {
  const response = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password }
  });
  return response.user;
}

export function logoutRequest(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' });
}

export async function getProfileRequest(): Promise<WorkerProfile | null> {
  const response = await apiRequest<ProfileResponse>('/profile');
  return response.profile;
}

export async function restoreSessionRequest(): Promise<AuthUser> {
  await getProfileRequest();
  const response = await apiRequest<SettingsResponse>('/settings');

  return {
    id: response.settings.userId,
    email: null,
    role: 'WORKER'
  };
}

export async function saveProfileRequest(profile: WorkerProfileInput): Promise<WorkerProfile> {
  const response = await apiRequest<ProfileResponse>('/profile', {
    method: 'PUT',
    body: profile
  });
  if (!response.profile) {
    throw new ApiError('Profile response was empty', 500);
  }
  return response.profile;
}

export async function listCompaniesRequest(): Promise<Company[]> {
  const response = await apiRequest<CompaniesResponse>('/companies');
  return response.companies;
}

export async function createCompanyRequest(company: CompanyInput): Promise<Company> {
  const response = await apiRequest<CompanyResponse>('/companies', {
    method: 'POST',
    body: company
  });
  return response.company;
}

export async function updateCompanyRequest(id: string, company: Partial<CompanyInput>): Promise<Company> {
  const response = await apiRequest<CompanyResponse>(`/companies/${id}`, {
    method: 'PUT',
    body: company
  });
  return response.company;
}

export function deleteCompanyRequest(id: string): Promise<void> {
  return apiRequest<void>(`/companies/${id}`, { method: 'DELETE' });
}

export async function listProjectsRequest(): Promise<Project[]> {
  const response = await apiRequest<ProjectsResponse>('/projects');
  return response.projects;
}

export async function createProjectRequest(project: ProjectInput): Promise<Project> {
  const response = await apiRequest<ProjectResponse>('/projects', {
    method: 'POST',
    body: project
  });
  return response.project;
}

export async function updateProjectRequest(id: string, project: Partial<ProjectInput>): Promise<Project> {
  const response = await apiRequest<ProjectResponse>(`/projects/${id}`, {
    method: 'PUT',
    body: project
  });
  return response.project;
}

export function deleteProjectRequest(id: string): Promise<void> {
  return apiRequest<void>(`/projects/${id}`, { method: 'DELETE' });
}

export async function listTimeEntriesRequest(): Promise<TimeEntry[]> {
  const response = await apiRequest<TimeEntriesResponse>('/time-entries');
  return response.timeEntries;
}

export async function createTimeEntryRequest(timeEntry: TimeEntryInput): Promise<TimeEntry> {
  const response = await apiRequest<TimeEntryResponse>('/time-entries', {
    method: 'POST',
    body: timeEntry
  });
  return response.timeEntry;
}

export async function clockInRequest(input: ClockInInput): Promise<TimeEntry> {
  const response = await apiRequest<TimeEntryResponse>('/time-entries/clock-in', {
    method: 'POST',
    body: input
  });
  return response.timeEntry;
}

export async function clockOutRequest(id: string, input: ClockOutInput): Promise<TimeEntry> {
  const response = await apiRequest<TimeEntryResponse>(`/time-entries/${id}/clock-out`, {
    method: 'POST',
    body: input
  });
  return response.timeEntry;
}

export async function finalizeTimeEntryRequest(id: string): Promise<TimeEntry> {
  const response = await apiRequest<TimeEntryResponse>(`/time-entries/${id}/finalize`, {
    method: 'POST',
    body: {}
  });
  return response.timeEntry;
}

async function readJson<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) return null;

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
