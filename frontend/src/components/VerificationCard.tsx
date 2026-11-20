import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Key,
  Building2,
  Pill,
  FileCheck2,
  Activity,
  AlertCircle,
  Flag,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { VoiceAssistant } from './VoiceAssistant';

export interface VerificationData {
  code: string;
  is_verified: boolean;
  security_principle_disclaimer: string;
  conditions: string[];
  explanation: string;
  warnings: string[];
  medicine?: {
    medicine_name: string;
    brand_name?: string;
    composition?: string;
    strength?: string;
    dosage_form?: string;
    therapeutic_class?: string;
  };
  batch?: {
    serial_id: string;
    batch_number: string;
    manufacturing_date: string;
    expiry_date: string;
    status: string;
    revision_number: number;
    is_expired: boolean;
  };
  manufacturer?: {
    company_name: string;
    license_number: string;
    approval_status: string;
  };
  cryptography?: {
    algorithm: string;
    key_id: string;
    key_status: string;
    signature_valid: boolean;
    signed_at?: string;
  };
  alerts?: {
    cdsco_nsq?: Array<{
      id: string;
      medicine_name: string;
      manufacturer_name?: string;
      batch_number?: string;
      alert_month_year?: string;
      reported_quality_issue: string;
      source_url?: string;
      publication_details?: string;
    }>;
    suspicious_activity_detected: boolean;
    scan_count_last_24h: number;
  };
}

interface VerificationCardProps {
  data: VerificationData;
  onScanAnother?: () => void;
}

export const VerificationCard: React.FC<VerificationCardProps> = ({ data, onScanAnother }) => {
  const { t } = useLanguage();

  const getStatusConfig = () => {
    switch (data.code) {
      case 'VERIFIED':
        return {
          title: t.verification.statusVerified,
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
          textColor: 'text-emerald-400',
          icon: ShieldCheck,
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        };
      case 'EXPIRED':
        return {
          title: t.verification.statusExpired,
          bgColor: 'bg-rose-500/10',
          borderColor: 'border-rose-500/30',
          textColor: 'text-rose-400',
          icon: Clock,
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      case 'INVALID_SIGNATURE':
        return {
          title: t.verification.statusInvalid,
          bgColor: 'bg-rose-500/10',
          borderColor: 'border-rose-500/30',
          textColor: 'text-rose-400',
          icon: ShieldAlert,
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      case 'SUSPICIOUS_ACTIVITY':
        return {
          title: t.verification.statusSuspicious,
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
          textColor: 'text-amber-400',
          icon: Activity,
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
      case 'NSQ_ALERT':
        return {
          title: t.verification.statusNsq,
          bgColor: 'bg-rose-500/10',
          borderColor: 'border-rose-500/30',
          textColor: 'text-rose-400',
          icon: AlertTriangle,
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      case 'SUSPENDED':
      case 'REVOKED':
        return {
          title: data.code === 'REVOKED' ? t.verification.statusRevoked : t.verification.statusSuspended,
          bgColor: 'bg-rose-500/10',
          borderColor: 'border-rose-500/30',
          textColor: 'text-rose-400',
          icon: AlertCircle,
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
      default:
        return {
          title: t.verification.statusUnregistered,
          bgColor: 'bg-neutral-800/40',
          borderColor: 'border-neutral-700',
          textColor: 'text-neutral-300',
          icon: ShieldAlert,
          badgeBg: 'bg-neutral-800 text-neutral-300 border-neutral-700',
        };
    }
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  const speechSummary = `${status.title}. ${data.explanation} ${
    data.warnings.length > 0 ? `Warnings: ${data.warnings.join('. ')}` : ''
  }`;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Mandatory Security Clarification Banner */}
      <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs flex items-start gap-3 shadow-lg">
        <div className="p-1 rounded bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
          <AlertTriangle className="w-3.5 h-3.5" />
        </div>
        <div>
          <span className="font-bold text-amber-400 uppercase tracking-wider mr-1.5">
            {t.common.disclaimerTitle}:
          </span>
          <span className="leading-relaxed">{data.security_principle_disclaimer}</span>
        </div>
      </div>

      {/* 2. Verdict Header Banner */}
      <div className={`p-6 rounded-2xl border ${status.borderColor} ${status.bgColor} shadow-xl relative overflow-hidden`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl border ${status.borderColor} bg-black/40 text-${status.textColor}`}>
              <StatusIcon className={`w-8 h-8 ${status.textColor}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${status.badgeBg}`}>
                  {data.code}
                </span>
                {data.is_verified && (
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Active Registry
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-white mt-1.5">{status.title}</h2>
              <p className="text-sm text-neutral-300 mt-1 max-w-2xl leading-relaxed">
                {data.explanation}
              </p>
            </div>
          </div>

          {/* Voice Assistant */}
          <div className="self-start sm:self-center shrink-0">
            <VoiceAssistant textToSpeak={speechSummary} />
          </div>
        </div>
      </div>

      {/* 3. Safety Warnings & Conditions (If Any) */}
      {data.warnings.length > 0 && (
        <div className="p-5 rounded-xl bg-rose-950/20 border border-rose-900/50 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>Safety Alerts & Regulatory Cautions</span>
          </h4>
          <ul className="space-y-1.5 pl-6 list-disc text-xs text-rose-300/90 leading-relaxed">
            {data.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 4. Detailed Specification Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Medicine Specifications */}
        {data.medicine && (
          <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-800">
              <Pill className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                {t.verification.medicineDetails}
              </h3>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-800/50">
                <span className="text-neutral-400">{t.verification.medicineName}:</span>
                <span className="text-white font-semibold text-right">{data.medicine.medicine_name}</span>
              </div>
              {data.medicine.brand_name && (
                <div className="flex justify-between py-1 border-b border-neutral-800/50">
                  <span className="text-neutral-400">{t.verification.brandName}:</span>
                  <span className="text-emerald-400 font-semibold">{data.medicine.brand_name}</span>
                </div>
              )}
              {data.medicine.composition && (
                <div className="flex justify-between py-1 border-b border-neutral-800/50">
                  <span className="text-neutral-400">{t.verification.composition}:</span>
                  <span className="text-neutral-200 text-right max-w-[240px] truncate">{data.medicine.composition}</span>
                </div>
              )}
              {data.medicine.strength && (
                <div className="flex justify-between py-1 border-b border-neutral-800/50">
                  <span className="text-neutral-400">{t.verification.strength}:</span>
                  <span className="text-neutral-200">{data.medicine.strength}</span>
                </div>
              )}
              {data.medicine.dosage_form && (
                <div className="flex justify-between py-1">
                  <span className="text-neutral-400">{t.verification.dosageForm}:</span>
                  <span className="text-neutral-200">{data.medicine.dosage_form}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Batch & Manufacturing Details */}
        {data.batch && (
          <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-800">
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                {t.verification.batchDetails}
              </h3>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-800/50">
                <span className="text-neutral-400">{t.verification.batchNumber}:</span>
                <span className="text-white font-mono font-bold">{data.batch.batch_number}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/50">
                <span className="text-neutral-400">{t.verification.mfgDate}:</span>
                <span className="text-neutral-200">{data.batch.manufacturing_date}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/50">
                <span className="text-neutral-400">{t.verification.expDate}:</span>
                <span className={`font-semibold ${data.batch.is_expired ? 'text-rose-400 font-bold' : 'text-neutral-200'}`}>
                  {data.batch.expiry_date} {data.batch.is_expired && '(EXPIRED)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/50">
                <span className="text-neutral-400">{t.verification.serialId}:</span>
                <span className="text-neutral-400 font-mono text-[11px] max-w-[200px] truncate">
                  {data.batch.serial_id}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-400">Batch Status:</span>
                <span className="uppercase font-semibold text-emerald-400">{data.batch.status}</span>
              </div>
            </div>
          </div>
        )}

        {/* Manufacturer Details */}
        {data.manufacturer && (
          <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-800">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                {t.verification.manufacturerDetails}
              </h3>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-800/50">
                <span className="text-neutral-400">Company:</span>
                <span className="text-white font-semibold">{data.manufacturer.company_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/50">
                <span className="text-neutral-400">Drug License No:</span>
                <span className="text-neutral-200 font-mono">{data.manufacturer.license_number}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-400">Regulatory Approval:</span>
                <span className={`uppercase font-bold ${data.manufacturer.approval_status === 'approved' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {data.manufacturer.approval_status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Cryptographic Provenance */}
        {data.cryptography && (
          <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-800">
              <Key className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                {t.verification.cryptoDetails}
              </h3>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-800/50">
                <span className="text-neutral-400">{t.verification.algorithm}:</span>
                <span className="text-emerald-400 font-mono font-semibold">{data.cryptography.algorithm}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800/50">
                <span className="text-neutral-400">{t.verification.signingKey}:</span>
                <span className="text-neutral-300 font-mono text-[11px]">{data.cryptography.key_id}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-400">{t.verification.signatureStatus}:</span>
                <span className={`font-bold ${data.cryptography.signature_valid ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {data.cryptography.signature_valid ? 'GENUINE & INTACT' : 'TAMPERED / INVALID'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. CDSCO NSQ Regulatory Alert Cross-Reference (If Alert Matches) */}
      {data.alerts?.cdsco_nsq && data.alerts.cdsco_nsq.length > 0 && (
        <div className="p-5 rounded-2xl bg-rose-950/30 border border-rose-800/80 space-y-3">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-sm font-bold tracking-wide">
              Official CDSCO Not of Standard Quality (NSQ) Regulatory Alerts Found
            </h3>
          </div>
          <div className="space-y-3">
            {data.alerts.cdsco_nsq.map((alert) => (
              <div key={alert.id} className="p-3.5 rounded-xl bg-black/60 border border-rose-900/40 text-xs space-y-1.5">
                <div className="flex justify-between text-neutral-300">
                  <span className="font-semibold text-white">{alert.medicine_name}</span>
                  <span className="text-rose-400 font-mono">Batch: {alert.batch_number || 'N/A'}</span>
                </div>
                <p className="text-rose-300/90 font-medium">Quality Failure: {alert.reported_quality_issue}</p>
                <div className="flex justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/50">
                  <span>Period: {alert.alert_month_year || 'Recent Alert'}</span>
                  {alert.source_url && (
                    <a href={alert.source_url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                      View Official Gazette
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-neutral-800">
        <Link
          to={`/report?serial=${data.batch?.serial_id || ''}`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-rose-400 hover:text-rose-300 transition-colors w-full sm:w-auto justify-center"
        >
          <Flag className="w-3.5 h-3.5" />
          <span>{t.verification.reportButton}</span>
        </Link>

        {onScanAnother && (
          <button
            onClick={onScanAnother}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 w-full sm:w-auto justify-center"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{t.verification.scanAnother}</span>
          </button>
        )}
      </div>
    </div>
  );
};
