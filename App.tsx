import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UserRole } from './types';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewAppointment from './pages/NewAppointment';
import Financials from './pages/Financials';
import Hospitals from './pages/Hospitals';
import Expenses from './pages/Expenses';
import Attendances from './pages/Attendances';
import Patients from './pages/Patients';
import ChangePassword from './pages/ChangePassword';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, mustChangePassword } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Force password change before any other route
  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) return <Navigate to="/" replace />;
    if (user.role === UserRole.RECEPTION || user.role === UserRole.FINANCIAL || user.role === UserRole.COMMERCIAL) return <Navigate to="/attendances" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, isLoading, authStatus, error, retryFetchProfile, signOut, isAuthenticated, mustChangePassword } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center px-6">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg"></div>
          <div className="space-y-4">
            <p className="text-slate-900 dark:text-white font-black text-xl animate-pulse">
              {error ? 'Erro de Autenticação' : 'Carregando dados'}
            </p>
            {error ? (
              <div className="space-y-4">
                <p className="text-red-500 font-bold text-sm bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-800/50">
                  {error}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={retryFetchProfile}
                    className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity"
                  >
                    Tentar Novamente
                  </button>
                  <button
                    onClick={signOut}
                    className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200"
                  >
                    Sair e Logar Novamente
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 font-bold text-sm tracking-tight">
                {authStatus || 'Carregando...'}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes (no auth required) */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/" />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Change password (requires auth + must_change_password flag) */}
      <Route
        path="/change-password"
        element={
          isAuthenticated && mustChangePassword
            ? <ChangePassword />
            : <Navigate to={isAuthenticated ? '/' : '/login'} replace />
        }
      />

      <Route element={<Layout />}>
        {/* Admin Dashboard */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Shared Routes: Admin, Reception, Financial */}
        <Route
          path="/new-appointment"
          element={
            <ProtectedRoute>
              <NewAppointment />
            </ProtectedRoute>
          }
        />

        {/* Reception, Financial, Commercial & Admin Shared */}
        <Route
          path="/attendances"
          element={
            <ProtectedRoute allowedRoles={[UserRole.RECEPTION, UserRole.FINANCIAL, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMMERCIAL]}>
              <Attendances />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <ProtectedRoute allowedRoles={[UserRole.RECEPTION, UserRole.FINANCIAL, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.COMMERCIAL]}>
              <Patients />
            </ProtectedRoute>
          }
        />

        {/* Financials: Admin, Super Admin and Financial Role */}
        <Route
          path="/financials"
          element={
            <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCIAL]}>
              <Financials />
            </ProtectedRoute>
          }
        />

        {/* Admin / Super Admin Only Routes */}
        <Route
          path="/expenses"
          element={
            <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN]}>
              <Expenses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospitals"
          element={
            <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN]}>
              <Hospitals />
            </ProtectedRoute>
          }
        />

        {/* Fallback based on role */}
        <Route
          path="*"
          element={
            user?.role === UserRole.RECEPTION || user?.role === UserRole.FINANCIAL || user?.role === UserRole.COMMERCIAL
              ? <Navigate to="/attendances" replace />
              : <Navigate to="/" replace />
          }
        />
      </Route>
    </Routes>
  );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <Toaster />
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
