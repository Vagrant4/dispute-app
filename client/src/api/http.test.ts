import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiRequest,
  clockInRequest,
  clockOutRequest,
  createCompanyRequest,
  createTimeEntryRequest,
  deleteProjectRequest,
  downloadReportFileRequest,
  finalizeTimeEntryRequest,
  listProjectsRequest,
  listTimeEntriesRequest,
  saveSettingsRequest,
  updateCompanyRequest,
  uploadPhotoEvidenceRequest,
  type PhotoEvidenceUploadInput
} from './http';

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends JSON requests with cookie credentials', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'user-1', email: 'worker@example.com' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const result = await apiRequest<{ user: { id: string; email: string } }>('/auth/login', {
      method: 'POST',
      body: { email: 'worker@example.com', password: 'password123' }
    });

    expect(result.user.email).toBe('worker@example.com');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/auth/login',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({ email: 'worker@example.com', password: 'password123' })
      })
    );
  });

  it('returns undefined for empty successful responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('throws server error messages when a request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Invalid email or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await expect(apiRequest('/auth/login', { method: 'POST' })).rejects.toThrow('Invalid email or password');
  });

  it('maps company CRUD helpers to the ownership-scoped endpoints', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ company: { id: 'company-1', name: 'Build Pte Ltd' } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ company: { id: 'company-1', name: 'Build Pte Ltd' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    await createCompanyRequest({
      name: 'Build Pte Ltd',
      uen: null,
      contactPerson: 'Tan',
      email: 'tan@example.com',
      phone: '+6590000000',
      address: '1 Site Road',
      notes: ''
    });
    await updateCompanyRequest('company-1', { phone: '+6591111111' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/companies',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/companies/company-1',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify({ phone: '+6591111111' })
      })
    );
  });

  it('unwraps projects and sends project deletes to the scoped endpoint', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ projects: [{ id: 'project-1', projectName: 'Lobby Works' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const projects = await listProjectsRequest();
    await deleteProjectRequest('project-1');

    expect(projects[0]?.projectName).toBe('Lobby Works');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3000/projects/project-1',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' })
    );
  });

  it('maps time entry helpers to the scoped clock and manual endpoints', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ timeEntries: [{ id: 'entry-1', projectId: 'project-1' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ timeEntry: { id: 'entry-2', manualEntryFlag: true } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ timeEntry: { id: 'entry-3', clockOutTime: null } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ timeEntry: { id: 'entry-3', clockOutTime: '2026-06-01T18:00:00.000Z' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ timeEntry: { id: 'entry-3', status: 'FINALIZED' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

    const entries = await listTimeEntriesRequest();
    await createTimeEntryRequest({
      projectId: 'project-1',
      date: '2026-06-01',
      clockInTime: '2026-06-01T09:00:00.000Z',
      clockOutTime: '2026-06-01T18:00:00.000Z',
      breakMinutes: 60,
      workDescription: 'Manual work',
      locationText: 'Site A',
      manualEntryFlag: true
    });
    await clockInRequest({
      projectId: 'project-1',
      clockInTime: '2026-06-01T09:00:00.000Z',
      locationText: 'Site A',
      clockInGpsLat: 1.3521,
      clockInGpsLng: 103.8198
    });
    await clockOutRequest('entry-3', {
      clockOutTime: '2026-06-01T18:00:00.000Z',
      breakMinutes: 45,
      clockOutGpsLat: 1.3,
      clockOutGpsLng: 103.8
    });
    await finalizeTimeEntryRequest('entry-3');

    expect(entries[0]?.id).toBe('entry-1');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/time-entries',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          projectId: 'project-1',
          date: '2026-06-01',
          clockInTime: '2026-06-01T09:00:00.000Z',
          clockOutTime: '2026-06-01T18:00:00.000Z',
          breakMinutes: 60,
          workDescription: 'Manual work',
          locationText: 'Site A',
          manualEntryFlag: true
        })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/time-entries/clock-in',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://localhost:3000/time-entries/entry-3/clock-out',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://localhost:3000/time-entries/entry-3/finalize',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('http API helpers', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ settings: { userId: 'user-1', defaultCurrency: 'SGD' } })))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads photo evidence as multipart form data without a JSON content type', async () => {
    const file = new File(['image'], 'evidence.png', { type: 'image/png' });
    const input: PhotoEvidenceUploadInput = {
      file,
      projectId: 'project-1',
      timeEntryId: 'time-1',
      evidenceType: 'DURING_WORK',
      caption: 'Installed first bracket',
      timestamp: '2026-06-08T04:00:00.000Z',
      gpsLat: 1.3,
      gpsLng: 103.8
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ photoEvidence: { id: 'photo-1' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await uploadPhotoEvidenceRequest(input);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(init?.body).toBeInstanceOf(FormData);
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
  });

  it('downloads report files with credentials and returns a blob', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('pdf', { headers: { 'Content-Type': 'application/pdf' } }));

    const result = await downloadReportFileRequest('report-1', 'pdf');

    expect(result.type).toBe('application/pdf');
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('http://localhost:3000/reports/report-1/pdf');
    expect(vi.mocked(fetch).mock.calls[0][1]?.credentials).toBe('include');
  });

  it('saves settings through the typed endpoint', async () => {
    await saveSettingsRequest({
      standardDailyHours: 8,
      standardWeeklyHours: 44,
      overtimeMultiplier: 1.5,
      defaultCurrency: 'sgd'
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.method).toBe('PUT');
    expect(init?.body).toBe(
      JSON.stringify({
        standardDailyHours: 8,
        standardWeeklyHours: 44,
        overtimeMultiplier: 1.5,
        defaultCurrency: 'SGD'
      })
    );
  });
});
