import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  Pill,
  QrCode,
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

export const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/admin/dashboard-stats');
        if (res.data.success) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load admin stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const metrics = data?.metrics || {
    total_users: 0,
    citizen_users: 0,
    total_manufacturers: 0,
    approved_manufacturers: 0,
    pending_manufacturers: 0,
    rejected_manufacturers: 0,
    suspended_manufacturers: 0,
    total_medicines: 0,
    active_medicines: 0,
    total_batches: 0,
    active_batches: 0,
    total_scans: 0,
    verified_scans: 0,
    alert_scans: 0,
    total_reports: 0,
    pending_reports: 0,
    total_cdsco_alerts: 0,
    active_cdsco_alerts: 0,
  };

  const trends = data?.scan_trends || [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            National Regulatory Oversight
          </span>
          <h1 className="text-2xl font-black text-white">Administrator Control Center</h1>
          <p className="text-xs text-neutral-400">
            Real-time verification metrics, manufacturer licensing, and cryptographic batch telemetry.
          </p>
        </div>

        {metrics.pending_manufacturers > 0 && (
          <Link
            to="/admin/manufacturers?status=pending"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-bold animate-pulse"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>{metrics.pending_manufacturers} Pending Manufacturer Approval(s)</span>
          </Link>
        )}
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Approved Manufacturers */}
        <Link
          to="/admin/manufacturers"
          className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 transition-colors space-y-2 group"
        >
          <div className="flex justify-between items-center text-neutral-400">
            <span className="text-xs font-medium">Manufacturers</span>
            <Building2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-3xl font-black text-white">{metrics.total_manufacturers}</p>
          <div className="text-[11px] text-neutral-400 flex gap-2">
            <span className="text-emerald-400 font-semibold">{metrics.approved_manufacturers} Approved</span>
            <span>•</span>
            <span className="text-amber-400 font-semibold">{metrics.pending_manufacturers} Pending</span>
          </div>
        </Link>

        {/* Medicines Master Catalogue */}
        <Link
          to="/admin/medicines"
          className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 transition-colors space-y-2 group"
        >
          <div className="flex justify-between items-center text-neutral-400">
            <span className="text-xs font-medium">Medicine Master</span>
            <Pill className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-3xl font-black text-white">{metrics.total_medicines}</p>
          <div className="text-[11px] text-emerald-400 font-semibold">
            {metrics.active_medicines} Active Catalogue Formulations
          </div>
        </Link>

        {/* Registered Batches */}
        <Link
          to="/admin/batches"
          className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/40 transition-colors space-y-2 group"
        >
          <div className="flex justify-between items-center text-neutral-400">
            <span className="text-xs font-medium">Signed Batches</span>
            <QrCode className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-3xl font-black text-white">{metrics.total_batches}</p>
          <div className="text-[11px] text-neutral-400">
            <span className="text-emerald-400 font-semibold">{metrics.active_batches} Active</span> in circulation
          </div>
        </Link>

        {/* Total Citizen Scans */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
          <div className="flex justify-between items-center text-neutral-400">
            <span className="text-xs font-medium">Citizen Verifications</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-white">{metrics.total_scans}</p>
          <div className="text-[11px] text-neutral-400 flex gap-2">
            <span className="text-emerald-400 font-semibold">{metrics.verified_scans} Verified</span>
            <span>•</span>
            <span className="text-rose-400 font-semibold">{metrics.alert_scans} Warnings</span>
          </div>
        </div>
      </div>

      {/* Secondary Row: Reports & CDSCO Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/admin/reports"
          className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-rose-500/40 transition-colors flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Incident Reports</span>
            <h3 className="text-2xl font-black text-white">{metrics.total_reports} Reports Filed</h3>
            <p className="text-xs text-neutral-400">
              {metrics.pending_reports} pending regulatory review and investigation
            </p>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
        </Link>

        <Link
          to="/admin/cdsco-alerts"
          className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 transition-colors flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">CDSCO NSQ Registry</span>
            <h3 className="text-2xl font-black text-white">{metrics.total_cdsco_alerts} Quality Alerts</h3>
            <p className="text-xs text-neutral-400">
              {metrics.active_cdsco_alerts} active regulatory drug quality alerts loaded
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
            <AlertOctagon className="w-8 h-8" />
          </div>
        </Link>
      </div>

      {/* Quick Access Actions Bar */}
      <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h4 className="text-sm font-bold text-white">Administrative Operations</h4>
          <p className="text-xs text-neutral-400">Direct shortcuts to frequent regulatory workflows</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/admin/manufacturers"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 transition-colors"
          >
            Review Manufacturers
          </Link>
          <Link
            to="/admin/medicines"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 transition-colors"
          >
            Import Medicine CSV
          </Link>
          <Link
            to="/admin/cdsco-alerts"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 transition-colors"
          >
            Upload CDSCO Alerts
          </Link>
        </div>
      </div>
    </div>
  );
};
