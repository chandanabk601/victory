import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Search, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

export const ScanHistory: React.FC = () => {
  const { t } = useLanguage();
  const [scans, setScans] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/verification/my-history');
        if (res.data.success) {
          setScans(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch scan history', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filtered = scans.filter((s) => {
    const term = search.toLowerCase();
    return (
      (s.medicine_name && s.medicine_name.toLowerCase().includes(term)) ||
      (s.brand_name && s.brand_name.toLowerCase().includes(term)) ||
      (s.batch_number && s.batch_number.toLowerCase().includes(term)) ||
      (s.serial_id && s.serial_id.toLowerCase().includes(term)) ||
      (s.scan_status && s.scan_status.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <History className="w-6 h-6 text-emerald-400" />
            <span>Personal Verification Scan History</span>
          </h1>
          <p className="text-xs text-neutral-400">Audit trail of all medicines scanned under your citizen account</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scans..."
            className="w-full pl-9 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            No verification scans found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3">Medicine Formulation</th>
                  <th className="pb-3">Batch Number</th>
                  <th className="pb-3">Manufacturer</th>
                  <th className="pb-3">Verification Verdict</th>
                  <th className="pb-3 text-right">View Provenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filtered.map((scan) => (
                  <tr key={scan.id} className="hover:bg-neutral-800/30">
                    <td className="py-3 text-neutral-400">
                      {new Date(scan.created_at).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3">
                      <span className="font-semibold text-white block">{scan.brand_name || scan.medicine_name || 'N/A'}</span>
                      {scan.brand_name && <span className="text-[11px] text-neutral-400">{scan.medicine_name}</span>}
                    </td>
                    <td className="py-3 font-mono text-neutral-300">{scan.batch_number || 'N/A'}</td>
                    <td className="py-3 text-neutral-300">{scan.company_name || 'Unregistered'}</td>
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
                        Inspect →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
