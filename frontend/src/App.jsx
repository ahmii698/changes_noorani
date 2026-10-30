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

// Ye sab pages Dashboard ke andar render hote hain
const DASHBOARD_PATHS = [
  '/dashboard',
  '/billing',
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