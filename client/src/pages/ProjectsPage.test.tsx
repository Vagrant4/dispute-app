import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/http';
import { ProjectsPage } from './ProjectsPage';

const apiMocks = vi.hoisted(() => ({
  deleteProjectRequest: vi.fn(),
  listCompaniesRequest: vi.fn(),
  listProjectsRequest: vi.fn()
}));

vi.mock('../api/http', async (importActual) => {
  const actual = await importActual<typeof import('../api/http')>();
  return {
    ...actual,
    deleteProjectRequest: apiMocks.deleteProjectRequest,
    listCompaniesRequest: apiMocks.listCompaniesRequest,
    listProjectsRequest: apiMocks.listProjectsRequest
  };
});

describe('ProjectsPage', () => {
  beforeEach(() => {
    apiMocks.listCompaniesRequest.mockResolvedValue([]);
    apiMocks.listProjectsRequest.mockResolvedValue([
      {
        id: 'project-1',
        userId: 'user-1',
        companyId: null,
        projectName: 'Lobby Works',
        siteAddress: '1 Site Road',
        poOrWorkOrderNumber: null,
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: null,
        description: 'Install works',
        defaultHourlyRate: '25',
        defaultDailyRate: null,
        status: 'ACTIVE',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z'
      }
    ]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('shows delete conflict errors from the API without removing the project', async () => {
    apiMocks.deleteProjectRequest.mockRejectedValue(
      new ApiError('Project cannot be deleted while it has dependent records', 409)
    );

    render(<ProjectsPage />);

    await screen.findByText('Lobby Works');
    await userEvent.click(screen.getByRole('button', { name: 'Delete Lobby Works' }));

    await waitFor(() =>
      expect(screen.getByText('Project cannot be deleted while it has dependent records')).toBeTruthy()
    );
    expect(screen.getByText('Lobby Works')).toBeTruthy();
  });

  it('renders project dates from the recorded YYYY-MM-DD portion instead of local timezone conversion', async () => {
    apiMocks.listProjectsRequest.mockResolvedValue([
      {
        id: 'project-1',
        userId: 'user-1',
        companyId: null,
        projectName: 'Lobby Works',
        siteAddress: '1 Site Road',
        poOrWorkOrderNumber: null,
        startDate: '2026-06-01T23:00:00.000Z',
        endDate: '2026-06-02T23:00:00.000Z',
        description: 'Install works',
        defaultHourlyRate: '25',
        defaultDailyRate: null,
        status: 'ACTIVE',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z'
      }
    ]);

    render(<ProjectsPage />);

    await screen.findByText('Lobby Works');

    expect(screen.getByText('01 Jun 2026')).toBeTruthy();
    expect(screen.getByText('02 Jun 2026')).toBeTruthy();
  });

  it('uses the local calendar date for the default project start date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T16:30:00.000Z'));
    vi.resetModules();
    const { ProjectsPage: TimedProjectsPage } = await import('./ProjectsPage');

    render(<TimedProjectsPage />);

    const startDateInput = screen.getByLabelText('Start date') as HTMLInputElement;
    expect(startDateInput.value).toBe('2026-06-08');
  });
});
