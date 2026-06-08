import { FormEvent, useEffect, useState } from 'react';
import { getSettingsRequest, saveSettingsRequest, type AppSettingsInput } from '../api/http';

const placeholderAreas = [
  'CPF placeholder',
  'MOM rule engine placeholder',
  'Stripe subscription placeholder',
  'GPS verification placeholder',
  'Work Permit reminder placeholder',
  'AI OCR placeholder',
  'AI photo analysis placeholder'
];

export function SettingsPage() {
  const [form, setForm] = useState<AppSettingsInput>({
    standardDailyHours: 8,
    standardWeeklyHours: 44,
    overtimeMultiplier: 1.5,
    defaultCurrency: 'SGD'
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const settings = await getSettingsRequest();
      setForm({
        standardDailyHours: settings.standardDailyHours,
        standardWeeklyHours: settings.standardWeeklyHours,
        overtimeMultiplier: settings.overtimeMultiplier,
        defaultCurrency: settings.defaultCurrency
      });
    } catch (loadError) {
      setError(errorMessage(loadError, 'Unable to load settings'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateSettings(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const saved = await saveSettingsRequest(form);
      setForm({
        standardDailyHours: saved.standardDailyHours,
        standardWeeklyHours: saved.standardWeeklyHours,
        overtimeMultiplier: saved.overtimeMultiplier,
        defaultCurrency: saved.defaultCurrency
      });
      setSuccess('Settings saved.');
    } catch (submitError) {
      setError(errorMessage(submitError, 'Unable to save settings'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="crud-page settings-page" aria-labelledby="settings-heading">
      <div className="page-heading">
        <p className="eyebrow">Settings</p>
        <h2 id="settings-heading">Settings</h2>
        <p>Control the calculation defaults used by time entries, pay summaries, and progress claim reports.</p>
      </div>

      {loading ? <div className="notice-panel">Loading settings...</div> : null}
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <div className="crud-layout">
        <form className="crud-form" onSubmit={handleSubmit} aria-label="Save settings">
          <h3>Calculation defaults</h3>
          <label>
            Standard daily hours
            <input
              min="1"
              max="24"
              step="0.25"
              type="number"
              value={form.standardDailyHours}
              onChange={(event) => updateNumber('standardDailyHours', event.target.value)}
              required
            />
          </label>
          <label>
            Standard weekly hours
            <input
              min="1"
              max="168"
              step="0.25"
              type="number"
              value={form.standardWeeklyHours}
              onChange={(event) => updateNumber('standardWeeklyHours', event.target.value)}
              required
            />
          </label>
          <label>
            Overtime multiplier
            <input
              min="1"
              max="5"
              step="0.05"
              type="number"
              value={form.overtimeMultiplier}
              onChange={(event) => updateNumber('overtimeMultiplier', event.target.value)}
              required
            />
          </label>
          <label>
            Default currency
            <input
              maxLength={3}
              value={form.defaultCurrency}
              onChange={(event) => updateText('defaultCurrency', event.target.value.toUpperCase())}
              required
            />
          </label>
          <button className="primary-button form-action" type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save settings'}
          </button>
        </form>

        <div className="record-list">
          <article className="record-card">
            <h3>Reserved integrations</h3>
            <p className="record-note">These areas are intentionally placeholder-only in V1 and do not perform automation or verification.</p>
            <div className="placeholder-list">
              {placeholderAreas.map((area) => (
                <span key={area}>{area}</span>
              ))}
            </div>
          </article>
          <article className="record-card">
            <h3>Evidence defaults</h3>
            <dl className="record-details">
              <div>
                <dt>Daily hours</dt>
                <dd>{form.standardDailyHours}h</dd>
              </div>
              <div>
                <dt>Weekly hours</dt>
                <dd>{form.standardWeeklyHours}h</dd>
              </div>
              <div>
                <dt>OT multiplier</dt>
                <dd>{form.overtimeMultiplier}x</dd>
              </div>
              <div>
                <dt>Currency</dt>
                <dd>{form.defaultCurrency}</dd>
              </div>
            </dl>
          </article>
        </div>
      </div>
    </section>
  );

  function updateNumber<Key extends 'standardDailyHours' | 'standardWeeklyHours' | 'overtimeMultiplier'>(field: Key, value: string) {
    const parsed = Number(value);
    setForm((current) => ({ ...current, [field]: Number.isFinite(parsed) ? parsed : 0 }));
  }

  function updateText<Key extends 'defaultCurrency'>(field: Key, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }
}

function validateSettings(settings: AppSettingsInput): string {
  if (settings.standardDailyHours < 1 || settings.standardDailyHours > 24) return 'Standard daily hours must be between 1 and 24.';
  if (settings.standardWeeklyHours < 1 || settings.standardWeeklyHours > 168) return 'Standard weekly hours must be between 1 and 168.';
  if (settings.standardWeeklyHours < settings.standardDailyHours) return 'Standard weekly hours must be at least daily hours.';
  if (settings.overtimeMultiplier < 1 || settings.overtimeMultiplier > 5) return 'Overtime multiplier must be between 1 and 5.';
  if (!/^[A-Z]{3}$/.test(settings.defaultCurrency)) return 'Default currency must be a 3-letter code.';
  return '';
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
