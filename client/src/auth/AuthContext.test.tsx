import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type AuthUser, type WorkerProfileInput } from '../api/http';
import { AuthProvider, useAuth } from './AuthContext';

const apiMocks = vi.hoisted(() => ({
  loginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  registerRequest: vi.fn(),
  restoreSessionRequest: vi.fn(),
  saveProfileRequest: vi.fn()
}));

vi.mock('../api/http', async (importActual) => {
  const actual = await importActual<typeof import('../api/http')>();
  return {
    ...actual,
    loginRequest: apiMocks.loginRequest,
    logoutRequest: apiMocks.logoutRequest,
    registerRequest: apiMocks.registerRequest,
    restoreSessionRequest: apiMocks.restoreSessionRequest,
    saveProfileRequest: apiMocks.saveProfileRequest
  };
});

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('does not restore a stale cached user when backend session verification fails', async () => {
    localStorage.setItem(
      'claimproof.currentUser',
      JSON.stringify({ id: 'cached-user', email: 'cached@example.com', role: 'WORKER' })
    );
    apiMocks.restoreSessionRequest.mockRejectedValue(new ApiError('Authentication required', 401));

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    expect(apiMocks.restoreSessionRequest).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(localStorage.getItem('claimproof.currentUser')).toBeNull();
  });

  it('throws a recoverable registration error when profile save fails after account creation', async () => {
    const registeredUser: AuthUser = { id: 'user-1', email: 'worker@example.com', role: 'WORKER' };
    apiMocks.restoreSessionRequest.mockRejectedValue(new ApiError('Authentication required', 401));
    apiMocks.registerRequest.mockResolvedValue(registeredUser);
    apiMocks.saveProfileRequest.mockRejectedValue(new ApiError('Invalid profile payload', 400));

    render(
      <AuthProvider>
        <RegisterProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    await act(async () => {
      screen.getByRole('button', { name: 'register' }).click();
    });

    await waitFor(() =>
      expect(screen.getByTestId('register-error').textContent).toBe(
        'Account created, but profile setup failed: Invalid profile payload'
      )
    );
    expect(screen.getByTestId('user').textContent).toBe('none');
  });
});

function AuthStateProbe() {
  const { currentUser, loading } = useAuth();

  return (
    <>
      <div data-testid="loading">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{currentUser?.email ?? 'none'}</div>
    </>
  );
}

function RegisterProbe() {
  const { currentUser, loading, register } = useAuth();

  async function handleRegister() {
    try {
      await register({
        email: 'worker@example.com',
        password: 'password123',
        profile: testProfile
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      document.querySelector('[data-testid="register-error"]')!.textContent = message;
    }
  }

  return (
    <>
      <div data-testid="loading">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{currentUser?.email ?? 'none'}</div>
      <div data-testid="register-error" />
      <button type="button" onClick={() => void handleRegister()}>
        register
      </button>
    </>
  );
}

const testProfile: WorkerProfileInput = {
  fullName: 'Worker One',
  phone: '+6590000000',
  trade: 'Installer',
  employmentType: 'FREELANCER',
  workerIdentifier: null,
  finNric: null,
  defaultHourlyRate: null,
  defaultDailyRate: null,
  defaultMonthlySalary: null
};
