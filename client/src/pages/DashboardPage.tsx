import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clockInRequest,
  clockOutRequest,
  listProjectsRequest,
  listTimeEntriesRequest,
  type Project,
  type TimeEntry
} from '../api/http';
import { ClockPanel } from '../components/ClockPanel';
import { MapPreview } from '../components/MapPreview';
import { StatusBadge } from '../components/StatusBadge';

export function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadDashboard();
  }, []);

  const activeEntry = useMemo(() => timeEntries.find((entry) => !entry.clockOutTime && entry.status === 'DRAFT') ?? null, [timeEntries]);
  const activeProjects = useMemo(() => projects.filter((project) => project.status === 'ACTIVE'), [projects]);
  const todayHours = useMemo(() => sumHours(timeEntries.filter(isToday)), [timeEntries]);
  const weekHours = useMemo(() => sumHours(timeEntries.filter(isThisWeek)), [timeEntries]);
  const draftCount = useMemo(() => timeEntries.filter((entry) => entry.status === 'DRAFT').length, [timeEntries]);
  const recentEntries = timeEntries.slice(0, 3);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const [nextProjects, nextTimeEntries] = await Promise.all([listProjectsRequest(), listTimeEntriesRequest()]);
      setProjects(nextProjects);
      setTimeEntries(nextTimeEntries);
    } catch (loadError) {
      setError(errorMessage(loadError, 'Unable to load dashboard'));
    } finally {
      setLoading(false);
    }
  }

  async function handleClockIn(projectId: string, locationText: string) {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const gps = await captureGps('clock in');
      const saved = await clockInRequest({
        projectId,
        clockInTime: new Date().toISOString(),
        locationText: locationText.trim(),
        ...(gps.coords ? { clockInGpsLat: gps.coords.lat, clockInGpsLng: gps.coords.lng } : {})
      });
      setTimeEntries((current) => [saved, ...current]);
      setMessage(gps.message ?? 'Clock-in saved.');
    } catch (clockError) {
      setError(errorMessage(clockError, 'Unable to clock in'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClockOut(breakMinutes: number) {
    if (!activeEntry) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const gps = await captureGps('clock out');
      const saved = await clockOutRequest(activeEntry.id, {
        clockOutTime: new Date().toISOString(),
        breakMinutes,
        ...(gps.coords ? { clockOutGpsLat: gps.coords.lat, clockOutGpsLng: gps.coords.lng } : {})
      });
      setTimeEntries((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
      setMessage(gps.message ?? 'Clock-out saved.');
    } catch (clockError) {
      setError(errorMessage(clockError, 'Unable to clock out'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="dashboard-page" aria-labelledby="dashboard-heading">
      <div className="page-heading">
        <p className="eyebrow">Dashboard</p>
        <h2 id="dashboard-heading">Today&apos;s evidence clock</h2>
        <p>Clock project work, capture optional GPS, and keep draft records visible before reports are generated.</p>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {loading ? <div className="notice-panel">Loading dashboard...</div> : null}

      <ClockPanel
        activeEntry={activeEntry}
        draftCount={draftCount}
        loading={loading}
        message={message}
        onAddManualEntry={() => navigate('/time-entries#manual-entry-form')}
        onClockIn={handleClockIn}
        onClockOut={handleClockOut}
        onGenerateReport={() => navigate('/progress-claims')}
        onUploadPhoto={() => navigate('/photo-evidence')}
        projects={activeProjects}
        submitting={submitting}
        todayHours={todayHours}
        weekHours={weekHours}
      />

      <section className="dashboard-section" aria-labelledby="recent-time-heading">
        <div className="section-heading">
          <h3 id="recent-time-heading">Recent time evidence</h3>
          <button className="ghost-button" type="button" onClick={() => navigate('/time-entries')}>
            View all
          </button>
        </div>
        <div className="record-list">
          {!loading && recentEntries.length === 0 ? <div className="notice-panel">No time entries yet.</div> : null}
          {recentEntries.map((entry) => (
            <article className="record-card" key={entry.id}>
              <div className="record-card-header">
                <div>
                  <h3>{projectName(entry.projectId, projects)}</h3>
                  <p>{formatDate(entry.date)} · {formatClockRange(entry)}</p>
                </div>
                <StatusBadge status={entry.status} tone={entry.status === 'FINALIZED' ? 'success' : 'warning'} />
              </div>
              <dl className="record-details">
                <div>
                  <dt>Total hours</dt>
                  <dd>{formatHours(entry.totalHours)}</dd>
                </div>
                <div>
                  <dt>Break</dt>
                  <dd>{entry.breakMinutes} min inclusive</dd>
                </div>
              </dl>
              <MapPreview
                clockIn={{ lat: entry.clockInGpsLat, lng: entry.clockInGpsLng }}
                clockOut={{ lat: entry.clockOutGpsLat, lng: entry.clockOutGpsLng }}
              />
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

interface GpsResult {
  coords: { lat: number; lng: number } | null;
  message?: string;
}

function captureGps(action: string): Promise<GpsResult> {
  if (!('geolocation' in navigator)) {
    return Promise.resolve({ coords: null, message: `GPS unavailable. ${capitalize(action)} saved without coordinates.` });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ coords: { lat: position.coords.latitude, lng: position.coords.longitude } }),
      () => resolve({ coords: null, message: `GPS was not captured. ${capitalize(action)} saved without coordinates.` }),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  });
}

function sumHours(entries: TimeEntry[]): number {
  return entries.reduce((sum, entry) => sum + Number(entry.totalHours || 0), 0);
}

function isToday(entry: TimeEntry): boolean {
  return dateKey(entry.date) === dateKey(new Date());
}

function isThisWeek(entry: TimeEntry): boolean {
  const entryDate = new Date(entry.date);
  const today = new Date();
  const start = new Date(today);
  const day = start.getDay() || 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return entryDate >= start && entryDate < end;
}

function dateKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function projectName(projectId: string, projects: Project[]): string {
  return projects.find((project) => project.id === projectId)?.projectName ?? 'Project unavailable';
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

function formatClockRange(entry: TimeEntry): string {
  const start = formatTime(entry.clockInTime);
  const end = entry.clockOutTime ? formatTime(entry.clockOutTime) : 'Active';
  return `${start} - ${end}`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-SG', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatHours(value: number): string {
  return `${Number(value || 0).toFixed(2)}h`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
