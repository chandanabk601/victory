-- =====================================================================
-- VICTORY: Pharmaceutical Verification System Database Schema
-- Architecture: PostgreSQL Relational Database with UUID Keys
-- =====================================================================

-- Ensure pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. USERS TABLE
-- Core authentication and RBAC identity table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'manufacturer', 'user')),
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ---------------------------------------------------------------------
-- 2. MANUFACTURERS TABLE
-- Profile and regulatory verification status for pharmaceutical companies
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) NOT NULL UNIQUE,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    address TEXT,
    approval_status VARCHAR(32) NOT NULL DEFAULT 'pending' 
        CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manufacturers_user_id ON manufacturers(user_id);
CREATE INDEX IF NOT EXISTS idx_manufacturers_status ON manufacturers(approval_status);
CREATE INDEX IF NOT EXISTS idx_manufacturers_license ON manufacturers(license_number);

-- ---------------------------------------------------------------------
-- 3. MANUFACTURER KEYS TABLE
-- Public key registry for Ed25519 digital signatures (Private keys isolated outside DB)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manufacturer_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id UUID NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,
    key_id VARCHAR(100) NOT NULL UNIQUE,
    public_key_pem TEXT NOT NULL,
    algorithm VARCHAR(32) NOT NULL DEFAULT 'ed25519',
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_mfg_keys_key_id ON manufacturer_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_mfg_keys_mfg_id ON manufacturer_keys(manufacturer_id);

-- ---------------------------------------------------------------------
-- 4. MEDICINES TABLE (Master Catalogue)
-- Independent catalogue storing formulation and therapeutic data
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_name VARCHAR(255) NOT NULL,
    brand_name VARCHAR(255),
    manufacturer_name VARCHAR(255),
    composition TEXT,
    strength VARCHAR(100),
    dosage_form VARCHAR(100),
    therapeutic_class VARCHAR(150),
    source VARCHAR(50) NOT NULL DEFAULT 'manual' 
        CHECK (source IN ('manual', 'indian_pharma_dataset', 'csv_import')),
    external_source_id VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(medicine_name);
CREATE INDEX IF NOT EXISTS idx_medicines_brand ON medicines(brand_name);
CREATE INDEX IF NOT EXISTS idx_medicines_source ON medicines(source);

-- ---------------------------------------------------------------------
-- 5. MEDICINE BATCHES TABLE
-- Specific batch records registered by approved manufacturers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medicine_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    manufacturer_id UUID NOT NULL REFERENCES manufacturers(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100) NOT NULL,
    manufacturing_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    revision_number INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'suspended', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_batch_dates CHECK (expiry_date > manufacturing_date),
    CONSTRAINT uq_mfg_med_batch_rev UNIQUE (manufacturer_id, medicine_id, batch_number, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_batches_serial_id ON medicine_batches(serial_id);
CREATE INDEX IF NOT EXISTS idx_batches_batch_no ON medicine_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_batches_status ON medicine_batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON medicine_batches(expiry_date);

-- ---------------------------------------------------------------------
-- 6. DIGITAL SIGNATURES TABLE
-- Cryptographic signatures generated via Ed25519 over canonical batch JSON
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS digital_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES medicine_batches(id) ON DELETE CASCADE,
    key_id VARCHAR(100) NOT NULL REFERENCES manufacturer_keys(key_id),
    canonical_payload TEXT NOT NULL,
    signature_base64 TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dig_sig_batch_id ON digital_signatures(batch_id);
CREATE INDEX IF NOT EXISTS idx_dig_sig_key_id ON digital_signatures(key_id);

-- ---------------------------------------------------------------------
-- 7. SCAN HISTORY TABLE
-- Real-time audit log of medicine verification attempts & duplicate scan detection
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES medicine_batches(id) ON DELETE SET NULL,
    serial_id VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(64),
    user_agent TEXT,
    scan_status VARCHAR(64) NOT NULL,
    verification_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scans_serial_id ON scan_history(serial_id);
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scan_history(created_at);

-- ---------------------------------------------------------------------
-- 8. SUSPICIOUS REPORTS TABLE
-- Citizen and healthcare professional incident reporting
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suspicious_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES medicine_batches(id) ON DELETE SET NULL,
    serial_id VARCHAR(100),
    reporter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reporter_email VARCHAR(255),
    reason VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON suspicious_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_serial ON suspicious_reports(serial_id);

-- ---------------------------------------------------------------------
-- 9. CDSCO NSQ ALERTS TABLE
-- Official regulatory alert registry from Central Drugs Standard Control Organisation
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cdsco_nsq_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_name VARCHAR(255) NOT NULL,
    manufacturer_name VARCHAR(255),
    batch_number VARCHAR(100),
    alert_month_year VARCHAR(50),
    reported_quality_issue TEXT NOT NULL,
    source_url TEXT,
    publication_details TEXT,
    alert_status VARCHAR(32) NOT NULL DEFAULT 'active' 
        CHECK (alert_status IN ('active', 'archived', 'resolved')),
    import_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cdsco_medicine ON cdsco_nsq_alerts(medicine_name);
CREATE INDEX IF NOT EXISTS idx_cdsco_batch ON cdsco_nsq_alerts(batch_number);
