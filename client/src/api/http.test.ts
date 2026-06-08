import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './http';

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
});
