export function renderAdminLoginPage(): string {
  return pageShell(
    'Admin sign in',
    `
      <section class="panel auth-panel">
        <div class="eyebrow">DISPUTE ADMIN</div>
        <h1>Admin sign in</h1>
        <p>Use your authorized administrator email and password. Email verification codes are not required for admin sign-in.</p>
        <form id="login-form">
          <label>Email<input id="email" type="email" autocomplete="email" required /></label>
          <label>Password<input id="password" type="password" autocomplete="current-password" required /></label>
          <button type="submit">Sign in</button>
          <button id="forgot-toggle" class="secondary" type="button">Forgot password?</button>
          <div id="status" class="status"></div>
        </form>

        <section id="reset-panel" class="reset-box hidden">
          <h2>Reset password</h2>
          <p>Enter the same admin email. We will send the standard DISPUTE 6-digit reset code if the account exists.</p>
          <label>Email<input id="reset-email" type="email" autocomplete="email" /></label>
          <button id="send-reset" type="button">Send reset code</button>
          <div id="reset-step-two" class="hidden">
            <label>6-digit code<input id="reset-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" /></label>
            <label>New password<input id="new-password" type="password" minlength="8" autocomplete="new-password" /></label>
            <label>Confirm new password<input id="confirm-new-password" type="password" minlength="8" autocomplete="new-password" /></label>
            <button id="complete-reset" type="button">Reset password</button>
          </div>
          <div id="reset-status" class="status"></div>
        </section>
      </section>
      <script>
        const apiPrefix = location.pathname.startsWith('/api/dispute/') ? '/api/dispute' : '';
        function apiPath(path) { return apiPrefix + path; }

        document.getElementById('login-form').addEventListener('submit', async (event) => {
          event.preventDefault();
          const status = document.getElementById('status');
          status.textContent = 'Signing in...';
          const response = await fetch(apiPath('/admin/login', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({
              email: document.getElementById('email').value,
              password: document.getElementById('password').value
            })
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            status.textContent = body.error || 'Sign in failed.';
            return;
          }
          const adminCheck = await fetch(apiPath('/admin/metrics', { credentials: 'include' });
          if (!adminCheck.ok) {
            await fetch(apiPath('/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
            status.textContent = 'This account is not authorized for admin access.';
            return;
          }
          location.href = apiPath('/admin');
        });

        document.getElementById('forgot-toggle').addEventListener('click', () => {
          const panel = document.getElementById('reset-panel');
          panel.classList.toggle('hidden');
          const loginEmail = document.getElementById('email').value.trim();
          if (loginEmail && !document.getElementById('reset-email').value) {
            document.getElementById('reset-email').value = loginEmail;
          }
        });

        document.getElementById('send-reset').addEventListener('click', async () => {
          const resetStatus = document.getElementById('reset-status');
          const email = document.getElementById('reset-email').value.trim();
          if (!email) {
            resetStatus.textContent = 'Enter your email address.';
            return;
          }
          resetStatus.textContent = 'Sending reset code...';
          const response = await fetch(apiPath('/auth/forgot-password', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({ email })
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            resetStatus.textContent = body.error || 'Unable to send reset code.';
            return;
          }
          document.getElementById('reset-step-two').classList.remove('hidden');
          resetStatus.textContent = body.message || 'If this email is registered, a reset code has been sent.';
        });

        document.getElementById('complete-reset').addEventListener('click', async () => {
          const resetStatus = document.getElementById('reset-status');
          const email = document.getElementById('reset-email').value.trim();
          const code = document.getElementById('reset-code').value.trim();
          const password = document.getElementById('new-password').value;
          const confirmPassword = document.getElementById('confirm-new-password').value;

          if (code.length !== 6 || [...code].some((character) => character < '0' || character > '9')) {
            resetStatus.textContent = 'Enter the 6-digit reset code.';
            return;
          }
          if (password.length < 8) {
            resetStatus.textContent = 'Password must be at least 8 characters.';
            return;
          }
          if (password !== confirmPassword) {
            resetStatus.textContent = 'Passwords do not match.';
            return;
          }

          resetStatus.textContent = 'Resetting password...';
          const response = await fetch(apiPath('/auth/reset-password', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({ email, code, password })
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            resetStatus.textContent = body.error || 'Password reset failed.';
            return;
          }

          document.getElementById('email').value = email;
          document.getElementById('password').value = '';
          document.getElementById('reset-panel').classList.add('hidden');
          resetStatus.textContent = '';
          document.getElementById('status').textContent = 'Password reset successful. Sign in with your new password.';
        });
      </script>
    `
  );
}

export function renderAdminDashboardPage(): string {
  return pageShell(
    'Admin console',
    `
      <header class="topbar">
        <div>
          <div class="eyebrow">DISPUTE ADMIN</div>
          <h1>Operations console</h1>
        </div>
        <button id="logout" class="secondary">Sign out</button>
      </header>

      <section>
        <h2>Analytics</h2>
        <div id="metrics" class="metrics"></div>
      </section>

      <section class="panel">
        <div class="search-row">
          <div>
            <h2>Users</h2>
            <p>Search by email, name, phone or user ID.</p>
          </div>
          <div class="search-controls">
            <input id="search" placeholder="Search users" />
            <select id="status-filter">
              <option value="">All statuses</option>
              <option>ACTIVE</option>
              <option>PENDING_EMAIL_VERIFICATION</option>
              <option>SUSPENDED</option>
            </select>
            <button id="search-button">Search</button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Status</th><th>Created</th><th>Last seen</th><th>Trial / subscription</th></tr></thead>
            <tbody id="users"></tbody>
          </table>
        </div>
      </section>

      <section id="detail-panel" class="panel hidden">
        <div class="detail-header">
          <div>
            <div class="eyebrow">USER ACCOUNT</div>
            <h2 id="detail-title"></h2>
          </div>
          <button id="close-detail" class="secondary">Close</button>
        </div>
        <div id="detail"></div>
        <div class="actions">
          <button id="suspend">Suspend</button>
          <button id="unsuspend" class="secondary">Unsuspend</button>
          <button id="reset-trial">Reset 30-day trial</button>
          <button id="extend-trial" class="secondary">Extend trial</button>
          <button id="set-expiry" class="secondary">Set trial expiry</button>
          <button id="end-trial" class="secondary">End trial</button>
          <button id="delete-user" class="danger">Delete account</button>
        </div>
      </section>

      <section class="panel">
        <h2>Audit log</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Action</th><th>Target</th><th>Reason</th></tr></thead>
            <tbody id="audit"></tbody>
          </table>
        </div>
      </section>

      <script>
        const apiPrefix = location.pathname.startsWith('/api/dispute/') ? '/api/dispute' : '';
        function apiPath(path) { return apiPrefix + path; }

        const state = { selectedUserId: null };

        function fmt(value) {
          if (!value) return '—';
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
        }

        async function api(path, init = {}) {
          const response = await fetch(apiPath(path), {
            ...init,
            credentials: 'include',
            headers: { 'content-type': 'application/json', ...(init.headers || {}) }
          });
          if (response.status === 401 || response.status === 403) {
            location.href = apiPath('/admin/login');
            throw new Error('Admin authentication required');
          }
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error || 'Request failed');
          return body;
        }

        async function loadMetrics() {
          const { metrics } = await api('/admin/metrics');
          const items = [
            ['Total users', metrics.totalUsers],
            ['Active users', metrics.activeUsers],
            ['Pending verification', metrics.pendingUsers],
            ['Suspended', metrics.suspendedUsers],
            ['30-day active', metrics.monthlyActiveUsers],
            ['New users · 7d', metrics.newUsers7d],
            ['New users · 30d', metrics.newUsers30d],
            ['Trialing', metrics.trialingSubscriptions],
            ['Trials expiring · 7d', metrics.trialsExpiring7d],
            ['Expired trials', metrics.expiredTrials],
            ['Active subscriptions', metrics.activeSubscriptions],
            ['Paid conversion', metrics.paidConversionRate + '%'],
            ['Default trial', metrics.defaultTrialDays + ' days']
          ];
          document.getElementById('metrics').innerHTML = items
            .map(([label, value]) => '<div class="metric"><span>' + label + '</span><b>' + value + '</b></div>')
            .join('');
        }

        async function loadUsers() {
          const q = encodeURIComponent(document.getElementById('search').value.trim());
          const status = encodeURIComponent(document.getElementById('status-filter').value);
          const { users } = await api('/admin/users?q=' + q + '&status=' + status + '&limit=100');
          document.getElementById('users').innerHTML = users.map((user) => {
            const sub = user.subscription;
            const access = sub
              ? sub.status + (sub.trialEndsAt ? ' · trial ends ' + fmt(sub.trialEndsAt) : '')
              : 'NONE';
            const name = user.profile?.fullName || user.email;
            return '<tr data-user-id="' + user.id + '"><td><b>' + escapeHtml(name) + '</b><br><small>' + escapeHtml(user.email) + '</small></td><td>' + user.status + '</td><td>' + fmt(user.createdAt) + '</td><td>' + fmt(user.lastSeenAt) + '</td><td>' + escapeHtml(access) + '</td></tr>';
          }).join('');
          document.querySelectorAll('#users tr').forEach((row) => {
            row.addEventListener('click', () => openUser(row.dataset.userId));
          });
        }

        async function openUser(userId) {
          const { user } = await api('/admin/users/' + encodeURIComponent(userId));
          state.selectedUserId = user.id;
          document.getElementById('detail-panel').classList.remove('hidden');
          document.getElementById('detail-title').textContent = user.profile?.fullName || user.email;
          const s = user.subscription;
          document.getElementById('detail').innerHTML =
            '<div class="detail-grid">' +
              '<div><span>Email</span><b>' + escapeHtml(user.email) + '</b></div>' +
              '<div><span>User ID</span><b><code>' + escapeHtml(user.id) + '</code></b></div>' +
              '<div><span>Status</span><b>' + escapeHtml(user.status) + '</b></div>' +
              '<div><span>Role</span><b>' + escapeHtml(user.role) + '</b></div>' +
              '<div><span>Verified</span><b>' + fmt(user.emailVerifiedAt) + '</b></div>' +
              '<div><span>Last seen</span><b>' + fmt(user.lastSeenAt) + '</b></div>' +
              '<div><span>Trial ends</span><b>' + fmt(s?.trialEndsAt) + '</b></div>' +
              '<div><span>Subscription</span><b>' + escapeHtml(s?.status || 'NONE') + '</b></div>' +
            '</div>';
        }

        async function loadAudit() {
          const { audit } = await api('/admin/audit?limit=100');
          document.getElementById('audit').innerHTML = audit.map((row) =>
            '<tr><td>' + fmt(row.createdAt) + '</td><td>' + escapeHtml(row.action) + '</td><td><code>' + escapeHtml(row.targetUserId || '—') + '</code></td><td>' + escapeHtml(row.reason) + '</td></tr>'
          ).join('');
        }

        function escapeHtml(value) {
          return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
        }

        async function action(path, method, body) {
          if (!state.selectedUserId) return;
          try {
            await api('/admin/users/' + encodeURIComponent(state.selectedUserId) + path, {
              method,
              body: JSON.stringify(body)
            });
            await Promise.all([loadMetrics(), loadUsers(), loadAudit()]);
            await openUser(state.selectedUserId).catch(() => {
              document.getElementById('detail-panel').classList.add('hidden');
              state.selectedUserId = null;
            });
          } catch (error) {
            alert(error.message);
          }
        }

        document.getElementById('search-button').onclick = loadUsers;
        document.getElementById('search').addEventListener('keydown', (event) => {
          if (event.key === 'Enter') loadUsers();
        });
        document.getElementById('close-detail').onclick = () => {
          state.selectedUserId = null;
          document.getElementById('detail-panel').classList.add('hidden');
        };
        document.getElementById('logout').onclick = async () => {
          await fetch(apiPath('/auth/logout', { method: 'POST', credentials: 'include' });
          location.href = '/admin/login';
        };
        document.getElementById('suspend').onclick = () => {
          const reason = prompt('Reason for suspension:');
          if (reason) action('/suspend', 'POST', { reason });
        };
        document.getElementById('unsuspend').onclick = () => {
          const reason = prompt('Reason for unsuspension:');
          if (reason) action('/unsuspend', 'POST', { reason });
        };
        document.getElementById('reset-trial').onclick = () => {
          const reason = prompt('Reason for resetting the 30-day trial:');
          if (reason) action('/trial', 'POST', { action: 'reset30', reason });
        };
        document.getElementById('extend-trial').onclick = () => {
          const days = prompt('How many days to extend?', '7');
          const reason = days ? prompt('Reason for extension:') : null;
          if (days && reason) action('/trial', 'POST', { action: 'extend', days: Number(days), reason });
        };
        document.getElementById('set-expiry').onclick = () => {
          const expiresAt = prompt('New trial expiry (ISO date/time, e.g. 2026-11-30T23:59:59+08:00):');
          const reason = expiresAt ? prompt('Reason for custom expiry:') : null;
          if (expiresAt && reason) action('/trial', 'POST', { action: 'set', expiresAt, reason });
        };
        document.getElementById('end-trial').onclick = () => {
          const reason = prompt('Reason for ending trial:');
          if (reason && confirm('End this trial now?')) action('/trial', 'POST', { action: 'end', reason });
        };
        document.getElementById('delete-user').onclick = () => {
          const reason = prompt('Reason for permanent deletion:');
          if (!reason) return;
          const confirmation = prompt('Type DELETE to permanently delete this account:');
          if (confirmation === 'DELETE') action('', 'DELETE', { confirmation, reason });
        };

        Promise.all([loadMetrics(), loadUsers(), loadAudit()]).catch((error) => {
          console.error(error);
        });
      </script>
    `
  );
}

function pageShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${title} | DISPUTE</title>
  <style>
    :root{--bg:#050805;--panel:#0c120d;--line:#2b382d;--muted:#aeb9aa;--lime:#9cff16;--danger:#ff7272}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:#f5fff0;font-family:Inter,Arial,sans-serif}
    main{max-width:1240px;margin:auto;padding:34px 20px 80px}.eyebrow{color:var(--lime);font-weight:900;letter-spacing:.12em;font-size:12px}
    h1{font-size:42px;margin:8px 0 12px}h2{font-size:26px;margin:0 0 12px}p,small{color:var(--muted);line-height:1.5}
    .panel{background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:24px;margin:22px 0}.auth-panel{max-width:520px;margin:80px auto}.reset-box{margin-top:24px;padding-top:22px;border-top:1px solid var(--line)}
    label{display:grid;gap:7px;margin:14px 0;font-weight:700}input,select{background:#070b08;color:#fff;border:1px solid #3a493d;border-radius:10px;padding:12px;font:inherit}
    button{background:var(--lime);border:0;border-radius:10px;padding:11px 14px;font-weight:900;cursor:pointer}.secondary{background:#182019;color:#fff;border:1px solid #3a493d}.danger{background:#5a1717;color:#ffd8d8}
    .topbar,.detail-header,.search-row{display:flex;justify-content:space-between;gap:20px;align-items:center}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    .metric{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px}.metric span{display:block;color:var(--muted);font-size:13px}.metric b{font-size:26px}
    .search-controls{display:flex;gap:8px;flex-wrap:wrap}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px;border-bottom:1px solid #243027;white-space:nowrap}tbody tr{cursor:pointer}tbody tr:hover{background:#111812}
    .detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.detail-grid>div{border:1px solid #2c382f;border-radius:12px;padding:12px}.detail-grid span{display:block;color:var(--muted);font-size:12px}.detail-grid b{display:block;margin-top:4px;word-break:break-word}
    .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.hidden{display:none}.status{min-height:22px;color:#ffb0b0;margin-top:10px}
    code{font-size:12px;color:#d9e3d5}@media(max-width:900px){.metrics{grid-template-columns:repeat(2,1fr)}.detail-grid{grid-template-columns:repeat(2,1fr)}.topbar,.search-row{align-items:flex-start;flex-direction:column}}@media(max-width:520px){.metrics,.detail-grid{grid-template-columns:1fr}}
  </style>
</head>
<body><main>${body}</main></body></html>`;
}
