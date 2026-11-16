import React, { useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Login from './components/Login';
import Dashboard from './components/Dashboard';

// <-- NAYA (Super Admin)
import SuperAdminLogin from './pages/super-admin/SuperAdminLogin';
import SuperAdminDashboard from './pages/super-admin/dashboard'; // ✅ FIX: ab naya dashboard.jsx import hoga
import SuperAdminPayments from './pages/super-admin/Payments';
import SuperAdminReminder from './pages/super-admin/Reminder';
import SuperAdminMoneyChannel from './pages/super-admin/MoneyChannel';
import SuperAdminTrial from './pages/super-admin/Trial';
import SuperAdminCreate from './pages/super-admin/create';

// Ye sab pages Dashboard ke andar render hote hain
const DASHBOARD_PATHS = [
  '/dashboard',
  '/billing',
  '/payment', // ✅ PAYMENT PAGE ADDED
  '/inventory',
  '/inventory-history',
  '/cash-in-hand',
  '/records',
  '/finance',
  '/finance-expenses',
  '/finance-charts',
  '/finance-credit',
  '/finance-reminders',
  '/reminders',
  '/amounts', // <-- NAYA (subscription payment page)
  '/amount-proof', // <-- NAYA (payment screenshot upload page)
  '/users',
  '/discarded',
  '/estimate',
  '/estimate-records',
  '/battery',
  '/leave',
];

// Token ab render ke waqt check hota hai, App ke render par nahi
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

const FallbackRedirect = () => {
  const token = localStorage.getItem('token');
  return <Navigate to={token ? '/dashboard' : '/'} replace />;
};

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return false;
      }
    }
    return false;
  });

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('darkMode', JSON.stringify(next));
      return next;
    });
  };

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: darkMode ? '#1f2937' : '#fff',
            color: darkMode ? '#fff' : '#333',
          },
        }}
      />

      <Routes>
        {/* Login */}
        <Route
          path="/"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* <-- NAYA (Super Admin) --------------------------------------
            Ye pages normal ProtectedRoute use nahi karte, kyunke super admin
            ka token alag hai (sa_token). Har page khud token check karke
            /super-admin/login par bhej deta hai. */}
        <Route path="/super-admin" element={<SuperAdminLogin />} />
        <Route path="/super-admin/login" element={<SuperAdminLogin />} />
        <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
        <Route path="/super-admin/payments" element={<SuperAdminPayments />} />
        <Route path="/super-admin/reminders" element={<SuperAdminReminder />} />
        <Route path="/super-admin/money-channels" element={<SuperAdminMoneyChannel />} />
        <Route path="/super-admin/trial" element={<SuperAdminTrial />} />
        <Route path="/super-admin/create" element={<SuperAdminCreate />} />

        {/* Saare pages Dashboard ke through */}
        {DASHBOARD_PATHS.map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute>
                <Dashboard
                  darkMode={darkMode}
                  toggleDarkMode={toggleDarkMode}
                />
              </ProtectedRoute>
            }
          />
        ))}

        {/* Fallback */}
        <Route path="*" element={<FallbackRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;