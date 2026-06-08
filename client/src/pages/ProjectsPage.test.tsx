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
});
