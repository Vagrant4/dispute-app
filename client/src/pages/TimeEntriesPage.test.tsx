import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeEntriesPage } from './TimeEntriesPage';

const apiMocks = vi.hoisted(() => ({
  createTimeEntryRequest: vi.fn(),
  finalizeTimeEntryRequest: vi.fn(),
  listProjectsRequest: vi.fn(),
  listTimeEntriesRequest: vi.fn()
}));

vi.mock('../api/http', async (importActual) => {
  const actual = await importActual<typeof import('../api/http')>();
  return {
    ...actual,
    createTimeEntryRequest: apiMocks.createTimeEntryRequest,
    finalizeTimeEntryRequest: apiMocks.finalizeTimeEntryRequest,
    listProjectsRequest: apiMocks.listProjectsRequest,
    listTimeEntriesRequest: apiMocks.listTimeEntriesRequest
  };
});

describe('TimeEntriesPage', () => {
  beforeEach(() => {
    apiMocks.listProjectsRequest.mockResolvedValue([
      {
        id: 'project-1',
        userId: 'user-1',
        companyId: null,
        projectName: 'Night Works',
        siteAddress: '1 Site Road',
        poOrWorkOrderNumber: null,
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: null,
        description: '',
        defaultHourlyRate: '25',
        defaultDailyRate: null,
        status: 'ACTIVE',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z'
      }
    ]);
    apiMocks.listTimeEntriesRequest.mockResolvedValue([]);
    apiMocks.createTimeEntryRequest.mockResolvedValue({
      id: 'entry-1',
      userId: 'user-1',
      projectId: 'project-1',
      date: '2026-06-08T00:00:00.000Z',
      clockInTime: '2026-06-08T22:00:00.000Z',
      clockOutTime: '2026-06-09T06:00:00.000Z',
      breakMinutes: 30,
      totalHours: 7.5,
      overtimeHours: 0,
      workDescription: 'Night shift install',
      manualEntryFlag: true,
      locationText: '',
      clockInGpsLat: null,
      clockInGpsLng: null,
      clockOutGpsLat: null,
      clockOutGpsLng: null,
      notes: '',
      status: 'DRAFT',
      createdAt: '2026-06-09T06:00:00.000Z',
      updatedAt: '2026-06-09T06:00:00.000Z'
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('allows manual entries that clock out on the next date', async () => {
    render(<TimeEntriesPage />);

    await screen.findByText('Night Works');
    await userEvent.clear(screen.getByLabelText('Date'));
    await userEvent.type(screen.getByLabelText('Date'), '2026-06-08');
    await userEvent.clear(screen.getByLabelText('Clock out date'));
    await userEvent.type(screen.getByLabelText('Clock out date'), '2026-06-09');
    await userEvent.clear(screen.getByLabelText('Clock in'));
    await userEvent.type(screen.getByLabelText('Clock in'), '22:00');
    await userEvent.clear(screen.getByLabelText('Clock out'));
    await userEvent.type(screen.getByLabelText('Clock out'), '06:00');
    await userEvent.clear(screen.getByLabelText('Break minutes'));
    await userEvent.type(screen.getByLabelText('Break minutes'), '30');
    await userEvent.type(screen.getByLabelText('Work description'), 'Night shift install');
    await userEvent.click(screen.getByRole('button', { name: 'Save manual entry' }));

    await waitFor(() => expect(apiMocks.createTimeEntryRequest).toHaveBeenCalled());
    expect(apiMocks.createTimeEntryRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        clockInTime: '2026-06-08T14:00:00.000Z',
        clockOutTime: '2026-06-08T22:00:00.000Z'
      })
    );
  });
});
