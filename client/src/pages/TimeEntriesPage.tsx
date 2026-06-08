import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createTimeEntryRequest,
  finalizeTimeEntryRequest,
  listProjectsRequest,
  listTimeEntriesRequest,
  type Project,
  type TimeEntry
} from '../api/http';
import { MapPreview } from '../components/MapPreview';
import { StatusBadge } from '../components/StatusBadge';

interface ManualEntryForm {
  projectId: string;
  date: string;
  clockInTime: string;
  clockOutTime: string;
  breakMinutes: string;
  workDescription: string;
  locationText: string;
  notes: string;
}

export function TimeEntriesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [form, setForm] = useState<ManualEntryForm>(() => createEmptyForm());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void loadPageData();
  }, []);

  useEffect(() => {
    if (!form.projectId && projects[0]) {
      setForm((current) => ({ ...current, projectId: projects[0].id }));
    }
  }, [form.projectId, projects]);

  const activeProjects = useMemo(() => projects.filter((project) => project.status === 'ACTIVE'), [projects]);

  async function loadPageData() {
    setLoading(true);
    setError('');
    try {
      const [nextProjects, nextTimeEntries] = await Promise.all([listProjectsRequest(), listTimeEntriesRequest()]);
      setProjects(nextProjects);
      setTimeEntries(nextTimeEntries);
    } catch (loadError) {
      setError(errorMessage(loadError, 'Unable to load time entries'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateManualEntry(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const saved = await createTimeEntryRequest({
        projectId: form.projectId,
        date: form.date,
        clockInTime: toIso(form.date, form.clockInTime),
        clockOutTime: toIso(form.date, form.clockOutTime),
        breakMinutes: Number(form.breakMinutes || 0),
        workDescription: form.workDescription.trim(),
        locationText: form.locationText.trim(),
        notes: form.notes.trim(),
        manualEntryFlag: true
      });
      setTimeEntries((current) => [saved, ...current]);
      setForm(createEmptyForm(form.projectId));
      setSuccess('Manual time entry saved as a draft.');
    } catch (submitError) {
      setError(errorMessage(submitError, 'Unable to save manual time entry'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinalize(entry: TimeEntry) {
    setError('');
    setSuccess('');
    setFinalizingId(entry.id);
    try {
      const saved = await finalizeTimeEntryRequest(entry.id);
      setTimeEntries((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setSuccess('Time entry finalized for claim reporting.');
    } catch (finalizeError) {
      setError(errorMessage(finalizeError, 'Unable to finalize time entry'));
    } finally {
      setFinalizingId(null);
    }
  }

  return (
    <section className="crud-page time-page" aria-labelledby="time-entries-heading">
      <div className="page-heading">
        <p className="eyebrow">Time entries</p>
        <h2 id="time-entries-heading">Time evidence records</h2>
        <p>Review clocked work, add manual records, and finalize completed entries for later progress claim reports.</p>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <div className="crud-layout">
        <form id="manual-entry-form" className="crud-form" onSubmit={handleSubmit} aria-label="Add manual time entry">
          <h3>Add manual entry</h3>
          <label>
            Project
            <select value={form.projectId} onChange={(event) => updateField('projectId', event.target.value)} required>
              {activeProjects.length === 0 ? <option value="">No active projects</option> : null}
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} required />
          </label>
          <label>
            Clock in
            <input type="time" value={form.clockInTime} onChange={(event) => updateField('clockInTime', event.target.value)} required />
          </label>
          <label>
            Clock out
            <input type="time" value={form.clockOutTime} onChange={(event) => updateField('clockOutTime', event.target.value)} required />
          </label>
          <label>
            Break minutes
            <input
              min="0"
              step="1"
              type="number"
              value={form.breakMinutes}
              onChange={(event) => updateField('breakMinutes', event.target.value)}
            />
          </label>
          <label>
            Location note
            <input value={form.locationText} onChange={(event) => updateField('locationText', event.target.value)} />
          </label>
          <label className="span-full">
            Work description
            <textarea value={form.workDescription} onChange={(event) => updateField('workDescription', event.target.value)} required />
          </label>
          <label className="span-full">
            Notes
            <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
          </label>
          <button className="primary-button form-action" type="submit" disabled={submitting || activeProjects.length === 0}>
            {submitting ? 'Saving...' : 'Save manual entry'}
          </button>
        </form>

        <div className="record-list" aria-live="polite">
          {loading ? <div className="notice-panel">Loading time entries...</div> : null}
          {!loading && timeEntries.length === 0 ? <div className="notice-panel">No time entries yet.</div> : null}
          {timeEntries.map((entry) => (
            <article className="record-card time-entry-card" key={entry.id}>
              <div className="record-card-header">
                <div>
                  <h3>{projectName(entry.projectId, projects)}</h3>
                  <p>{formatDate(entry.date)} · {formatClockRange(entry)}</p>
                </div>
                <div className="badge-stack">
                  <StatusBadge status={entry.status} tone={entry.status === 'FINALIZED' ? 'success' : 'warning'} />
                  {entry.manualEntryFlag ? <StatusBadge status="MANUAL" label="Manual" tone="neutral" /> : null}
                </div>
              </div>

              <dl className="record-details">
                <div>
                  <dt>On-site duration</dt>
                  <dd>{entry.clockOutTime ? formatDuration(new Date(entry.clockOutTime).getTime() - new Date(entry.clockInTime).getTime()) : 'Active'}</dd>
                </div>
                <div>
                  <dt>Inclusive break</dt>
                  <dd>{entry.breakMinutes} min</dd>
                </div>
                <div>
                  <dt>Total hours</dt>
                  <dd>{formatHours(entry.totalHours)}</dd>
                </div>
                <div>
                  <dt>Overtime hours</dt>
                  <dd>{formatHours(entry.overtimeHours)}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{entry.locationText || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Status notes</dt>
                  <dd>{entry.notes || entry.workDescription || 'No notes'}</dd>
                </div>
              </dl>

              {entry.workDescription ? <p className="record-note">{entry.workDescription}</p> : null}
              <MapPreview
                clockIn={{ lat: entry.clockInGpsLat, lng: entry.clockInGpsLng }}
                clockOut={{ lat: entry.clockOutGpsLat, lng: entry.clockOutGpsLng }}
              />
              {entry.status === 'DRAFT' ? (
                <div className="button-row">
                  <button
                    className="primary-button"
                    type="button"
                    disabled={finalizingId === entry.id || !entry.clockOutTime}
                    onClick={() => void handleFinalize(entry)}
                  >
                    {finalizingId === entry.id ? 'Finalizing...' : 'Finalize'}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );

  function updateField<Key extends keyof ManualEntryForm>(field: Key, value: ManualEntryForm[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
  }
}

function createEmptyForm(projectId = ''): ManualEntryForm {
  return {
    projectId,
    date: localDateInputValue(),
    clockInTime: '09:00',
    clockOutTime: '18:00',
    breakMinutes: '60',
    workDescription: '',
    locationText: '',
    notes: ''
  };
}

function validateManualEntry(form: ManualEntryForm): string {
  if (!form.projectId) return 'Choose a project before saving a manual entry.';
  if (!form.date || !form.clockInTime || !form.clockOutTime) return 'Date, clock-in, and clock-out times are required.';
  const clockIn = new Date(toIso(form.date, form.clockInTime));
  const clockOut = new Date(toIso(form.date, form.clockOutTime));
  if (clockOut <= clockIn) return 'Clock out must be after clock in.';
  const breakMinutes = Number(form.breakMinutes || 0);
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) return 'Break minutes must be zero or more.';
  const durationMinutes = (clockOut.getTime() - clockIn.getTime()) / 60000;
  if (breakMinutes > durationMinutes) return 'Break minutes cannot exceed the on-site duration.';
  if (!form.workDescription.trim()) return 'Work description is required for evidence quality.';
  return '';
}

function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function localDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
