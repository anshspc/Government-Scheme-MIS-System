import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { authService } from './services/auth';

// Component Imports
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Page Imports
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DistrictAnalytics from './pages/DistrictAnalytics';
import SchemeAnalytics from './pages/SchemeAnalytics';
import Reconciliation from './pages/Reconciliation';
import DataImport from './pages/DataImport';
import Forecasts from './pages/Forecasts';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';

// Route Guard wrapping children
function ProtectedRoute({ children, allowedRoles }) {
  const isAuth = authService.isAuthenticated();
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    const userHasRole = authService.hasRole(allowedRoles);
    if (!userHasRole) {
      // Redirect unauthorized roles back to dashboard homepage
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

// Shell Layout for authenticated users
function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Navigation sidebar on the left */}
      <Sidebar />

      {/* Main workspace view */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Header toolbar */}
        <Navbar />

        {/* Dynamic page content container */}
        <main className="p-8 pt-24 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            
            <Route path="/districts" element={
              <ProtectedRoute allowedRoles={['Super Admin', 'State Admin', 'District Officer', 'Block Officer']}>
                <DistrictAnalytics />
              </ProtectedRoute>
            } />
            
            <Route path="/schemes" element={
              <ProtectedRoute allowedRoles={['Super Admin', 'State Admin', 'District Officer', 'Block Officer']}>
                <SchemeAnalytics />
              </ProtectedRoute>
            } />
            
            <Route path="/reconciliation" element={
              <ProtectedRoute allowedRoles={['Super Admin', 'State Admin']}>
                <Reconciliation />
              </ProtectedRoute>
            } />
            
            <Route path="/import" element={
              <ProtectedRoute allowedRoles={['Super Admin', 'Data Entry Operator']}>
                <DataImport />
              </ProtectedRoute>
            } />
            
            <Route path="/forecasts" element={
              <ProtectedRoute allowedRoles={['Super Admin', 'State Admin', 'District Officer']}>
                <Forecasts />
              </ProtectedRoute>
            } />
            
            <Route path="/reports" element={
              <ProtectedRoute allowedRoles={['Super Admin', 'State Admin', 'District Officer', 'Block Officer']}>
                <Reports />
              </ProtectedRoute>
            } />
            
            <Route path="/audit-logs" element={
              <ProtectedRoute allowedRoles={['Super Admin', 'State Admin']}>
                <AuditLogs />
              </ProtectedRoute>
            } />

            {/* Catch all fallback redirects */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Authentication routes */}
        <Route path="/login" element={<Login />} />

        {/* Authenticated Application Shell */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
