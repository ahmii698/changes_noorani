import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiLogIn } from 'react-icons/fi';
import ForgotPassword from './ForgotPassword';
import api from '../services/api';

const Login = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!credentials.email || !credentials.password) {
      toast.error('Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/login', {
        email: credentials.email,
        password: credentials.password,
      });

      const data = response.data;

      console.log('📥 Login Response:', data);
      console.log('📥 Token:', data?.token);

      if (data && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');

        console.log('✅ Token saved:', localStorage.getItem('token'));
        console.log('✅ User saved:', localStorage.getItem('user'));

        toast.success(data.message || 'Login Successful!');

        setTimeout(() => {
          if (data.user?.role === 'employee') {
            window.location.href = '/billing';
          } else {
            window.location.href = '/dashboard';
          }
        }, 300);

      } else {
        console.log('❌ Token missing');
        toast.error(data?.message || 'Login failed');
      }

    } catch (error) {
      console.error('❌ Login Error:', error);
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <ForgotPassword
        onBack={() => setShowForgotPassword(false)}
      />
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/dark.jpeg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70"></div>
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Fusix Logo - Full Width Cover */}
          <div className="w-full h-32 bg-black overflow-hidden flex items-center justify-center">
            <img
              src="/fusix.jpg"
              alt="Fusix"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                const parent = e.target.parentElement;
                const fallback = document.createElement('div');
                fallback.className = 'w-full h-full flex items-center justify-center text-white text-5xl font-bold tracking-wider';
                fallback.textContent = 'FUSIX';
                parent.appendChild(fallback);
              }}
            />
          </div>

          <div className="p-6 pt-8">
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email Field */}
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={credentials.email}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      email: e.target.value,
                    })
                  }
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  placeholder="Password"
                  value={credentials.password}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      password: e.target.value,
                    })
                  }
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                  autoComplete="current-password"
                  required
                />
              </div>

              {/* Forgot Password */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Logging in...
                  </>
                ) : (
                  <>
                    <FiLogIn className="w-5 h-5" />
                    Login to Dashboard
                  </>
                )}
              </button>

              {/* Demo Credentials */}
             
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;