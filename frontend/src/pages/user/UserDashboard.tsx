import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  History,
  QrCode,
  AlertTriangle,
  Flag,
  FileCheck2,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { QrScannerModal } from '../../components/QrScannerModal';

export const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [scans, setScans] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [scansRes, reportsRes] = await Promise.all([
          api.get('/verification/my-history'),
          api.get('/reports/my-reports'),
        ]);
        if (scansRes.data.success) setScans(scansRes.data.data);
        if (reportsRes.data.success) setReports(reportsRes.data.data);
      } catch (err) {
        console.error('Failed to load user dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const verifiedCount = scans.filter((s) => s.scan_status === 'VERIFIED').length;
  const alertCount = scans.filter((s) => s.scan_status !== 'VERIFIED').length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-neutral-900 border border-neutral-800">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Citizen Portal</span>
          <h1 className="text-2xl font-black text-white">Welcome, {user?.full_name}</h1>
          <p className="text-xs text-neutral-400">Track your pharmaceutical verification scans and report suspicious packages.</p>
        </div>

        <button
          onClick={() => setIsScannerOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 self-start sm:self-center"
        >
          <QrCode className="w-4 h-4" />
          <span>Scan New Medicine</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
          <span className="text-xs text-neutral-400 font-medium">Total Verifications</span>
          <p className="text-3xl font-black text-white">{scans.length}</p>
        </div>
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
          <span className="text-xs text-neutral-400 font-medium">Verified Authentic Records</span>
          <p className="text-3xl font-black text-emerald-400">{verifiedCount}</p>
        </div>
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
          <span className="text-xs text-neutral-400 font-medium">Reports Submitted</span>
          <p className="text-3xl font-black text-rose-400">{reports.length}</p>
        </div>
      </div>

      {/* Recent Scans */}
      <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <span>Recent Verification Scans</span>
          </h3>
          <Link to="/user/history" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {scans.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500">
            No scans recorded yet. Scan a medicine QR code to view authenticity details.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="pb-2">Date & Time</th>
                  <th className="pb-2">Medicine / Brand</th>
                  <th className="pb-2">Batch No</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {scans.slice(0, 5).map((scan) => (
                  <tr key={scan.id} className="hover:bg-neutral-800/30">
                    <td className="py-3 text-neutral-400">
                      {new Date(scan.created_at).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 font-semibold text-white">
                      {scan.brand_name || scan.medicine_name || 'Unregistered Unit'}
                    </td>
                    <td className="py-3 font-mono text-neutral-300">{scan.batch_number || 'N/A'}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          scan.scan_status === 'VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {scan.scan_status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/verify/${scan.serial_id}`}
                        className="text-emerald-400 hover:underline font-semibold"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(serial) => navigate(`/verify/${serial}`)}
      />
    </div>
  );
};
