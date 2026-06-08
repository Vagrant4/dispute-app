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

interface AuthResponse {
  user: AuthUser;
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

export function getProfileRequest(): Promise<unknown> {
  return apiRequest('/profile');
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

export function saveProfileRequest(profile: WorkerProfileInput): Promise<unknown> {
  return apiRequest('/profile', {
    method: 'PUT',
    body: profile
  });
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
