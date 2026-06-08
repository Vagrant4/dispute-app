import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const disclaimer =
  'This app helps you record work, time, pay, and evidence for reference. It does not replace legal, accounting, or MOM advice.';

export function LoginPage() {
  const { currentUser, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to log in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="login-heading">
        <p className="eyebrow">ClaimProof SG</p>
        <h1 id="login-heading">Log in to your evidence workspace</h1>
        <p className="support-copy">{disclaimer}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? <div className="form-error">{error}</div> : null}

          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p className="auth-switch">
          New to ClaimProof SG? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
