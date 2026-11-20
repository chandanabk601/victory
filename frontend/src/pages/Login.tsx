import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        const { token, user, manufacturer } = res.data.data;
        login(token, user, manufacturer);

        // Redirect based on role
        if (user.role === 'admin') {
          navigate('/admin');
        } else if (user.role === 'manufacturer') {
          navigate('/manufacturer');
        } else {
          navigate('/user');
        }
      } else {
        setError(res.data.error || 'Login failed.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Invalid credentials or server unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md p-8 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Access VICTORY</h2>
          <p className="text-xs text-neutral-400">Sign in to your regulatory, manufacturer, or citizen account</p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
                className="w-full pl-10 pr-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-neutral-300">Password</label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 mt-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Sign In</span>
          </button>
        </form>

        <div className="pt-4 border-t border-neutral-800/80 text-center space-y-2 text-xs text-neutral-400">
          <p>
            New citizen user?{' '}
            <Link to="/register" className="text-emerald-400 hover:underline font-semibold">
              Create an account
            </Link>
          </p>
          <p>
            Pharmaceutical manufacturer?{' '}
            <Link to="/register-manufacturer" className="text-emerald-400 hover:underline font-semibold">
              Register company
            </Link>
          </p>
        </div>

        {/* Development Seed Accounts Helper Pill */}
        <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
          <p className="font-semibold text-neutral-300">Default Test Accounts:</p>
          <div className="flex justify-between text-neutral-400">
            <span>Admin:</span>
            <code className="text-emerald-400">admin@victory.pharma / Admin@12345</code>
          </div>
          <div className="flex justify-between text-neutral-400">
            <span>Manufacturer:</span>
            <code className="text-emerald-400">mfg@cipla.com / Mfg@12345</code>
          </div>
          <div className="flex justify-between text-neutral-400">
            <span>Citizen:</span>
            <code className="text-emerald-400">user@example.com / User@12345</code>
          </div>
        </div>
      </div>
    </div>
  );
};
