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

interface ApiFormRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body: FormData;
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
  settings: AppSettings;
}

export type EvidenceType =
  | 'BEFORE_WORK'
  | 'DURING_WORK'
  | 'AFTER_WORK'
  | 'DEFECT'
  | 'COMPLETED_WORK'
  | 'MATERIAL_DELIVERY'
  | 'VARIATION_WORK'
  | 'OTHER';

export interface PhotoEvidence {
  id: string;
  userId: string;
  projectId: string;
  timeEntryId: string | null;
  imagePath: string;
  caption: string;
  evidenceType: EvidenceType;
  timestamp: string;
  gpsLat: number | null;
  gpsLng: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoEvidenceUploadInput {
  file: File;
  projectId: string;
  timeEntryId?: string | null;
  evidenceType: EvidenceType;
  caption?: string;
  timestamp?: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
}

interface PhotoEvidenceResponse {
  photoEvidence: PhotoEvidence;
}

interface PhotoEvidenceListResponse {
  photoEvidence: PhotoEvidence[];
}

export interface PayLineItemInput {
  description: string;
  amount: number;
}

export interface GeneratePaySummaryInput {
  projectId?: string | null;
  salaryPeriodStart: string;
  salaryPeriodEnd: string;
  rateType: 'HOURLY';
  basicRate: number;
  overtimeRate?: number;
  restDayPay?: number;
  publicHolidayPay?: number;
  allowances?: PayLineItemInput[];
  deductions?: PayLineItemInput[];
  notes?: string;
}

export interface PaySummary {
  id: string;
  userId: string;
  projectId: string | null;
  salaryPeriodStart: string;
  salaryPeriodEnd: string;
  rateType: 'HOURLY';
  basicRate: string | number;
  basicPay: string | number;
  overtimeRate: string | number;
  overtimePay: string | number;
  restDayPay: string | number;
  publicHolidayPay: string | number;
  totalAllowances: string | number;
  totalDeductions: string | number;
  grossPay: string | number;
  netPay: string | number;
  itemisedPayslipJson: string;
  notes: string;
  allowances?: Array<{ id?: string; description: string; amount: string | number }>;
  deductions?: Array<{ id?: string; description: string; amount: string | number }>;
  createdAt: string;
  updatedAt: string;
}

interface PaySummaryResponse {
  paySummary: PaySummary;
}

interface PaySummariesResponse {
  paySummaries: PaySummary[];
}

export interface GenerateReportInput {
  projectId: string;
  claimPeriodStart: string;
  claimPeriodEnd: string;
  hourlyRate?: number;
  overtimeRate?: number;
  allowances?: number;
  deductions?: number;
  restDayPay?: number;
  publicHolidayPay?: number;
  notes?: string;
}

export interface ProgressReport {
  id: string;
  userId: string;
  projectId: string;
  reportType: string;
  claimPeriodStart: string;
  claimPeriodEnd: string;
  totalDaysWorked: number;
  totalHours: number;
  totalOvertimeHours: number;
  totalClaimAmount: string | number;
  entriesSnapshotJson: string;
  photosSnapshotJson: string;
  pdfPath: string;
  csvPath: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface ReportResponse {
  report: ProgressReport;
}

interface ReportsResponse {
  reports: ProgressReport[];
}

export interface AppSettings {
  id?: string;
  userId: string;
  standardDailyHours: number;
  standardWeeklyHours: number;
  overtimeMultiplier: number;
  defaultCurrency: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AppSettingsInput = Pick<AppSettings, 'standardDailyHours' | 'standardWeeklyHours' | 'overtimeMultiplier' | 'defaultCurrency'>;

interface AdminResponse {
  message: string;
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

  return parseSuccessJson<T>(text, response.status, path);
}

async function apiFormRequest<T>(path: string, options: ApiFormRequestOptions): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    body: options.body
  });

  if (!response.ok) {
    const errorBody = await readJson<{ error?: string; message?: string; issues?: unknown }>(response);
    const message = errorBody?.error ?? errorBody?.message ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, errorBody?.issues);
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return parseSuccessJson<T>(text, response.status, path);
}

async function apiBlobRequest(path: string): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    const errorBody = await readJson<{ error?: string; message?: string; issues?: unknown }>(response);
    const message = errorBody?.error ?? errorBody?.message ?? `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, errorBody?.issues);
  }

  return response.blob();
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

export async function listPhotoEvidenceRequest(): Promise<PhotoEvidence[]> {
  const response = await apiRequest<PhotoEvidenceListResponse>('/photo-evidence');
  return response.photoEvidence;
}

export async function uploadPhotoEvidenceRequest(input: PhotoEvidenceUploadInput): Promise<PhotoEvidence> {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('projectId', input.projectId);
  if (input.timeEntryId) formData.append('timeEntryId', input.timeEntryId);
  formData.append('evidenceType', input.evidenceType);
  formData.append('caption', input.caption ?? '');
  formData.append('timestamp', input.timestamp ?? new Date().toISOString());
  if (input.gpsLat !== null && input.gpsLat !== undefined) formData.append('gpsLat', String(input.gpsLat));
  if (input.gpsLng !== null && input.gpsLng !== undefined) formData.append('gpsLng', String(input.gpsLng));

  const response = await apiFormRequest<PhotoEvidenceResponse>('/photo-evidence/upload', {
    method: 'POST',
    body: formData
  });
  return response.photoEvidence;
}

export function deletePhotoEvidenceRequest(id: string): Promise<void> {
  return apiRequest<void>(`/photo-evidence/${id}`, { method: 'DELETE' });
}

export async function listPaySummariesRequest(): Promise<PaySummary[]> {
  const response = await apiRequest<PaySummariesResponse>('/pay-summaries');
  return response.paySummaries;
}

export async function generatePaySummaryRequest(input: GeneratePaySummaryInput): Promise<PaySummary> {
  const response = await apiRequest<PaySummaryResponse>('/pay-summaries/generate', {
    method: 'POST',
    body: input
  });
  return response.paySummary;
}

export function deletePaySummaryRequest(id: string): Promise<void> {
  return apiRequest<void>(`/pay-summaries/${id}`, { method: 'DELETE' });
}

export async function listReportsRequest(): Promise<ProgressReport[]> {
  const response = await apiRequest<ReportsResponse>('/reports');
  return response.reports;
}

export async function generateProgressClaimReportRequest(input: GenerateReportInput): Promise<ProgressReport> {
  const response = await apiRequest<ReportResponse>('/reports/progress-claim', {
    method: 'POST',
    body: input
  });
  return response.report;
}

export function deleteReportRequest(id: string): Promise<void> {
  return apiRequest<void>(`/reports/${id}`, { method: 'DELETE' });
}

export function downloadReportFileRequest(id: string, format: 'pdf' | 'csv'): Promise<Blob> {
  return apiBlobRequest(`/reports/${id}/${format}`);
}

export async function getSettingsRequest(): Promise<AppSettings> {
  const response = await apiRequest<SettingsResponse>('/settings');
  return response.settings;
}

export async function saveSettingsRequest(settings: AppSettingsInput): Promise<AppSettings> {
  const response = await apiRequest<SettingsResponse>('/settings', {
    method: 'PUT',
    body: {
      ...settings,
      defaultCurrency: settings.defaultCurrency.toUpperCase()
    }
  });
  return response.settings;
}

export async function getAdminPlaceholderRequest(): Promise<string> {
  const response = await apiRequest<AdminResponse>('/admin');
  return response.message;
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

function parseSuccessJson<T>(text: string, status: number, path: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(`Invalid JSON response from ${path}`, status);
  }
}
