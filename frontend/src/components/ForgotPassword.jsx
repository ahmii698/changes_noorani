// src/components/ForgotPassword.jsx
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FiMail, FiKey, FiCheckCircle, FiArrowLeft, FiLock } from 'react-icons/fi';
import api from '../services/api';

const ForgotPassword = ({ onBack }) => {
  const [resetEmail, setResetEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast.error('Please enter your email address');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await api.post('/forgot-password', {
        email: resetEmail
      });
      
      const data = response.data;  // ✅ CHANGE 1
      
      // ✅ FIX: success check hatao, token check karo
      if (data && data.token) {
        setResetToken(data.token);
        setOtpSent(true);
        toast.success(data.message || `OTP sent to ${resetEmail}`);
      } else {
        toast.error(data?.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      const message = error.response?.data?.message || 'Email not found or server error';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e) => {
    e.preventDefault();
    
    if (!otpCode) {
      toast.error('Please enter OTP');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      // First verify OTP
      const verifyResponse = await api.post('/verify-otp', {
        email: resetEmail,
        otp: otpCode
      });
      
      const vData = verifyResponse.data;  // ✅ CHANGE 2
      
      // ✅ FIX: success check hatao, token check karo
      if (vData && vData.token) {
        const token = vData.token;
        
        // Then reset password
        const resetResponse = await api.post('/reset-password', {
          email: resetEmail,
          token: token,
          password: newPassword,
          password_confirmation: confirmPassword
        });
        
        if (resetResponse.data.success) {
          toast.success(resetResponse.data.message || 'Password reset successful! Please login');
          onBack();
        } else {
          toast.error(resetResponse.data.message || 'Reset failed');
        }
      } else {
        toast.error(vData?.message || 'Invalid OTP');
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error('Reset error:', error);
      const message = error.response?.data?.message || 'Reset failed. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background - matches Login page */}
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
          {/* Fusix Logo - same as Login */}
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
            {!otpSent ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="text-center mb-2">
                  <FiKey className="w-10 h-10 text-blue-600 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold text-gray-800">Reset Password</h3>
                  <p className="text-sm text-gray-500 mt-1">Enter your email to receive OTP</p>
                </div>

                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    'Send OTP'
                  )}
                </button>

                <button
                  type="button"
                  onClick={onBack}
                  className="w-full text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200 py-2 flex items-center justify-center gap-1"
                >
                  <FiArrowLeft /> Back to Login
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndReset} className="space-y-4">
                <div className="text-center mb-2">
                  <FiKey className="w-10 h-10 text-blue-600 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold text-gray-800">Verify & Reset</h3>
                  <p className="text-sm text-gray-500 mt-1">Enter OTP and new password</p>
                </div>

                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Enter OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 text-center text-2xl tracking-widest"
                    required
                  />
                </div>

                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                    required
                  />
                </div>

                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Resetting...
                    </>
                  ) : (
                    <>
                      <FiCheckCircle /> Reset Password
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="w-full text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors duration-200 py-2"
                >
                  ← Back to Email
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;