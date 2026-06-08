import { useEffect, useMemo, useState } from 'react';
import type { Project, TimeEntry } from '../api/http';
import { StatusBadge } from './StatusBadge';

interface ClockPanelProps {
  activeEntry: TimeEntry | null;
  draftCount: number;
  loading: boolean;
  message: string;
  onAddManualEntry: () => void;
  onClockIn: (projectId: string, locationText: string) => void | Promise<void>;
  onClockOut: (breakMinutes: number) => void | Promise<void>;
  onGenerateReport: () => void;
  onUploadPhoto: () => void;
  projects: Project[];
  submitting: boolean;
  todayHours: number;
  weekHours: number;
}

export function ClockPanel({
  activeEntry,
  draftCount,
  loading,
  message,
  onAddManualEntry,
  onClockIn,
  onClockOut,
  onGenerateReport,
  onUploadPhoto,
  projects,
  submitting,
  todayHours,
  weekHours
}: ClockPanelProps) {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [locationText, setLocationText] = useState('');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!selectedProjectId && projects[0]) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!activeEntry) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeEntry]);

  const activeProject = useMemo(() => {
    const projectId = activeEntry?.projectId ?? selectedProjectId;
    return projects.find((project) => project.id === projectId) ?? null;
  }, [activeEntry?.projectId, projects, selectedProjectId]);

  const elapsedLabel = activeEntry ? formatDuration(Math.max(0, now - new Date(activeEntry.clockInTime).getTime())) : '0m';
  const normalizedBreakMinutes = Math.max(0, Math.floor(Number(breakMinutes) || 0));
  const canClockIn = Boolean(selectedProjectId) && !activeEntry && !loading && !submitting;
  const canClockOut = Boolean(activeEntry) && !loading && !submitting;

  return (
    <section className="clock-panel" aria-labelledby="clock-panel-heading">
      <div className="clock-panel-header">
        <div>
          <p className="eyebrow">Live clock</p>
          <h2 id="clock-panel-heading">{activeEntry ? 'Clocked in' : 'Ready to clock in'}</h2>
        </div>
        <StatusBadge
          status={activeEntry ? 'CLOCKED_IN' : 'OFF_SITE'}
          label={activeEntry ? 'Clocked in' : 'Off site'}
          tone={activeEntry ? 'success' : 'neutral'}
        />
      </div>

      <div className="clock-focus">
        <span>{elapsedLabel}</span>
        <strong>{activeProject?.projectName ?? 'No active project'}</strong>
        <p>{activeEntry?.locationText || activeProject?.siteAddress || 'Choose a project and optional location note.'}</p>
      </div>

      <div className="metric-grid">
        <div className="metric-item">
          <span>Today</span>
          <strong>{formatHours(todayHours)}</strong>
        </div>
        <div className="metric-item">
          <span>This week</span>
          <strong>{formatHours(weekHours)}</strong>
        </div>
        <div className="metric-item">
          <span>Draft records</span>
          <strong>{draftCount}</strong>
        </div>
      </div>

      {message ? <div className="notice-panel compact">{message}</div> : null}

      {!activeEntry ? (
        <div className="clock-controls">
          <label>
            Project
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} disabled={submitting}>
              {projects.length === 0 ? <option value="">No projects yet</option> : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location note
            <input
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
              placeholder="Block, unit, zone, or site note"
            />
          </label>
          <button className="clock-button clock-in-button" type="button" disabled={!canClockIn} onClick={() => void onClockIn(selectedProjectId, locationText)}>
            {submitting ? 'Clocking in...' : 'Clock In'}
          </button>
        </div>
      ) : (
        <div className="clock-controls">
          <label>
            Break minutes
            <input min="0" step="1" type="number" value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} />
          </label>
          <button className="clock-button clock-out-button" type="button" disabled={!canClockOut} onClick={() => void onClockOut(normalizedBreakMinutes)}>
            {submitting ? 'Clocking out...' : 'Clock Out'}
          </button>
        </div>
      )}

      <div className="quick-actions" aria-label="Quick actions">
        <button className="ghost-button" type="button" onClick={onAddManualEntry}>
          Add Manual Entry
        </button>
        <button className="ghost-button" type="button" onClick={onUploadPhoto}>
          Upload Photo
        </button>
        <button className="ghost-button" type="button" onClick={onGenerateReport}>
          Generate Report
        </button>
      </div>
    </section>
  );
}

function formatHours(value: number): string {
  return `${value.toFixed(2)}h`;
}

function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}
