import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClockPanel } from './ClockPanel';
import type { Project, TimeEntry } from '../api/http';

const project: Project = {
  id: 'project-1',
  userId: 'user-1',
  companyId: null,
  projectName: 'Lobby Works',
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
};

const activeEntry: TimeEntry = {
  id: 'entry-1',
  userId: 'user-1',
  projectId: 'project-1',
  date: '2026-06-08T00:00:00.000Z',
  clockInTime: '2026-06-08T09:00:00.000Z',
  clockOutTime: null,
  breakMinutes: 0,
  totalHours: 0,
  overtimeHours: 0,
  workDescription: 'Started install',
  manualEntryFlag: false,
  locationText: 'Site A',
  clockInGpsLat: null,
  clockInGpsLng: null,
  clockOutGpsLat: null,
  clockOutGpsLng: null,
  notes: '',
  status: 'DRAFT',
  createdAt: '2026-06-08T09:00:00.000Z',
  updatedAt: '2026-06-08T09:00:00.000Z'
};

describe('ClockPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows active project summary and sends clock-out break minutes', async () => {
    const onClockOut = vi.fn();

    render(
      <ClockPanel
        activeEntry={activeEntry}
        draftCount={2}
        loading={false}
        message=""
        onAddManualEntry={vi.fn()}
        onClockIn={vi.fn()}
        onClockOut={onClockOut}
        onGenerateReport={vi.fn()}
        onUploadPhoto={vi.fn()}
        projects={[project]}
        submitting={false}
        todayHours={4.5}
        weekHours={12}
      />
    );

    expect(screen.getByText('Lobby Works')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Clocked in' })).toBeTruthy();
    expect(screen.getByText('4.50h')).toBeTruthy();
    expect(screen.getByText('12.00h')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();

    await userEvent.clear(screen.getByLabelText('Break minutes'));
    await userEvent.type(screen.getByLabelText('Break minutes'), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Clock Out' }));

    expect(onClockOut).toHaveBeenCalledWith(30);
  });

  it('requires a project before clocking in', async () => {
    const onClockIn = vi.fn();

    render(
      <ClockPanel
        activeEntry={null}
        draftCount={0}
        loading={false}
        message=""
        onAddManualEntry={vi.fn()}
        onClockIn={onClockIn}
        onClockOut={vi.fn()}
        onGenerateReport={vi.fn()}
        onUploadPhoto={vi.fn()}
        projects={[]}
        submitting={false}
        todayHours={0}
        weekHours={0}
      />
    );

    expect(screen.getByRole('button', { name: 'Clock In' })).toHaveProperty('disabled', true);
  });
});
