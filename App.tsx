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

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // If Admin tries to access reception-only page (rare), redirect to dashboard
    if (user.role === UserRole.ADMIN) return <Navigate to="/" replace />;
    // If Reception/Financial tries to access admin page, redirect to their home
    if (user.role === UserRole.RECEPTION || user.role === UserRole.FINANCIAL) return <Navigate to="/attendances" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, isLoading, authStatus } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-6 max-w-xs text-center px-6">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg"></div>
          <div className="space-y-2">
            <p className="text-slate-900 dark:text-white font-black text-xl animate-pulse">Carregando dados</p>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm tracking-tight">{authStatus || 'Carregando...'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

      <Route element={<Layout />}>
        {/* Admin Dashboard */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
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

        {/* Reception & Financial Shared */}
        <Route
          path="/attendances"
          element={
            <ProtectedRoute allowedRoles={[UserRole.RECEPTION, UserRole.FINANCIAL, UserRole.ADMIN]}>
              <Attendances />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <ProtectedRoute allowedRoles={[UserRole.RECEPTION, UserRole.FINANCIAL, UserRole.ADMIN]}>
              <Patients />
            </ProtectedRoute>
          }
        />

        {/* Financials: Admin and Financial Role */}
        <Route
          path="/financials"
          element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.FINANCIAL]}>
              <Financials />
            </ProtectedRoute>
          }
        />

        {/* Admin Only Routes */}
        <Route
          path="/expenses"
          element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <Expenses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospitals"
          element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <Hospitals />
            </ProtectedRoute>
          }
        />

        {/* Fallback based on role */}
        <Route
          path="*"
          element={
            user?.role === UserRole.RECEPTION || user?.role === UserRole.FINANCIAL
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