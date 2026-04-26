import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { AccountBalance, Lock, Person, ErrorOutline } from '@mui/icons-material';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Decorative Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-950/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Container */}
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 relative z-10">
        
        {/* Emblem/Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/10 mb-3">
            <AccountBalance className="text-white text-3xl" />
          </div>
          <h2 className="text-xl font-black text-slate-100 tracking-tight text-center">GOVERNMENT OF INDIA</h2>
          <p className="text-xs text-orange-400 font-bold uppercase tracking-widest mt-1 text-center">Scheme monitoring & MIS Portal</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl flex items-start space-x-3 text-xs">
            <ErrorOutline className="text-red-500 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Official Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Person fontSize="small" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. admin@gov.in"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Security Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Lock fontSize="small" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-orange-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading ? 'AUTHENTICATING...' : 'SECURE SIGN IN'}
          </button>
        </form>

        {/* Credentials Sandbox Demo hint */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Default Test Credentials</p>
          <div className="mt-2.5 flex justify-center space-x-6 text-[10px] text-slate-400">
            <div>
              <span className="text-orange-400 font-bold block">Super Admin</span>
              <span>admin@gov.in / admin123</span>
            </div>
            <div>
              <span className="text-orange-400 font-bold block">Bhind Officer</span>
              <span>bhind@gov.in / bhind123</span>
            </div>
            <div>
              <span className="text-orange-400 font-bold block">Data Operator</span>
              <span>operator@gov.in / operator123</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
