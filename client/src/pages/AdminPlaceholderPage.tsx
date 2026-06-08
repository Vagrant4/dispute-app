import { useEffect, useState } from 'react';
import { getAdminPlaceholderRequest } from '../api/http';

export function AdminPlaceholderPage() {
  const [message, setMessage] = useState('Admin features are reserved for future ClaimProof SG versions.');
  const [error, setError] = useState('');

  useEffect(() => {
    void loadAdminPlaceholder();
  }, []);

  async function loadAdminPlaceholder() {
    try {
      setMessage(await getAdminPlaceholderRequest());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin placeholder');
    }
  }

  return (
    <section className="placeholder-page" aria-labelledby="admin-placeholder-heading">
      <div className="page-heading">
        <p className="eyebrow">Admin placeholder</p>
        <h2 id="admin-placeholder-heading">Reserved for future versions</h2>
        <p>{message}</p>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <div className="notice-panel">
        V1 stays worker-first: no employer approvals, no admin dashboards, and no multi-company HR management logic.
      </div>
    </section>
  );
}
