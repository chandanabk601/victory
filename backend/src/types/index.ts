export type UserRole = 'admin' | 'manufacturer' | 'user';

export type ManufacturerApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type BatchStatus = 'active' | 'suspended' | 'revoked';

export type KeyStatus = 'active' | 'revoked';

export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export type ReportReason = 
  | 'Suspected counterfeit'
  | 'Expired medicine'
  | 'Damaged packaging'
  | 'Suspicious QR code'
  | 'Incorrect medicine details'
  | 'Other';

export type VerificationResultCode = 
  | 'VERIFIED'
  | 'EXPIRED'
  | 'INVALID_SIGNATURE'
  | 'NOT_REGISTERED'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'NSQ_ALERT';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  full_name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Manufacturer {
  id: string;
  user_id: string;
  company_name: string;
  license_number: string;
  contact_email: string;
  contact_phone?: string;
  address?: string;
  approval_status: ManufacturerApprovalStatus;
  approved_at?: Date;
  approved_by?: string;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ManufacturerKey {
  id: string;
  manufacturer_id: string;
  key_id: string;
  public_key_pem: string;
  algorithm: string;
  status: KeyStatus;
  created_at: Date;
  revoked_at?: Date;
}

export interface Medicine {
  id: string;
  medicine_name: string;
  brand_name?: string;
  manufacturer_name?: string;
  composition?: string;
  strength?: string;
  dosage_form?: string;
  therapeutic_class?: string;
  source: 'manual' | 'indian_pharma_dataset' | 'csv_import';
  external_source_id?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MedicineBatch {
  id: string;
  serial_id: string;
  medicine_id: string;
  manufacturer_id: string;
  batch_number: string;
  manufacturing_date: string;
  expiry_date: string;
  revision_number: number;
  status: BatchStatus;
  created_at: Date;
  updated_at: Date;
}

export interface DigitalSignature {
  id: string;
  batch_id: string;
  key_id: string;
  canonical_payload: string;
  signature_base64: string;
  created_at: Date;
}

export interface CanonicalBatchPayload {
  serial_id: string;
  medicine_id: string;
  manufacturer_id: string;
  batch_number: string;
  manufacturing_date: string;
  expiry_date: string;
  revision_number: number;
}

export interface ScanHistory {
  id: string;
  batch_id?: string;
  serial_id: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  scan_status: string;
  verification_message?: string;
  created_at: Date;
}

export interface SuspiciousReport {
  id: string;
  batch_id?: string;
  serial_id?: string;
  reporter_user_id?: string;
  reporter_email?: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  admin_notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CdscoNsqAlert {
  id: string;
  medicine_name: string;
  manufacturer_name?: string;
  batch_number?: string;
  alert_month_year?: string;
  reported_quality_issue: string;
  source_url?: string;
  publication_details?: string;
  alert_status: 'active' | 'archived' | 'resolved';
  import_date: Date;
}

export interface VerificationResponse {
  code: VerificationResultCode;
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
    status: BatchStatus;
    revision_number: number;
    is_expired: boolean;
  };
  manufacturer?: {
    company_name: string;
    license_number: string;
    approval_status: ManufacturerApprovalStatus;
  };
  cryptography?: {
    algorithm: string;
    key_id: string;
    key_status: KeyStatus;
    signature_valid: boolean;
    signed_at?: string;
  };
  alerts?: {
    cdsco_nsq?: CdscoNsqAlert[];
    suspicious_activity_detected: boolean;
    scan_count_last_24h: number;
  };
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  manufacturerId?: string;
}
