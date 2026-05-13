import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';
import Login from './pages/Login';
import PublicDashboard from './pages/PublicDashboard';
import Dashboard from './pages/Dashboard';
import Report from './pages/Report';
import Reports from './pages/Reports';
import FieldReportsFeed from './pages/FieldReportsFeed';
import EditReport from './pages/EditReport';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import MapPage from './pages/MapPage';
import Layout from './components/Layout';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to="/app" />;

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicDashboard />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="map" element={<MapPage />} />
        <Route path="report" element={<Report />} />
        <Route path="reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="field-reports" element={<ProtectedRoute><FieldReportsFeed /></ProtectedRoute>} />
        <Route path="reports/:id/edit" element={<ProtectedRoute adminOnly><EditReport /></ProtectedRoute>} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="incidents/:id" element={<IncidentDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
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
