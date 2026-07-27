import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/http';
import { AuthProvider } from '../auth/AuthContext';
import { RegisterPage } from './RegisterPage';

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

describe('RegisterPage', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMocks.restoreSessionRequest.mockRejectedValue(new ApiError('Authentication required', 401));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('submits required signup profile fields without a pre-verification profile request', async () => {
    apiMocks.registerRequest.mockResolvedValue({ id: 'user-1', email: 'worker@example.com', role: 'WORKER' });

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<div>Entered app</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Create your evidence account' });

    await userEvent.type(screen.getByLabelText('Full name'), 'Worker One');
    await userEvent.type(screen.getByLabelText('Email'), 'worker@example.com');
    await userEvent.type(screen.getByLabelText('Phone'), '+6590000000');
    await userEvent.type(screen.getByLabelText('Trade or role'), 'Installer');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByText('Entered app')).toBeTruthy());
    expect(apiMocks.registerRequest).toHaveBeenCalledWith(
      'worker@example.com',
      'password123',
      'Worker One',
      '+6590000000'
    );
    expect(apiMocks.saveProfileRequest).not.toHaveBeenCalled();
  });
});
