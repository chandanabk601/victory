import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QrCode, Search, ExternalLink, ShieldCheck, Calendar } from 'lucide-react';
import { api } from '../../services/api';

export const AdminBatches: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await api.get('/admin/batches');
        if (res.data.success) {
          setBatches(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch admin batches', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBatches();
  }, []);

  const filtered = batches.filter((b) => {
    const term = search.toLowerCase();
    return (
      b.batch_number.toLowerCase().includes(term) ||
      b.medicine_name.toLowerCase().includes(term) ||
      b.company_name.toLowerCase().includes(term) ||
      b.serial_id.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <QrCode className="w-6 h-6 text-emerald-400" />
            <span>National Batches & Cryptographic Ledger</span>
          </h1>
          <p className="text-xs text-neutral-400">
            System-wide audit view of all Ed25519-signed pharmaceutical batches across approved manufacturers.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search batch or manufacturer..."
            className="w-full pl-9 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            No registered batches found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="pb-3">Batch Number</th>
                  <th className="pb-3">Manufacturer</th>
                  <th className="pb-3">Medicine Formulation</th>
                  <th className="pb-3">Mfg Date</th>
                  <th className="pb-3">Expiry Date</th>
                  <th className="pb-3">Key ID</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-800/30">
                    <td className="py-3 font-mono font-bold text-white">{b.batch_number}</td>
                    <td className="py-3 text-neutral-300 font-semibold">{b.company_name}</td>
                    <td className="py-3">
                      <span className="font-semibold text-white block">{b.brand_name || b.medicine_name}</span>
                      <span className="text-[11px] text-neutral-400">{b.medicine_name}</span>
                    </td>
                    <td className="py-3 text-neutral-300">{b.manufacturing_date}</td>
                    <td className="py-3 text-neutral-300">{b.expiry_date}</td>
                    <td className="py-3 font-mono text-[11px] text-emerald-400">{b.key_id}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          b.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/verify/${b.serial_id}`}
                        target="_blank"
                        className="text-emerald-400 hover:underline font-semibold inline-flex items-center gap-1"
                      >
                        <span>Verify Record</span>
                        <ExternalLink className="w-3 h-3" />
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
