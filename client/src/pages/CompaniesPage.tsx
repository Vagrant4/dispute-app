import { FormEvent, useEffect, useState } from 'react';
import {
  createCompanyRequest,
  deleteCompanyRequest,
  listCompaniesRequest,
  updateCompanyRequest,
  type Company,
  type CompanyInput
} from '../api/http';

const emptyCompanyForm: CompanyInput = {
  name: '',
  uen: null,
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  notes: ''
};

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState<CompanyInput>(emptyCompanyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void loadCompanies();
  }, []);

  async function loadCompanies() {
    setLoading(true);
    setError('');
    try {
      setCompanies(await listCompaniesRequest());
    } catch (loadError) {
      setError(errorMessage(loadError, 'Unable to load companies'));
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
      const payload = normalizeCompany(form);
      const saved = editingId ? await updateCompanyRequest(editingId, payload) : await createCompanyRequest(payload);
      setCompanies((current) => upsertCompany(current, saved));
      resetForm();
      setSuccess(editingId ? 'Company updated.' : 'Company created.');
    } catch (submitError) {
      setError(errorMessage(submitError, 'Unable to save company'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(company: Company) {
    if (!window.confirm(`Delete ${company.name}? Projects linked to this company should be reassigned first.`)) return;

    setError('');
    setSuccess('');
    try {
      await deleteCompanyRequest(company.id);
      setCompanies((current) => current.filter((item) => item.id !== company.id));
      if (editingId === company.id) resetForm();
      setSuccess('Company deleted.');
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Unable to delete company'));
    }
  }

  function startEdit(company: Company) {
    setEditingId(company.id);
    setForm(companyToForm(company));
    setError('');
    setSuccess('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyCompanyForm);
  }

  return (
    <section className="crud-page" aria-labelledby="companies-heading">
      <div className="page-heading">
        <p className="eyebrow">Clients</p>
        <h2 id="companies-heading">Clients / Companies</h2>
        <p>Record client contact and address details so project evidence has clear business context.</p>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <div className="crud-layout">
        <form className="crud-form" onSubmit={handleSubmit} aria-label={editingId ? 'Edit company' : 'Create company'}>
          <h3>{editingId ? 'Edit company' : 'Add company'}</h3>
          <label>
            Company name
            <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
          </label>
          <label>
            UEN
            <input value={form.uen ?? ''} onChange={(event) => updateField('uen', optionalText(event.target.value))} />
          </label>
          <label>
            Contact person
            <input value={form.contactPerson} onChange={(event) => updateField('contactPerson', event.target.value)} required />
          </label>
          <label>
            Email
            <input
              inputMode="email"
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              required
            />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} required />
          </label>
          <label className="span-full">
            Address
            <textarea value={form.address} onChange={(event) => updateField('address', event.target.value)} required />
          </label>
          <label className="span-full">
            Notes
            <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
          </label>

          <div className="button-row span-full">
            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Save company' : 'Create company'}
            </button>
            {editingId ? (
              <button className="ghost-button" type="button" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="record-list" aria-live="polite">
          {loading ? <div className="notice-panel">Loading companies...</div> : null}
          {!loading && companies.length === 0 ? <div className="notice-panel">No companies yet.</div> : null}
          {companies.map((company) => (
            <article className="record-card" key={company.id}>
              <div className="record-card-header">
                <div>
                  <h3>{company.name}</h3>
                  <p>{company.contactPerson}</p>
                </div>
              </div>
              <dl className="record-details">
                <div>
                  <dt>Email</dt>
                  <dd>{company.email}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{company.phone}</dd>
                </div>
                <div>
                  <dt>UEN</dt>
                  <dd>{company.uen ?? 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{company.address}</dd>
                </div>
              </dl>
              {company.notes ? <p className="record-note">{company.notes}</p> : null}
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={() => startEdit(company)}>
                  Edit
                </button>
                <button
                  className="danger-button"
                  type="button"
                  aria-label={`Delete ${company.name}`}
                  onClick={() => void handleDelete(company)}
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

  function updateField<Key extends keyof CompanyInput>(field: Key, value: CompanyInput[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
  }
}

function companyToForm(company: Company): CompanyInput {
  return {
    name: company.name,
    uen: company.uen ?? null,
    contactPerson: company.contactPerson,
    email: company.email,
    phone: company.phone,
    address: company.address,
    notes: company.notes
  };
}

function normalizeCompany(company: CompanyInput): CompanyInput {
  return {
    name: company.name.trim(),
    uen: optionalText(company.uen),
    contactPerson: company.contactPerson.trim(),
    email: company.email.trim(),
    phone: company.phone.trim(),
    address: company.address.trim(),
    notes: company.notes.trim()
  };
}

function upsertCompany(companies: Company[], company: Company): Company[] {
  const exists = companies.some((item) => item.id === company.id);
  if (exists) return companies.map((item) => (item.id === company.id ? company : item));
  return [company, ...companies];
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
