import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { AdminPlaceholderPage } from './pages/AdminPlaceholderPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PaySummaryPage } from './pages/PaySummaryPage';
import { PhotoEvidencePage } from './pages/PhotoEvidencePage';
import { ProfilePage } from './pages/ProfilePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TimeEntriesPage } from './pages/TimeEntriesPage';
import { ProtectedRoute } from './routes/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="time-entries" element={<TimeEntriesPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="photo-evidence" element={<PhotoEvidencePage />} />
          <Route path="pay-summary" element={<PaySummaryPage />} />
          <Route path="progress-claims" element={<ReportsPage />} />
          <Route path="clients" element={<CompaniesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin-placeholder" element={<AdminPlaceholderPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
