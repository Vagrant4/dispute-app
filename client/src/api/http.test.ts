import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiRequest,
  createCompanyRequest,
  deleteProjectRequest,
  listProjectsRequest,
  updateCompanyRequest
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
});
