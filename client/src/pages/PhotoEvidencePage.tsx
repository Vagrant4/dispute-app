import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  deletePhotoEvidenceRequest,
  listPhotoEvidenceRequest,
  listProjectsRequest,
  listTimeEntriesRequest,
  uploadPhotoEvidenceRequest,
  type EvidenceType,
  type PhotoEvidence,
  type Project,
  type TimeEntry
} from '../api/http';
import { StatusBadge } from '../components/StatusBadge';

const evidenceTypes: EvidenceType[] = [
  'BEFORE_WORK',
  'DURING_WORK',
  'AFTER_WORK',
  'DEFECT',
  'COMPLETED_WORK',
  'MATERIAL_DELIVERY',
  'VARIATION_WORK',
  'OTHER'
];

export function PhotoEvidencePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [evidence, setEvidence] = useState<PhotoEvidence[]>([]);
  const [projectId, setProjectId] = useState('');
  const [timeEntryId, setTimeEntryId] = useState('');
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('DURING_WORK');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsMessage, setGpsMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void loadPageData();
  }, []);

  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id);
  }, [projectId, projects]);

  const linkedTimeEntries = useMemo(
    () => timeEntries.filter((entry) => entry.projectId === projectId),
    [projectId, timeEntries]
  );

  async function loadPageData() {
    setLoading(true);
    setError('');
    try {
      const [nextProjects, nextTimeEntries, nextEvidence] = await Promise.all([
        listProjectsRequest(),
        listTimeEntriesRequest(),
        listPhotoEvidenceRequest()
      ]);
      setProjects(nextProjects);
      setTimeEntries(nextTimeEntries);
      setEvidence(nextEvidence);
    } catch (loadError) {
      setError(errorMessage(loadError, 'Unable to load photo evidence'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!projectId) {
      setError('Choose a project before uploading evidence.');
      return;
    }
    if (!file) {
      setError('Choose an image file to upload.');
      return;
    }

    setSubmitting(true);
    try {
      const saved = await uploadPhotoEvidenceRequest({
        file,
        projectId,
        timeEntryId: timeEntryId || null,
        evidenceType,
        caption: caption.trim(),
        timestamp: new Date().toISOString(),
        gpsLat: gps?.lat ?? null,
        gpsLng: gps?.lng ?? null
      });
      setEvidence((current) => [saved, ...current]);
      setCaption('');
      setFile(null);
      setFileInputKey((current) => current + 1);
      setTimeEntryId('');
      setGps(null);
      setGpsMessage('');
      setSuccess('Photo evidence uploaded.');
    } catch (submitError) {
      setError(errorMessage(submitError, 'Unable to upload photo evidence'));
    } finally {
      setSubmitting(false);
    }
  }

  function captureGps() {
    setGpsMessage('');
    if (!navigator.geolocation) {
      setGpsMessage('GPS is not available in this browser. Upload can continue without it.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGpsMessage('GPS captured for this evidence record.');
      },
      () => setGpsMessage('GPS capture failed. Upload can continue without it.'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function handleDelete(item: PhotoEvidence) {
    if (!window.confirm('Delete this photo evidence record?')) return;

    setError('');
    setSuccess('');
    try {
      await deletePhotoEvidenceRequest(item.id);
      setEvidence((current) => current.filter((record) => record.id !== item.id));
      setSuccess('Photo evidence deleted.');
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Unable to delete photo evidence'));
    }
  }

  return (
    <section className="crud-page" aria-labelledby="photo-evidence-heading">
      <div className="page-heading">
        <p className="eyebrow">Photo evidence</p>
        <h2 id="photo-evidence-heading">Photo evidence</h2>
        <p>Attach timestamped worksite photos to projects and time entries so reports have clear visual support.</p>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <div className="crud-layout">
        <form className="crud-form" onSubmit={handleSubmit} aria-label="Upload photo evidence">
          <h3>Upload evidence</h3>
          <label>
            Project
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
              {projects.length === 0 ? <option value="">No projects yet</option> : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time entry
            <select value={timeEntryId} onChange={(event) => setTimeEntryId(event.target.value)}>
              <option value="">No time entry link</option>
              {linkedTimeEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {formatDate(entry.date)} - {entry.workDescription || 'Time entry'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Evidence type
            <select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as EvidenceType)}>
              {evidenceTypes.map((type) => (
                <option key={type} value={type}>
                  {labelFromCode(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Image
            <input
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              key={fileInputKey}
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </label>
          <label className="span-full">
            Caption
            <textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="What does this photo prove?" />
          </label>
          <div className="span-full evidence-gps-row">
            <button className="ghost-button" type="button" onClick={captureGps}>
              Capture GPS
            </button>
            <span>{gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : gpsMessage || 'Optional GPS evidence'}</span>
          </div>
          <button className="primary-button form-action" type="submit" disabled={submitting || projects.length === 0}>
            {submitting ? 'Uploading...' : 'Upload photo'}
          </button>
        </form>

        <div className="record-list" aria-live="polite">
          {loading ? <div className="notice-panel">Loading photo evidence...</div> : null}
          {!loading && evidence.length === 0 ? <div className="notice-panel">No photo evidence yet.</div> : null}
          {evidence.map((item) => (
            <article className="record-card" key={item.id}>
              <div className="record-card-header">
                <div>
                  <h3>{projectPath(item.projectId, projects)}</h3>
                  <p>{formatDateTime(item.timestamp)}</p>
                </div>
                <StatusBadge status={item.evidenceType} label={labelFromCode(item.evidenceType)} tone="neutral" />
              </div>
              <dl className="record-details">
                <div>
                  <dt>Caption</dt>
                  <dd>{item.caption || 'No caption recorded'}</dd>
                </div>
                <div>
                  <dt>Time entry</dt>
                  <dd>{timeEntryLabel(item.timeEntryId, timeEntries)}</dd>
                </div>
                <div>
                  <dt>GPS</dt>
                  <dd>{item.gpsLat !== null && item.gpsLng !== null ? `${item.gpsLat}, ${item.gpsLng}` : 'Not captured'}</dd>
                </div>
                <div>
                  <dt>Stored file</dt>
                  <dd>{item.imagePath}</dd>
                </div>
              </dl>
              <div className="button-row">
                <button className="danger-button" type="button" onClick={() => void handleDelete(item)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function projectPath(projectId: string, projects: Project[]): string {
  const project = projects.find((item) => item.id === projectId);
  return project ? `${project.projectName} / ${project.siteAddress}` : 'Project unavailable';
}

function timeEntryLabel(timeEntryId: string | null, timeEntries: TimeEntry[]): string {
  if (!timeEntryId) return 'Not linked';
  const entry = timeEntries.find((item) => item.id === timeEntryId);
  return entry ? `${formatDate(entry.date)} - ${entry.workDescription || 'Time entry'}` : 'Time entry unavailable';
}

function labelFromCode(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
