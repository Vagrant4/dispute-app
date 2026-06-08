import { FormEvent, useEffect, useState } from 'react';
import {
  deletePaySummaryRequest,
  generatePaySummaryRequest,
  listPaySummariesRequest,
  listProjectsRequest,
  type PayLineItemInput,
  type PaySummary,
  type Project
} from '../api/http';

interface PayForm {
  projectId: string;
  salaryPeriodStart: string;
  salaryPeriodEnd: string;
  basicRate: string;
  overtimeRate: string;
  restDayPay: string;
  publicHolidayPay: string;
  allowances: string;
  deductions: string;
  notes: string;
}

const payslipFields = [
  'workerName',
  'clientCompanyName',
  'paymentDate',
  'salaryPeriodStart',
  'salaryPeriodEnd',
  'rateType',
  'basicRate',
  'overtimeRate',
  'regularHours',
  'overtimeHours',
  'basicPay',
  'overtimePay',
  'totalAllowances',
  'totalDeductions',
  'grossPay',
  'netPay'
];

export function PaySummaryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [summaries, setSummaries] = useState<PaySummary[]>([]);
  const [form, setForm] = useState<PayForm>(() => createEmptyForm());
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
      const [nextProjects, nextSummaries] = await Promise.all([listProjectsRequest(), listPaySummariesRequest()]);
      setProjects(nextProjects);
      setSummaries(nextSummaries);
    } catch (loadError) {
      setError(errorMessage(loadError, 'Unable to load pay summaries'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const parsed = parsePayForm(form);
    if (typeof parsed === 'string') {
      setError(parsed);
      return;
    }

    setSubmitting(true);
    try {
      const saved = await generatePaySummaryRequest(parsed);
      setSummaries((current) => [saved, ...current]);
      setSuccess('Pay summary generated.');
    } catch (submitError) {
      setError(errorMessage(submitError, 'Unable to generate pay summary'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(summary: PaySummary) {
    if (!window.confirm('Delete this pay summary?')) return;

    setError('');
    setSuccess('');
    try {
      await deletePaySummaryRequest(summary.id);
      setSummaries((current) => current.filter((item) => item.id !== summary.id));
      setSuccess('Pay summary deleted.');
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Unable to delete pay summary'));
    }
  }

  return (
    <section className="crud-page" aria-labelledby="pay-summary-heading">
      <div className="page-heading">
        <p className="eyebrow">Pay summary</p>
        <h2 id="pay-summary-heading">Pay summary</h2>
        <p>Generate worker-facing pay summaries from finalized time entries, rate inputs, and itemised additions or deductions.</p>
      </div>

      <div className="notice-panel warning-note">
        Check MOM rules before relying on this for statutory payroll. Part 4 Employment Act eligibility depends on worker category,
        salary level, and job scope.
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <div className="crud-layout">
        <form className="crud-form" onSubmit={handleSubmit} aria-label="Generate pay summary">
          <h3>Generate summary</h3>
          <label>
            Project
            <select value={form.projectId} onChange={(event) => updateField('projectId', event.target.value)}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Salary period start
            <input type="date" value={form.salaryPeriodStart} onChange={(event) => updateField('salaryPeriodStart', event.target.value)} required />
          </label>
          <label>
            Salary period end
            <input type="date" value={form.salaryPeriodEnd} onChange={(event) => updateField('salaryPeriodEnd', event.target.value)} required />
          </label>
          <label>
            Basic hourly rate
            <input min="0" step="0.01" type="number" value={form.basicRate} onChange={(event) => updateField('basicRate', event.target.value)} required />
          </label>
          <label>
            Overtime hourly rate
            <input min="0" step="0.01" type="number" value={form.overtimeRate} onChange={(event) => updateField('overtimeRate', event.target.value)} />
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
            Allowances
            <textarea value={form.allowances} onChange={(event) => updateField('allowances', event.target.value)} placeholder="Transport | 25" />
          </label>
          <label className="span-full">
            Deductions
            <textarea value={form.deductions} onChange={(event) => updateField('deductions', event.target.value)} placeholder="Advance | 10" />
          </label>
          <label className="span-full">
            Notes
            <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
          </label>
          <button className="primary-button form-action" type="submit" disabled={submitting}>
            {submitting ? 'Generating...' : 'Generate pay summary'}
          </button>
        </form>

        <div className="record-list" aria-live="polite">
          {loading ? <div className="notice-panel">Loading pay summaries...</div> : null}
          {!loading && summaries.length === 0 ? <div className="notice-panel">No pay summaries yet.</div> : null}
          {summaries.map((summary) => {
            const itemised = parseJsonObject(summary.itemisedPayslipJson);
            return (
              <article className="record-card" key={summary.id}>
                <div className="record-card-header">
                  <div>
                    <h3>{projectName(summary.projectId, projects)}</h3>
                    <p>{formatDate(summary.salaryPeriodStart)} to {formatDate(summary.salaryPeriodEnd)}</p>
                  </div>
                  <strong>{formatMoney(summary.netPay)}</strong>
                </div>
                <dl className="record-details">
                  <div>
                    <dt>Basic pay</dt>
                    <dd>{formatMoney(summary.basicPay)}</dd>
                  </div>
                  <div>
                    <dt>Overtime pay</dt>
                    <dd>{formatMoney(summary.overtimePay)}</dd>
                  </div>
                  <div>
                    <dt>Allowances</dt>
                    <dd>{formatMoney(summary.totalAllowances)}</dd>
                  </div>
                  <div>
                    <dt>Deductions</dt>
                    <dd>{formatMoney(summary.totalDeductions)}</dd>
                  </div>
                  <div>
                    <dt>Gross pay</dt>
                    <dd>{formatMoney(summary.grossPay)}</dd>
                  </div>
                  <div>
                    <dt>Net pay</dt>
                    <dd>{formatMoney(summary.netPay)}</dd>
                  </div>
                </dl>
                {itemised ? (
                  <dl className="record-details compact-details">
                    {payslipFields.map((field) => (
                      <div key={field}>
                        <dt>{labelFromCode(field)}</dt>
                        <dd>{displayValue(itemised[field])}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {summary.notes ? <p className="record-note">{summary.notes}</p> : null}
                <div className="button-row">
                  <button className="danger-button" type="button" onClick={() => void handleDelete(summary)}>
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

  function updateField<Key extends keyof PayForm>(field: Key, value: PayForm[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
  }
}

function createEmptyForm(): PayForm {
  const today = localDateInputValue();
  return {
    projectId: '',
    salaryPeriodStart: today,
    salaryPeriodEnd: today,
    basicRate: '',
    overtimeRate: '',
    restDayPay: '',
    publicHolidayPay: '',
    allowances: '',
    deductions: '',
    notes: ''
  };
}

function parsePayForm(form: PayForm): ReturnType<typeof generatePaySummaryPayload> | string {
  try {
    return generatePaySummaryPayload(form);
  } catch (error) {
    return errorMessage(error, 'Invalid pay summary form');
  }
}

function generatePaySummaryPayload(form: PayForm) {
  if (!form.salaryPeriodStart || !form.salaryPeriodEnd) throw new Error('Salary period dates are required.');
  if (form.salaryPeriodEnd < form.salaryPeriodStart) throw new Error('Salary period end must be on or after start.');
  const basicRate = requiredMoney(form.basicRate, 'Basic hourly rate');
  return {
    projectId: form.projectId || null,
    salaryPeriodStart: form.salaryPeriodStart,
    salaryPeriodEnd: form.salaryPeriodEnd,
    rateType: 'HOURLY' as const,
    basicRate,
    overtimeRate: optionalMoney(form.overtimeRate),
    restDayPay: optionalMoney(form.restDayPay) ?? 0,
    publicHolidayPay: optionalMoney(form.publicHolidayPay) ?? 0,
    allowances: parseLineItems(form.allowances),
    deductions: parseLineItems(form.deductions),
    notes: form.notes.trim()
  };
}

function parseLineItems(value: string): PayLineItemInput[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [description, amountText] = line.split('|').map((part) => part.trim());
      if (!description || !amountText) throw new Error('Line items must use "Description | amount".');
      return { description, amount: requiredMoney(amountText, description) };
    });
}

function requiredMoney(value: string, label: string): number {
  const amount = optionalMoney(value);
  if (amount === undefined) throw new Error(`${label} is required.`);
  return amount;
}

function optionalMoney(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Money fields must be zero or more.');
  return amount;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function projectName(projectId: string | null, projects: Project[]): string {
  if (!projectId) return 'All projects';
  return projects.find((project) => project.id === projectId)?.projectName ?? 'Project unavailable';
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

function formatMoney(value: string | number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not available';
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(amount);
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : 'None';
  return String(value);
}

function labelFromCode(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()).trim();
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
