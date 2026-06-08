import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsPage } from './ReportsPage';

const apiMocks = vi.hoisted(() => ({
  downloadReportFileRequest: vi.fn(),
  getSettingsRequest: vi.fn(),
  listProjectsRequest: vi.fn(),
  listReportsRequest: vi.fn()
}));

vi.mock('../api/http', async (importActual) => {
  const actual = await importActual<typeof import('../api/http')>();
  return {
    ...actual,
    downloadReportFileRequest: apiMocks.downloadReportFileRequest,
    getSettingsRequest: apiMocks.getSettingsRequest,
    listProjectsRequest: apiMocks.listProjectsRequest,
    listReportsRequest: apiMocks.listReportsRequest
  };
});

describe('ReportsPage', () => {
  beforeEach(() => {
    apiMocks.getSettingsRequest.mockResolvedValue({
      userId: 'user-1',
      standardDailyHours: 8,
      standardWeeklyHours: 44,
      overtimeMultiplier: 1.5,
      defaultCurrency: 'USD'
    });
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
        description: '',
        defaultHourlyRate: '20',
        defaultDailyRate: null,
        status: 'ACTIVE',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z'
      }
    ]);
    apiMocks.listReportsRequest.mockResolvedValue([
      {
        id: 'report-1',
        userId: 'user-1',
        projectId: 'project-1',
        reportType: 'PROGRESS_CLAIM',
        claimPeriodStart: '2026-06-01T00:00:00.000Z',
        claimPeriodEnd: '2026-06-08T00:00:00.000Z',
        totalDaysWorked: 2,
        totalHours: 16,
        totalOvertimeHours: 1,
        totalClaimAmount: '410',
        entriesSnapshotJson: '[]',
        photosSnapshotJson: '[]',
        pdfPath: 'exports/report.pdf',
        csvPath: 'exports/report.csv',
        notes: '',
        createdAt: '2026-06-08T00:00:00.000Z',
        updatedAt: '2026-06-08T00:00:00.000Z'
      }
    ]);
    apiMocks.downloadReportFileRequest.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:report'),
      revokeObjectURL: vi.fn()
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('formats report amounts with the configured default currency', async () => {
    render(<ReportsPage />);

    expect(await screen.findAllByText('US$410.00')).toHaveLength(2);
  });

  it('revokes report download object URLs after a short delay', async () => {
    render(<ReportsPage />);

    await screen.findByRole('heading', { name: 'Lobby Works' });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
  });
});
