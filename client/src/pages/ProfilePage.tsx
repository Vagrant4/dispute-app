import { FormEvent, useEffect, useState } from 'react';
import {
  getProfileRequest,
  saveProfileRequest,
  type WorkerProfile,
  type WorkerProfileInput
} from '../api/http';

const emptyProfileForm: WorkerProfileInput = {
  fullName: '',
  phone: '',
  workerIdentifier: null,
  finNric: null,
  trade: '',
  employmentType: 'FREELANCER',
  defaultHourlyRate: null,
  defaultDailyRate: null,
  defaultMonthlySalary: null
};

export function ProfilePage() {
  const [form, setForm] = useState<WorkerProfileInput>(emptyProfileForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError('');
      try {
        const profile = await getProfileRequest();
        if (active && profile) {
          setForm(profileToForm(profile));
        }
      } catch (loadError) {
        if (active) setError(errorMessage(loadError, 'Unable to load profile'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const profile = await saveProfileRequest(normalizeProfile(form));
      setForm(profileToForm(profile));
      setSuccess('Profile saved.');
    } catch (saveError) {
      setError(errorMessage(saveError, 'Unable to save profile'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="crud-page" aria-labelledby="profile-heading">
      <div className="page-heading">
        <p className="eyebrow">Worker profile</p>
        <h2 id="profile-heading">Profile</h2>
        <p>Keep your worker details and default rates ready for claim reports and dispute records.</p>
      </div>

      {loading ? <div className="notice-panel">Loading profile...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      {!loading ? (
        <form className="crud-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} required />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} required />
          </label>
          <label>
            Worker identifier
            <input
              value={form.workerIdentifier ?? ''}
              onChange={(event) => updateField('workerIdentifier', optionalText(event.target.value))}
            />
          </label>
          <label>
            FIN / NRIC
            <input value={form.finNric ?? ''} onChange={(event) => updateField('finNric', optionalText(event.target.value))} />
          </label>
          <label>
            Trade or role
            <input value={form.trade} onChange={(event) => updateField('trade', event.target.value)} required />
          </label>
          <label>
            Employment type
            <select
              value={form.employmentType}
              onChange={(event) => updateField('employmentType', event.target.value as WorkerProfileInput['employmentType'])}
            >
              <option value="HOURLY">Hourly</option>
              <option value="DAILY">Daily</option>
              <option value="MONTHLY">Monthly</option>
              <option value="FREELANCER">Freelancer</option>
            </select>
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
          <label>
            Default monthly salary
            <input
              min="0"
              step="0.01"
              type="number"
              value={numberValue(form.defaultMonthlySalary)}
              onChange={(event) => updateField('defaultMonthlySalary', optionalNumber(event.target.value))}
            />
          </label>

          <button className="primary-button form-action" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </form>
      ) : null}
    </section>
  );

  function updateField<Key extends keyof WorkerProfileInput>(field: Key, value: WorkerProfileInput[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
  }
}

function profileToForm(profile: WorkerProfile): WorkerProfileInput {
  return {
    fullName: profile.fullName,
    phone: profile.phone,
    workerIdentifier: profile.workerIdentifier ?? null,
    finNric: profile.finNric ?? null,
    trade: profile.trade,
    employmentType: profile.employmentType,
    defaultHourlyRate: nullableDecimal(profile.defaultHourlyRate),
    defaultDailyRate: nullableDecimal(profile.defaultDailyRate),
    defaultMonthlySalary: nullableDecimal(profile.defaultMonthlySalary)
  };
}

function normalizeProfile(profile: WorkerProfileInput): WorkerProfileInput {
  return {
    ...profile,
    fullName: profile.fullName.trim(),
    phone: profile.phone.trim(),
    workerIdentifier: optionalText(profile.workerIdentifier),
    finNric: optionalText(profile.finNric),
    trade: profile.trade.trim()
  };
}

function nullableDecimal(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function numberValue(value: number | null): string {
  return value === null ? '' : String(value);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
