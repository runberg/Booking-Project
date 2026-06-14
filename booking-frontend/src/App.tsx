import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { RegisterPage } from './pages/RegisterPage';
import { LoginPage } from './pages/LoginPage';
import { SuccessPage } from './pages/SuccessPage';
import { BookingPage } from './pages/BookingPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { SecurityPage } from './pages/SecurityPage';
const CancelBookingPage = React.lazy(() => import('./pages/CancelBookingPage').then(m => ({ default: m.CancelBookingPage })));
const CheckinPage = React.lazy(() => import('./pages/CheckinPage').then(m => ({ default: m.CheckinPage })));
import { authService, API_BASE_URL } from './services/authService';
import { setServerTimezone } from './utils/date';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = authService.isAuthenticated();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = authService.isAuthenticated();
  if (!isAuthenticated) return <>{children}</>;
  const user = authService.getCurrentUser();
  if (user?.role === 'security') return <Navigate to="/security" replace />;
  return <Navigate to="/bookings" replace />;
};

const RootRedirect: React.FC = () => {
  const isAuthenticated = authService.isAuthenticated();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const user = authService.getCurrentUser();
  if (user?.role === 'security') return <Navigate to="/security" replace />;
  return <Navigate to="/bookings" replace />;
};

function App() {
  useEffect(() => {
    fetch(`${API_BASE_URL}/health/config`)
      .then((r) => r.json())
      .then((d: { timezone?: string }) => { if (d?.timezone) setServerTimezone(d.timezone); })
      .catch(() => {});
  }, []);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="App">
        <React.Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route 
            path="/register" 
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            } 
          />
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } 
          />
          <Route 
            path="/bookings"
            element={
              <ProtectedRoute>
                <BookingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/success" 
            element={
              <ProtectedRoute>
                <SuccessPage />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/security"
            element={
              <ProtectedRoute>
                <SecurityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verify-email"
            element={<VerifyEmailPage />}
          />
          <Route
            path="/cancel/:token"
            element={<CancelBookingPage />}
          />
          <Route
            path="/checkin/:token"
            element={<CheckinPage />}
          />
        </Routes>
        </React.Suspense>
      </div>
    </Router>
  );
}

export default App;
