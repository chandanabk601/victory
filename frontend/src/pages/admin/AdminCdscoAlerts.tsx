import React, { useEffect, useState, useRef } from 'react';
import {
  AlertOctagon,
  Search,
  PlusCircle,
  Upload,
  ExternalLink,
  CheckCircle2,
  FileSpreadsheet,
  X,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api';

export const AdminCdscoAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    medicine_name: '',
    manufacturer_name: '',
    batch_number: '',
    alert_month_year: '',
    reported_quality_issue: '',
    source_url: 'https://cdscoonline.gov.in/CDSCO/viewPublicNSQDrug',
    publication_details: '',
  });

  const [csvText, setCsvText] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/cdsco?search=${search}&status=${statusFilter}&limit=100`);
      if (res.data.success) {
        setAlerts(res.data.data.items);
      }
    } catch (err) {
      console.error('Failed to fetch CDSCO alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [search, statusFilter]);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/cdsco', formData);
      if (res.data.success) {
        setIsAddModalOpen(false);
        setFormData({
          medicine_name: '',
          manufacturer_name: '',
          batch_number: '',
          alert_month_year: '',
          reported_quality_issue: '',
          source_url: 'https://cdscoonline.gov.in/CDSCO/viewPublicNSQDrug',
          publication_details: '',
        });
        setMessage('CDSCO NSQ regulatory alert created.');
        fetchAlerts();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create alert.');
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = new FormData();
      if (csvFile) {
        data.append('file', csvFile);
      } else if (csvText.trim()) {
        data.append('csv_text', csvText);
      } else {
        alert('Please choose a CSV file or paste CSV text.');
        return;
      }

      const res = await api.post('/cdsco/import-csv', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setIsCsvModalOpen(false);
        setCsvFile(null);
        setCsvText('');
        setMessage(res.data.message);
        fetchAlerts();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'CDSCO CSV import failed.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <AlertOctagon className="w-6 h-6 text-amber-400" />
            <span>CDSCO Not of Standard Quality (NSQ) Registry</span>
          </h1>
          <p className="text-xs text-neutral-400">
            Official monthly drug quality failure circulars published by Central Drugs Standard Control Organisation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Alerts</option>
            <option value="active">Active Alerts</option>
            <option value="archived">Archived</option>
            <option value="resolved">Resolved</option>
          </select>

          <div className="relative w-48 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search alert by medicine or batch..."
              className="w-full pl-9 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-200 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Alert</span>
          </button>
        </div>
      </div>

      {/* Regulatory Reminder */}
      <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-400 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-neutral-200">Regulatory Directive:</strong> NSQ records are official reference alerts. Absence from this list does not automatically guarantee authenticity, and matches are cross-checked during verification to alert citizens to reported sample failures.
        </p>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Alerts Table */}
      <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800">
        {alerts.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            No CDSCO NSQ alerts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="pb-3">Drug / Medicine Name</th>
                  <th className="pb-3">Reported Manufacturer</th>
                  <th className="pb-3">Batch Number</th>
                  <th className="pb-3">Alert Period</th>
                  <th className="pb-3">Reported Quality Failure / Issue</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Gazette URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {alerts.map((a) => (
                  <tr key={a.id} className="hover:bg-neutral-800/30">
                    <td className="py-3 font-semibold text-white">{a.medicine_name}</td>
                    <td className="py-3 text-neutral-300">{a.manufacturer_name || 'Not Declared'}</td>
                    <td className="py-3 font-mono font-bold text-rose-400">{a.batch_number || 'All Batches'}</td>
                    <td className="py-3 text-neutral-400">{a.alert_month_year || 'Recent'}</td>
                    <td className="py-3 text-rose-300/90 max-w-[280px] truncate">{a.reported_quality_issue}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          a.alert_status === 'active'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {a.alert_status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {a.source_url && (
                        <a
                          href={a.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline font-semibold inline-flex items-center gap-1"
                        >
                          <span>Gazette</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Alert Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white">Create CDSCO NSQ Alert Record</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAlert} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Drug / Medicine Name</label>
                <input
                  type="text"
                  required
                  value={formData.medicine_name}
                  onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
                  placeholder="e.g. Cough Syrup Promethazine"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">Manufacturer (As per label)</label>
                  <input
                    type="text"
                    value={formData.manufacturer_name}
                    onChange={(e) => setFormData({ ...formData, manufacturer_name: e.target.value })}
                    placeholder="e.g. Maiden Pharmaceuticals"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">Failed Batch Number</label>
                  <input
                    type="text"
                    value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                    placeholder="e.g. PR-7701"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">Alert Month & Year</label>
                  <input
                    type="text"
                    value={formData.alert_month_year}
                    onChange={(e) => setFormData({ ...formData, alert_month_year: e.target.value })}
                    placeholder="e.g. October 2024"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">Circular / Gazette Ref</label>
                  <input
                    type="text"
                    value={formData.publication_details}
                    onChange={(e) => setFormData({ ...formData, publication_details: e.target.value })}
                    placeholder="e.g. CDSCO/HQ/2024/NSQ-10"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Reported Quality Issue (Reason for NSQ)</label>
                <textarea
                  rows={2}
                  required
                  value={formData.reported_quality_issue}
                  onChange={(e) => setFormData({ ...formData, reported_quality_issue: e.target.value })}
                  placeholder="e.g. Fails dissolution assay; presence of diethylene glycol beyond standard limits..."
                  className="w-full p-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs"
                >
                  Save CDSCO Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <span>Import CDSCO NSQ Alerts (CSV)</span>
              </h3>
              <button onClick={() => setIsCsvModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Upload CDSCO published alerts CSV with columns: <code className="text-amber-400">medicine_name, manufacturer_name, batch_number, alert_month_year, reported_quality_issue</code>.
            </p>

            <form onSubmit={handleCsvImport} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-neutral-800 hover:border-amber-500/50 rounded-xl text-center cursor-pointer space-y-2 bg-neutral-950"
              >
                <Upload className="w-6 h-6 text-neutral-500 mx-auto" />
                <p className="text-xs text-neutral-300">
                  {csvFile ? csvFile.name : 'Click to select CDSCO CSV file'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-400">Or Paste Raw CSV Rows:</label>
                <textarea
                  rows={4}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="medicine_name,manufacturer_name,batch_number,alert_month_year,reported_quality_issue..."
                  className="w-full p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-mono text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
                >
                  Import NSQ Alerts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
