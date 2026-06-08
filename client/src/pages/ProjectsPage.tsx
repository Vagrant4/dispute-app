import { FormEvent, useEffect, useState } from 'react';
import {
  createProjectRequest,
  deleteProjectRequest,
  listCompaniesRequest,
  listProjectsRequest,
  updateProjectRequest,
  type Company,
  type Project,
  type ProjectInput,
  type ProjectStatus
} from '../api/http';
import { StatusBadge } from '../components/StatusBadge';

const emptyProjectForm: ProjectInput = {
  projectName: '',
  companyId: null,
  siteAddress: '',
  poOrWorkOrderNumber: null,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: null,
  description: '',
  defaultHourlyRate: null,
  defaultDailyRate: null,
  status: 'ACTIVE'
};

const projectStatuses: ProjectStatus[] = ['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];
const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ProjectsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<ProjectInput>(emptyProjectForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void loadPageData();
  }, []);

  async function loadPageData() {
    setLoading(true);
    setError('');
    try {
      const [nextCompanies, nextProjects] = await Promise.all([listCompaniesRequest(), listProjectsRequest()]);
      setCompanies(nextCompanies);
      setProjects(nextProjects);
    } catch (loadError) {
      setError(errorMessage(loadError, 'Unable to load projects'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = normalizeProject(form);
      const saved = editingId ? await updateProjectRequest(editingId, payload) : await createProjectRequest(payload);
      setProjects((current) => upsertProject(current, saved));
      resetForm();
      setSuccess(editingId ? 'Project updated.' : 'Project created.');
    } catch (submitError) {
      setError(errorMessage(submitError, 'Unable to save project'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(project: Project) {
    if (!window.confirm(`Delete ${project.projectName}? Evidence or pay records linked to it will prevent deletion.`)) return;

    setError('');
    setSuccess('');
    try {
      await deleteProjectRequest(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      if (editingId === project.id) resetForm();
      setSuccess('Project deleted.');
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Unable to delete project'));
    }
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setForm(projectToForm(project));
    setError('');
    setSuccess('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyProjectForm);
  }

  return (
    <section className="crud-page" aria-labelledby="projects-heading">
      <div className="page-heading">
        <p className="eyebrow">Projects</p>
        <h2 id="projects-heading">Projects</h2>
        <p>Set up each worksite or engagement so time entries, photos, and reports share the same evidence context.</p>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <div className="crud-layout">
        <form className="crud-form" onSubmit={handleSubmit} aria-label={editingId ? 'Edit project' : 'Create project'}>
          <h3>{editingId ? 'Edit project' : 'Add project'}</h3>
          <label>
            Project name
            <input value={form.projectName} onChange={(event) => updateField('projectName', event.target.value)} required />
          </label>
          <label>
            Company
            <select value={form.companyId ?? ''} onChange={(event) => updateField('companyId', optionalText(event.target.value))}>
              <option value="">No company selected</option>
              {companies.map((company) => (
                <option value={company.id} key={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
          <label className="span-full">
            Site address
            <textarea value={form.siteAddress} onChange={(event) => updateField('siteAddress', event.target.value)} required />
          </label>
          <label>
            PO / work order number
            <input
              value={form.poOrWorkOrderNumber ?? ''}
              onChange={(event) => updateField('poOrWorkOrderNumber', optionalText(event.target.value))}
            />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => updateField('status', event.target.value as ProjectStatus)}>
              {projectStatuses.map((status) => (
                <option value={status} key={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start date
            <input type="date" value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} required />
          </label>
          <label>
            End date
            <input type="date" value={form.endDate ?? ''} onChange={(event) => updateField('endDate', optionalText(event.target.value))} />
          </label>
          <label>
            Default hourly rate
            <input
              min="0"
              step="0.01"
              type="number"
              value={numberValue(form.defaultHourlyRate)}
              onChange={(event) => updateField('defaultHourlyRate', optionalNumber(event.target.value))}
            />
          </label>
          <label>
            Default daily rate
            <input
              min="0"
              step="0.01"
              type="number"
              value={numberValue(form.defaultDailyRate)}
              onChange={(event) => updateField('defaultDailyRate', optionalNumber(event.target.value))}
            />
          </label>
          <label className="span-full">
            Description
            <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} />
          </label>

          <div className="button-row span-full">
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Save project' : 'Create project'}
            </button>
            {editingId ? (
              <button className="ghost-button" type="button" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="record-list" aria-live="polite">
          {loading ? <div className="notice-panel">Loading projects...</div> : null}
          {!loading && projects.length === 0 ? <div className="notice-panel">No projects yet.</div> : null}
          {projects.map((project) => (
            <article className="record-card" key={project.id}>
              <div className="record-card-header">
                <div>
                  <h3>{project.projectName}</h3>
                  <p>{companyName(project.companyId, companies)}</p>
                </div>
                <StatusBadge status={project.status} />
              </div>
              <dl className="record-details">
                <div>
                  <dt>Site</dt>
                  <dd>{project.siteAddress}</dd>
                </div>
                <div>
                  <dt>Start</dt>
                  <dd>{formatDate(project.startDate)}</dd>
                </div>
                <div>
                  <dt>End</dt>
                  <dd>{project.endDate ? formatDate(project.endDate) : 'Open'}</dd>
                </div>
                <div>
                  <dt>Work order</dt>
                  <dd>{project.poOrWorkOrderNumber ?? 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Hourly</dt>
                  <dd>{formatMoney(project.defaultHourlyRate)}</dd>
                </div>
                <div>
                  <dt>Daily</dt>
                  <dd>{formatMoney(project.defaultDailyRate)}</dd>
                </div>
              </dl>
              {project.description ? <p className="record-note">{project.description}</p> : null}
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={() => startEdit(project)}>
                  Edit
                </button>
                <button
                  className="danger-button"
                  type="button"
                  aria-label={`Delete ${project.projectName}`}
                  onClick={() => void handleDelete(project)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );

  function updateField<Key extends keyof ProjectInput>(field: Key, value: ProjectInput[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
  }
}

function projectToForm(project: Project): ProjectInput {
  return {
    projectName: project.projectName,
    companyId: project.companyId ?? null,
    siteAddress: project.siteAddress,
    poOrWorkOrderNumber: project.poOrWorkOrderNumber ?? null,
    startDate: dateInputValue(project.startDate),
    endDate: project.endDate ? dateInputValue(project.endDate) : null,
    description: project.description,
    defaultHourlyRate: nullableDecimal(project.defaultHourlyRate),
    defaultDailyRate: nullableDecimal(project.defaultDailyRate),
    status: project.status
  };
}

function normalizeProject(project: ProjectInput): ProjectInput {
  return {
    projectName: project.projectName.trim(),
    companyId: optionalText(project.companyId),
    siteAddress: project.siteAddress.trim(),
    poOrWorkOrderNumber: optionalText(project.poOrWorkOrderNumber),
    startDate: project.startDate,
    endDate: optionalText(project.endDate),
    description: project.description.trim(),
    defaultHourlyRate: project.defaultHourlyRate,
    defaultDailyRate: project.defaultDailyRate,
    status: project.status
  };
}

function upsertProject(projects: Project[], project: Project): Project[] {
  const exists = projects.some((item) => item.id === project.id);
  if (exists) return projects.map((item) => (item.id === project.id ? project : item));
  return [project, ...projects];
}

function companyName(companyId: string | null | undefined, companies: Company[]): string {
  if (!companyId) return 'No company linked';
  return companies.find((company) => company.id === companyId)?.name ?? 'Company unavailable';
}

function statusLabel(status: ProjectStatus): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

function optionalNumber(value: string): number | null {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableDecimal(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberValue(value: number | null): string {
  return value === null ? '' : String(value);
}

function dateInputValue(value: string): string {
  return value.slice(0, 10);
}

function formatDate(value: string): string {
  const [year, month, day] = dateInputValue(value).split('-');
  const monthIndex = Number(month) - 1;

  if (!year || !day || monthLabels[monthIndex] === undefined) {
    return value;
  }

  return `${day.padStart(2, '0')} ${monthLabels[monthIndex]} ${year}`;
}

function formatMoney(value: string | number | null): string {
  if (value === null) return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(amount);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
