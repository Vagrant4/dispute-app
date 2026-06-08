import { FormEvent, useEffect, useState } from 'react';
import {
  deleteReportRequest,
  downloadReportFileRequest,
  generateProgressClaimReportRequest,
  listProjectsRequest,
  listReportsRequest,
  type ProgressReport,
  type Project
} from '../api/http';

interface ReportForm {
  projectId: string;
  claimPeriodStart: string;
  claimPeriodEnd: string;
  hourlyRate: string;
  overtimeRate: string;
  allowances: string;
  deductions: string;
  restDayPay: string;
  publicHolidayPay: string;
  notes: string;
}

export function ReportsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [form, setForm] = useState<ReportForm>(() => createEmptyForm());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState('');
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

  async function loadPageData() {
    setLoading(true);
    setError('');
    try {
      const [nextProjects, nextReports] = await Promise.all([listProjectsRequest(), listReportsRequest()]);
      setProjects(nextProjects);
      setReports(nextReports);
    } catch (loadError) {
      setError(errorMessage(loadError, 'Unable to load reports'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const payload = parseReportForm(form);
    if (typeof payload === 'string') {
      setError(payload);
      return;
    }

    setSubmitting(true);
    try {
      const saved = await generateProgressClaimReportRequest(payload);
      setReports((current) => [saved, ...current]);
      setSuccess('Progress claim report generated.');
    } catch (submitError) {
      setError(errorMessage(submitError, 'Unable to generate report'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload(report: ProgressReport, format: 'pdf' | 'csv') {
    setError('');
    setSuccess('');
    const key = `${report.id}-${format}`;
    setDownloading(key);
    try {
      const blob = await downloadReportFileRequest(report.id, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `progress-claim-${report.id}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSuccess(`${format.toUpperCase()} download started.`);
    } catch (downloadError) {
      setError(errorMessage(downloadError, `Unable to download ${format.toUpperCase()}`));
    } finally {
      setDownloading('');
    }
  }

  async function handleDelete(report: ProgressReport) {
    if (!window.confirm('Delete this progress claim report?')) return;

    setError('');
    setSuccess('');
    try {
      await deleteReportRequest(report.id);
      setReports((current) => current.filter((item) => item.id !== report.id));
      setSuccess('Report deleted.');
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Unable to delete report'));
    }
  }

  return (
    <section className="crud-page" aria-labelledby="reports-heading">
      <div className="page-heading">
        <p className="eyebrow">Progress claims</p>
        <h2 id="reports-heading">Progress claim reports</h2>
        <p>Generate PDF and CSV claim packs from finalized work, photos, and pay-rate inputs for dispute-ready documentation.</p>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <div className="crud-layout">
        <form className="crud-form" onSubmit={handleSubmit} aria-label="Generate progress claim">
          <h3>Generate report</h3>
          <label>
            Project
            <select value={form.projectId} onChange={(event) => updateField('projectId', event.target.value)} required>
              {projects.length === 0 ? <option value="">No projects yet</option> : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Claim period start
            <input type="date" value={form.claimPeriodStart} onChange={(event) => updateField('claimPeriodStart', event.target.value)} required />
          </label>
          <label>
            Claim period end
            <input type="date" value={form.claimPeriodEnd} onChange={(event) => updateField('claimPeriodEnd', event.target.value)} required />
          </label>
          <label>
            Hourly rate
            <input min="0" step="0.01" type="number" value={form.hourlyRate} onChange={(event) => updateField('hourlyRate', event.target.value)} />
          </label>
          <label>
            Overtime rate
            <input min="0" step="0.01" type="number" value={form.overtimeRate} onChange={(event) => updateField('overtimeRate', event.target.value)} />
          </label>
          <label>
            Allowances total
            <input min="0" step="0.01" type="number" value={form.allowances} onChange={(event) => updateField('allowances', event.target.value)} />
          </label>
          <label>
            Deductions total
            <input min="0" step="0.01" type="number" value={form.deductions} onChange={(event) => updateField('deductions', event.target.value)} />
          </label>
          <label>
            Rest day pay
            <input min="0" step="0.01" type="number" value={form.restDayPay} onChange={(event) => updateField('restDayPay', event.target.value)} />
          </label>
          <label>
            Public holiday pay
            <input min="0" step="0.01" type="number" value={form.publicHolidayPay} onChange={(event) => updateField('publicHolidayPay', event.target.value)} />
          </label>
          <label className="span-full">
            Notes
            <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
          </label>
          <button className="primary-button form-action" type="submit" disabled={submitting || projects.length === 0}>
            {submitting ? 'Generating...' : 'Generate progress claim'}
          </button>
        </form>

        <div className="record-list" aria-live="polite">
          {loading ? <div className="notice-panel">Loading reports...</div> : null}
          {!loading && reports.length === 0 ? <div className="notice-panel">No reports yet.</div> : null}
          {reports.map((report) => {
            const entries = parseJsonArray(report.entriesSnapshotJson);
            const photos = parseJsonArray(report.photosSnapshotJson);
            return (
              <article className="record-card" key={report.id}>
                <div className="record-card-header">
                  <div>
                    <h3>{projectName(report.projectId, projects)}</h3>
                    <p>{formatDate(report.claimPeriodStart)} to {formatDate(report.claimPeriodEnd)}</p>
                  </div>
                  <strong>{formatMoney(report.totalClaimAmount)}</strong>
                </div>
                <dl className="record-details">
                  <div>
                    <dt>Total days</dt>
                    <dd>{report.totalDaysWorked}</dd>
                  </div>
                  <div>
                    <dt>Total hours</dt>
                    <dd>{formatHours(report.totalHours)}</dd>
                  </div>
                  <div>
                    <dt>OT hours</dt>
                    <dd>{formatHours(report.totalOvertimeHours)}</dd>
                  </div>
                  <div>
                    <dt>Claim amount</dt>
                    <dd>{formatMoney(report.totalClaimAmount)}</dd>
                  </div>
                  <div>
                    <dt>Snapshot entries</dt>
                    <dd>{entries.length}</dd>
                  </div>
                  <div>
                    <dt>Snapshot photos</dt>
                    <dd>{photos.length}</dd>
                  </div>
                </dl>
                {report.notes ? <p className="record-note">{report.notes}</p> : null}
                <div className="button-row">
                  <button className="primary-button" type="button" disabled={downloading === `${report.id}-pdf`} onClick={() => void handleDownload(report, 'pdf')}>
                    PDF
                  </button>
                  <button className="ghost-button" type="button" disabled={downloading === `${report.id}-csv`} onClick={() => void handleDownload(report, 'csv')}>
                    CSV
                  </button>
                  <button className="danger-button" type="button" onClick={() => void handleDelete(report)}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );

  function updateField<Key extends keyof ReportForm>(field: Key, value: ReportForm[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
  }
}

function createEmptyForm(): ReportForm {
  const today = localDateInputValue();
  return {
    projectId: '',
    claimPeriodStart: today,
    claimPeriodEnd: today,
    hourlyRate: '',
    overtimeRate: '',
    allowances: '',
    deductions: '',
    restDayPay: '',
    publicHolidayPay: '',
    notes: ''
  };
}

function parseReportForm(form: ReportForm) {
  if (!form.projectId) return 'Choose a project before generating a report.';
  if (!form.claimPeriodStart || !form.claimPeriodEnd) return 'Claim period dates are required.';
  if (form.claimPeriodEnd < form.claimPeriodStart) return 'Claim period end must be on or after start.';
  try {
    return {
      projectId: form.projectId,
      claimPeriodStart: form.claimPeriodStart,
      claimPeriodEnd: form.claimPeriodEnd,
      hourlyRate: optionalMoney(form.hourlyRate),
      overtimeRate: optionalMoney(form.overtimeRate),
      allowances: optionalMoney(form.allowances) ?? 0,
      deductions: optionalMoney(form.deductions) ?? 0,
      restDayPay: optionalMoney(form.restDayPay) ?? 0,
      publicHolidayPay: optionalMoney(form.publicHolidayPay) ?? 0,
      notes: form.notes.trim()
    };
  } catch (error) {
    return errorMessage(error, 'Invalid report form');
  }
}

function optionalMoney(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Money fields must be zero or more.');
  return amount;
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function projectName(projectId: string, projects: Project[]): string {
  return projects.find((project) => project.id === projectId)?.projectName ?? 'Project unavailable';
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

function formatHours(value: number): string {
  return `${Number(value || 0).toFixed(2)}h`;
}

function formatMoney(value: string | number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not available';
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(amount);
}

function localDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
