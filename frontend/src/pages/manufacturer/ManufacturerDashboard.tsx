import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Key,
  QrCode,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';

export const ManufacturerDashboard: React.FC = () => {
  const { manufacturer, user } = useAuth();
  const { t } = useLanguage();

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/manufacturer/dashboard');
        if (res.data.success) {
          setDashboardData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load manufacturer dashboard', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const profile = dashboardData?.profile || manufacturer;
  const metrics = dashboardData?.metrics || {
    total_batches: 0,
    active_batches: 0,
    expired_batches: 0,
  };
  const cryptoKey = dashboardData?.cryptographic_key;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner & Status */}
      <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Manufacturer Portal
            </span>
            <h1 className="text-2xl font-black text-white">
              {profile?.company_name || 'Pharmaceutical Manufacturer'}
            </h1>
            <p className="text-xs text-neutral-400 font-mono">
              Drug Manufacturing License No: {profile?.license_number || 'Pending'}
            </p>
          </div>

          <div className="self-start sm:self-center">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                profile?.approval_status === 'approved'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : profile?.approval_status === 'rejected'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              ● Regulatory Status: {profile?.approval_status || 'Pending'}
            </span>
          </div>
        </div>

        {/* Approval Status Notice */}
        {profile?.approval_status !== 'approved' && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/80 text-amber-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Account Verification Pending</p>
              <p className="mt-0.5 text-amber-300/90 leading-relaxed">
                {profile?.rejection_reason || t.mfg.approvalNotice}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
          <span className="text-xs text-neutral-400 font-medium">Total Registered Batches</span>
          <p className="text-3xl font-black text-white">{metrics.total_batches}</p>
        </div>
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
          <span className="text-xs text-neutral-400 font-medium">Active In-Market Batches</span>
          <p className="text-3xl font-black text-emerald-400">{metrics.active_batches}</p>
        </div>
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
          <span className="text-xs text-neutral-400 font-medium">Expired Batches</span>
          <p className="text-3xl font-black text-rose-400">{metrics.expired_batches}</p>
        </div>
      </div>

      {/* Cryptographic Key Details & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Key Card */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-800">
            <Key className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Active Ed25519 Cryptographic Signing Key
            </h3>
          </div>

          {cryptoKey ? (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">Key Identifier:</span>
                <span className="font-mono text-emerald-400 font-bold">{cryptoKey.key_id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">Algorithm:</span>
                <span className="font-mono text-white uppercase">{cryptoKey.algorithm} (Edwards-curve DSA)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/60">
                <span className="text-neutral-400">Key Registry Status:</span>
                <span className="text-emerald-400 font-bold uppercase">{cryptoKey.status}</span>
              </div>
              <div className="space-y-1 pt-1">
                <span className="text-neutral-400 block">Public Key (SPKI PEM Registered in Database):</span>
                <pre className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 font-mono text-[10px] text-neutral-300 overflow-x-auto">
                  {cryptoKey.public_key_pem}
                </pre>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-neutral-500">
              No active Ed25519 signing key registered yet. Keys are automatically generated upon regulatory administrator approval.
            </div>
          )}
        </div>

        {/* Quick Actions Card */}
        <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Batch Management</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Register new medicine batches to generate unique UUID serial numbers, Ed25519 digital signatures, and printable 2D QR codes.
            </p>

            <div className="space-y-2.5 pt-2">
              <Link
                to="/manufacturer/register-batch"
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                  profile?.approval_status === 'approved'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed pointer-events-none'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Register New Batch</span>
              </Link>

              <Link
                to="/manufacturer/my-batches"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-200 transition-colors"
              >
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>View Batches & QR Codes</span>
              </Link>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-800 text-[11px] text-neutral-500">
            Note: Private keys are isolated in server secure vaults and never accessible via frontend.
          </div>
        </div>
      </div>
    </div>
  );
};
