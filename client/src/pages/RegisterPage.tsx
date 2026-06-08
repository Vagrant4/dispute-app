import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const disclaimer =
  'This app helps you record work, time, pay, and evidence for reference. It does not replace legal, accounting, or MOM advice.';

export function RegisterPage() {
  const { currentUser, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    trade: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await register({
        email: form.email,
        password: form.password,
        profile: {
          fullName: form.fullName,
          phone: form.phone,
          trade: form.trade,
          employmentType: 'FREELANCER',
          workerIdentifier: null,
          finNric: null,
          defaultHourlyRate: null,
          defaultDailyRate: null,
          defaultMonthlySalary: null
        }
      });
      navigate('/', { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create account');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="register-heading">
        <p className="eyebrow">ClaimProof SG</p>
        <h1 id="register-heading">Create your evidence account</h1>
        <p className="support-copy">{disclaimer}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input
              autoComplete="name"
              name="fullName"
              onChange={(event) => updateField('fullName', event.target.value)}
              required
              value={form.fullName}
            />
          </label>
          <label>
            Email
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => updateField('email', event.target.value)}
              required
              type="email"
              value={form.email}
            />
          </label>
          <label>
            Phone
            <input
              autoComplete="tel"
              inputMode="tel"
              name="phone"
              onChange={(event) => updateField('phone', event.target.value)}
              required
              value={form.phone}
            />
          </label>
          <label>
            Trade or role
            <input
              name="trade"
              onChange={(event) => updateField('trade', event.target.value)}
              placeholder="Freelance installer, designer, driver..."
              required
              value={form.trade}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="new-password"
              minLength={8}
              name="password"
              onChange={(event) => updateField('password', event.target.value)}
              required
              type="password"
              value={form.password}
            />
          </label>

          {error ? <div className="form-error">{error}</div> : null}

          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
