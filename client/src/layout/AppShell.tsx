import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/profile', label: 'Profile' },
  { to: '/time-entries', label: 'Time Entries' },
  { to: '/projects', label: 'Projects' },
  { to: '/photo-evidence', label: 'Photo Evidence' },
  { to: '/pay-summary', label: 'Pay Summary' },
  { to: '/progress-claims', label: 'Progress Claims' },
  { to: '/clients', label: 'Clients / Companies' },
  { to: '/settings', label: 'Settings' }
];

const disclaimer =
  'This app helps you record work, time, pay, and evidence for reference. It does not replace legal, accounting, or MOM advice.';

export function AppShell() {
  const { currentUser, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ClaimProof SG</p>
          <h1>Evidence workspace</h1>
        </div>
        <button className="ghost-button" type="button" onClick={() => void logout()}>
          Logout
        </button>
      </header>

      <nav className="mobile-nav" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link">
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="shell-main">
        <section className="user-strip">
          <span>Signed in</span>
          <strong>{currentUser?.email ?? 'Authenticated session'}</strong>
        </section>
        <Outlet />
      </main>

      <footer className="disclaimer">{disclaimer}</footer>
    </div>
  );
}
