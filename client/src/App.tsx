import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProtectedRoute } from './routes/ProtectedRoute';

const pageContent: Record<string, { title: string; description: string; items: string[] }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'A quick evidence overview will appear here as time entries, projects, and claim reports are added.',
    items: ['Recent work activity', 'Open claim periods', 'Evidence gaps to resolve']
  },
  time: {
    title: 'Time Entries',
    description: 'Record daily work time, breaks, notes, and finalised entries in the next CRUD task.',
    items: ['Clock in and clock out', 'Manual time entry', 'Finalise entries for reports']
  },
  projects: {
    title: 'Projects',
    description: 'Project setup will link work logs, pay summaries, and photo evidence to a site or engagement.',
    items: ['Site address', 'Work order reference', 'Default rates']
  },
  photos: {
    title: 'Photo Evidence',
    description: 'Photo upload and evidence metadata will be built here with project and time-entry links.',
    items: ['Before and after photos', 'Caption and evidence type', 'Timestamped records']
  },
  pay: {
    title: 'Pay Summary',
    description: 'Pay calculations will summarise basic pay, overtime, allowances, deductions, and net claim amounts.',
    items: ['Hourly, daily, monthly, or freelance rate', 'Overtime summary', 'Itemised notes']
  },
  claims: {
    title: 'Progress Claims',
    description: 'PDF and CSV report generation will turn finalised work logs and photos into claim documentation.',
    items: ['Claim period', 'Report snapshot', 'PDF and CSV exports']
  },
  clients: {
    title: 'Clients / Companies',
    description: 'Client and company records will support project context without becoming an employer approval system.',
    items: ['Company contacts', 'UEN and address', 'Project links']
  },
  settings: {
    title: 'Settings',
    description: 'Core app defaults will live here, with CPF, MOM automation, Stripe, GPS verification, and AI tools left as placeholders.',
    items: ['Currency', 'Standard hours', 'Overtime multiplier']
  },
  admin: {
    title: 'Admin Placeholder',
    description: 'This route is intentionally minimal for V1 and does not include dashboard or HR administration workflows.',
    items: ['Placeholder only', 'No employer approvals', 'No multi-company admin logic']
  }
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<PlaceholderPage pageKey="dashboard" />} />
          <Route path="time-entries" element={<PlaceholderPage pageKey="time" />} />
          <Route path="projects" element={<PlaceholderPage pageKey="projects" />} />
          <Route path="photo-evidence" element={<PlaceholderPage pageKey="photos" />} />
          <Route path="pay-summary" element={<PlaceholderPage pageKey="pay" />} />
          <Route path="progress-claims" element={<PlaceholderPage pageKey="claims" />} />
          <Route path="clients" element={<PlaceholderPage pageKey="clients" />} />
          <Route path="settings" element={<PlaceholderPage pageKey="settings" />} />
          <Route path="admin-placeholder" element={<PlaceholderPage pageKey="admin" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PlaceholderPage({ pageKey }: { pageKey: keyof typeof pageContent }) {
  const page = pageContent[pageKey];

  return (
    <section className="placeholder-page" aria-labelledby={`${pageKey}-heading`}>
      <div className="page-heading">
        <p className="eyebrow">V1 foundation</p>
        <h2 id={`${pageKey}-heading`}>{page.title}</h2>
        <p>{page.description}</p>
      </div>
      <div className="placeholder-grid">
        {page.items.map((item) => (
          <article className="placeholder-card" key={item}>
            <span />
            <h3>{item}</h3>
            <p>Coming in a focused CRUD task.</p>
          </article>
        ))}
      </div>
    </section>
  );
}
