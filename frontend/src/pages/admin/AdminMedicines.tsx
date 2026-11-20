import React, { useEffect, useState, useRef } from 'react';
import {
  Pill,
  Search,
  PlusCircle,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Edit2,
} from 'lucide-react';
import { api } from '../../services/api';

export const AdminMedicines: React.FC = () => {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    medicine_name: '',
    brand_name: '',
    manufacturer_name: '',
    composition: '',
    strength: '',
    dosage_form: 'Tablet',
    therapeutic_class: '',
  });

  const [csvText, setCsvText] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/medicines?search=${search}&page=${page}&limit=20&active_only=false`);
      if (res.data.success) {
        setMedicines(res.data.data.items);
        setTotalPages(res.data.data.pagination.pages);
      }
    } catch (err) {
      console.error('Failed to fetch medicines', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicines();
  }, [search, page]);

  const handleCreateMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/medicines', formData);
      if (res.data.success) {
        setIsAddModalOpen(false);
        setFormData({
          medicine_name: '',
          brand_name: '',
          manufacturer_name: '',
          composition: '',
          strength: '',
          dosage_form: 'Tablet',
          therapeutic_class: '',
        });
        setMessage('Medicine created in master catalogue.');
        fetchMedicines();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create medicine.');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await api.patch(`/medicines/${id}/status`, { is_active: !currentStatus });
      fetchMedicines();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to toggle status.');
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
        alert('Please choose a file or paste CSV text.');
        return;
      }

      const res = await api.post('/medicines/import-csv', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setIsCsvModalOpen(false);
        setCsvFile(null);
        setCsvText('');
        setMessage(res.data.message);
        fetchMedicines();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'CSV import failed.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Pill className="w-6 h-6 text-emerald-400" />
            <span>Medicine Master Catalogue</span>
          </h1>
          <p className="text-xs text-neutral-400">
            Formulation registry with external Indian Pharma dataset mappings and CSV batch import.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-48 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search catalogue..."
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
            <span>Add Medicine</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Catalogue Table */}
      <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800">
        {medicines.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            No medicines found in master catalogue.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="pb-3">Medicine Generic Name</th>
                  <th className="pb-3">Brand Name</th>
                  <th className="pb-3">Composition / Salt</th>
                  <th className="pb-3">Dosage / Form</th>
                  <th className="pb-3">Source Dataset</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {medicines.map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-800/30">
                    <td className="py-3 font-semibold text-white">{m.medicine_name}</td>
                    <td className="py-3 text-emerald-400 font-semibold">{m.brand_name || 'Generic'}</td>
                    <td className="py-3 text-neutral-300 max-w-[200px] truncate">{m.composition || 'N/A'}</td>
                    <td className="py-3 text-neutral-300">{m.strength} • {m.dosage_form}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-neutral-950 border border-neutral-800 text-neutral-400">
                        {m.source}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          m.is_active
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleToggleStatus(m.id, m.is_active)}
                        className={`text-[11px] font-semibold hover:underline ${
                          m.is_active ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {m.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-neutral-800 text-xs text-neutral-400">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded bg-neutral-950 border border-neutral-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded bg-neutral-950 border border-neutral-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Medicine Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
              <h3 className="text-base font-bold text-white">Add Medicine to Master Catalogue</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMedicine} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Medicine Generic Name</label>
                <input
                  type="text"
                  required
                  value={formData.medicine_name}
                  onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
                  placeholder="e.g. Paracetamol 650mg"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">Brand Name</label>
                  <input
                    type="text"
                    value={formData.brand_name}
                    onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                    placeholder="e.g. Dolo 650"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">Strength / Potency</label>
                  <input
                    type="text"
                    value={formData.strength}
                    onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                    placeholder="e.g. 650 mg"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Active Chemical Composition</label>
                <input
                  type="text"
                  value={formData.composition}
                  onChange={(e) => setFormData({ ...formData, composition: e.target.value })}
                  placeholder="e.g. Paracetamol IP (650mg)"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">Dosage Form</label>
                  <select
                    value={formData.dosage_form}
                    onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Ointment">Ointment</option>
                    <option value="Suspension">Suspension</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-300">Therapeutic Class</label>
                  <input
                    type="text"
                    value={formData.therapeutic_class}
                    onChange={(e) => setFormData({ ...formData, therapeutic_class: e.target.value })}
                    placeholder="e.g. Analgesic"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
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
                  Save to Catalogue
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
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <span>Import Medicines Dataset (CSV)</span>
              </h3>
              <button onClick={() => setIsCsvModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Upload a CSV file containing columns: <code className="text-emerald-400">medicine_name, brand_name, composition, strength, dosage_form, therapeutic_class</code>.
            </p>

            <form onSubmit={handleCsvImport} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-6 border-2 border-dashed border-neutral-800 hover:border-emerald-500/50 rounded-xl text-center cursor-pointer space-y-2 bg-neutral-950"
              >
                <Upload className="w-6 h-6 text-neutral-500 mx-auto" />
                <p className="text-xs text-neutral-300">
                  {csvFile ? csvFile.name : 'Click to select CSV file from your computer'}
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
                <label className="text-xs font-semibold text-neutral-400">Or Paste Raw CSV Text:</label>
                <textarea
                  rows={4}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="medicine_name,brand_name,composition,strength,dosage_form..."
                  className="w-full p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-mono text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-500"
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
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs"
                >
                  Execute Dataset Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
