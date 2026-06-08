import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaySummaryPage } from './PaySummaryPage';

const apiMocks = vi.hoisted(() => ({
  getSettingsRequest: vi.fn(),
  listPaySummariesRequest: vi.fn(),
  listProjectsRequest: vi.fn()
}));

vi.mock('../api/http', async (importActual) => {
  const actual = await importActual<typeof import('../api/http')>();
  return {
    ...actual,
    getSettingsRequest: apiMocks.getSettingsRequest,
    listPaySummariesRequest: apiMocks.listPaySummariesRequest,
    listProjectsRequest: apiMocks.listProjectsRequest
  };
});

describe('PaySummaryPage', () => {
  beforeEach(() => {
    apiMocks.getSettingsRequest.mockResolvedValue({
      userId: 'user-1',
      standardDailyHours: 8,
      standardWeeklyHours: 44,
      overtimeMultiplier: 1.5,
      defaultCurrency: 'USD'
    });
    apiMocks.listProjectsRequest.mockResolvedValue([]);
    apiMocks.listPaySummariesRequest.mockResolvedValue([
      {
        id: 'summary-1',
        userId: 'user-1',
        projectId: null,
        salaryPeriodStart: '2026-06-01T00:00:00.000Z',
        salaryPeriodEnd: '2026-06-08T00:00:00.000Z',
        rateType: 'HOURLY',
        basicRate: '20',
        basicPay: '100',
        overtimeRate: '30',
        overtimePay: '15',
        restDayPay: '0',
        publicHolidayPay: '0',
        totalAllowances: '5',
        totalDeductions: '10',
        grossPay: '120',
        netPay: '110',
        itemisedPayslipJson: '{}',
        notes: '',
        createdAt: '2026-06-08T00:00:00.000Z',
        updatedAt: '2026-06-08T00:00:00.000Z'
      }
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('formats pay amounts with the configured default currency', async () => {
    render(<PaySummaryPage />);

    expect(await screen.findAllByText('US$110.00')).toHaveLength(2);
    expect(screen.getByText('US$100.00')).toBeTruthy();
  });
});
