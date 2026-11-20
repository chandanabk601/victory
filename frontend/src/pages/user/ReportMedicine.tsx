import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Flag, AlertTriangle, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export const ReportMedicine: React.FC = () => {
  const [searchParams] = useSearchParams();
  const serialFromQuery = searchParams.get('serial') || '';
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [serialId, setSerialId] = useState(serialFromQuery);
  const [reason, setReason] = useState('Suspected counterfeit');
  const [description, setDescription] = useState('');
  const [reporterEmail, setReporterEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (description.trim().length < 10) {
      setError('Please provide a detailed description (at least 10 characters).');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/reports', {
        serial_id: serialId.trim() || undefined,
        reason,
        description,
        reporter_email: reporterEmail || undefined,
      });

      if (res.data.success) {
        setSuccess(true);
        setDescription('');
      } else {
        setError(res.data.error || 'Failed to submit report.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Report submission failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
          <Flag className="w-6 h-6 text-rose-400" />
          <span>Report Suspicious or Substandard Medicine</span>
        </h1>
        <p className="text-xs text-neutral-400">
          Flag potentially counterfeit, expired, damaged, or unapproved pharmaceuticals directly to national health authorities.
        </p>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Incident Report Submitted Successfully</p>
            <p className="mt-1 text-emerald-300/90">
              Your report has been logged in the regulatory database with status "Pending Review". Thank you for protecting public health.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">Medicine Serial ID (UUID) or Packaging Barcode</label>
          <input
            type="text"
            value={serialId}
            onChange={(e) => setSerialId(e.target.value)}
            placeholder="e.g. 47ff01a4-4ad6-4792-91fd-196b00bd15e8 (Optional if unavailable)"
            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">Reason for Incident Report</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="Suspected counterfeit">Suspected counterfeit (blurry print, strange texture, unsealed)</option>
            <option value="Expired medicine">Expired medicine offered for sale</option>
            <option value="Damaged packaging">Damaged or broken primary packaging</option>
            <option value="Suspicious QR code">Suspicious or unscannable QR code</option>
            <option value="Incorrect medicine details">Incorrect active composition or dosage information</option>
            <option value="Other">Other regulatory concern</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">Detailed Description of Incident</label>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Please detail where the product was purchased (pharmacy name, location), batch details on box, and observed irregularities..."
            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {!user && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Contact Email (For Regulatory Follow-up)</label>
            <input
              type="email"
              value={reporterEmail}
              onChange={(e) => setReporterEmail(e.target.value)}
              placeholder="your.email@example.com (Optional)"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 mt-4"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>Submit Official Incident Report</span>
        </button>
      </form>
    </div>
  );
};
