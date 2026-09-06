import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ElectionRounds from './pages/ElectionRounds';
import PollingStations from './pages/PollingStations';
import Forms from './pages/Forms';
import Report from './pages/Report';
import Reports from './pages/Reports';
import EditReport from './pages/EditReport';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import Evidence from './pages/Evidence';
import Notifications from './pages/Notifications';
import Administration from './pages/Administration';
import AuditLogs from './pages/AuditLogs';
import MapPage from './pages/MapPage';
import Observers from './pages/Observers';
import Layout from './components/Layout';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" />;

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />

      {/* Authenticated Workspace Routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Module 1: Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Module 2: Election Rounds */}
        <Route path="/election-rounds" element={<ElectionRounds />} />
        <Route path="/elections" element={<Navigate to="/election-rounds" replace />} />

        {/* Module 3: Polling Stations */}
        <Route path="/polling-stations" element={<PollingStations />} />
        <Route path="/map" element={<Navigate to="/polling-stations" replace />} />

        {/* Module 4: Observers */}
        <Route path="/observers" element={<ProtectedRoute><Observers /></ProtectedRoute>} />

        {/* Module 5: Forms & Reporting */}
        <Route path="/forms" element={<Forms />} />
        <Route path="/report" element={<Report />} />

        {/* Module 6: Reports Archive & Auditing */}
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/reports/:id/edit" element={<ProtectedRoute adminOnly><EditReport /></ProtectedRoute>} />

        {/* Module 7: Incidents & Alert Resolution */}
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />

        {/* Module 8: Attachments & Evidence */}
        <Route path="/evidence" element={<Evidence />} />
        <Route path="/attachments" element={<Navigate to="/evidence" replace />} />

        {/* Module 9: Notifications & Directives */}
        <Route path="/notifications" element={<Notifications />} />

        {/* Module 10: Administration */}
        <Route path="/administration" element={<Administration />} />
        <Route path="/admin" element={<Navigate to="/administration" replace />} />
        <Route path="/audit-logs" element={<ProtectedRoute adminOnly><AuditLogs /></ProtectedRoute>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster richColors position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}
