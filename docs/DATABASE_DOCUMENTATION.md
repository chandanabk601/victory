# VICTORY: Database Architecture & Schema Documentation

**Database Engine**: PostgreSQL 14+ (Tested on PostgreSQL 18.4 x64)  
**Primary Key Strategy**: UUID (Universal Unique Identifiers via `pgcrypto.gen_random_uuid()`)  
**Normalization Level**: 3rd Normal Form (3NF)

---

## 1. Entity-Relationship Design

```
+----------------+          +--------------------+          +---------------------+
|     users      | 1 ---- 1 |   manufacturers    | 1 ---- * |  manufacturer_keys  |
+----------------+          +--------------------+          +---------------------+
       |                              |                                |
       | 1                            | 1                              | 1
       |                              |                                |
       *                              *                                *
+----------------+          +--------------------+          +---------------------+
| suspicious_    |          |  medicine_batches  | 1 ---- * |  digital_signatures |
| reports        |          +--------------------+          +---------------------+
+----------------+                    | 1                              |
       |                              |                                |
       |                              *                                |
       |                    +--------------------+                     |
       +------------------- |    scan_history    | <-------------------+
                            +--------------------+
                                      |
                                      *
                            +--------------------+
                            |     medicines      |
                            +--------------------+
```

---

## 2. Table Specifications

### 2.1 `users`
Core identity table managing role-based access for Citizens, Manufacturers, and Regulatory Admins.
- `id` (UUID, PK)
- `email` (VARCHAR(255), UNIQUE, NOT NULL)
- `password_hash` (VARCHAR(255), NOT NULL) - bcrypt salted hash
- `role` (VARCHAR(32), NOT NULL) - Check: `('admin', 'manufacturer', 'user')`
- `full_name` (VARCHAR(255), NOT NULL)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` / `updated_at` (TIMESTAMP WITH TIME ZONE)

### 2.2 `manufacturers`
Pharmaceutical companies registered for cryptographic batch issuance.
- `id` (UUID, PK)
- `user_id` (UUID, UNIQUE, FK -> `users.id`)
- `company_name` (VARCHAR(255), NOT NULL)
- `license_number` (VARCHAR(100), UNIQUE, NOT NULL) - State/Central Drug License No.
- `contact_email` (VARCHAR(255), NOT NULL)
- `contact_phone` (VARCHAR(50))
- `address` (TEXT)
- `approval_status` (VARCHAR(32), DEFAULT 'pending') - Check: `('pending', 'approved', 'rejected', 'suspended')`
- `approved_at` (TIMESTAMP WITH TIME ZONE)
- `approved_by` (UUID, FK -> `users.id`)
- `rejection_reason` (TEXT)

### 2.3 `manufacturer_keys`
Stores public cryptographic keys for Ed25519 digital signature verification.
- `id` (UUID, PK)
- `manufacturer_id` (UUID, FK -> `manufacturers.id`)
- `key_id` (VARCHAR(100), UNIQUE, NOT NULL) - e.g. `KEY-3B9A79B1-1795171954769`
- `public_key_pem` (TEXT, NOT NULL) - SPKI PEM format
- `algorithm` (VARCHAR(32), DEFAULT 'ed25519')
- `status` (VARCHAR(32), DEFAULT 'active') - Check: `('active', 'revoked')`
- `created_at` / `revoked_at` (TIMESTAMP WITH TIME ZONE)

### 2.4 `medicines` (Master Catalogue)
Formulations catalogue independent of manufacturer-specific batches.
- `id` (UUID, PK)
- `medicine_name` (VARCHAR(255), NOT NULL)
- `brand_name` (VARCHAR(255))
- `manufacturer_name` (VARCHAR(255))
- `composition` (TEXT)
- `strength` (VARCHAR(100))
- `dosage_form` (VARCHAR(100)) - e.g. Tablet, Syrup, Capsule
- `therapeutic_class` (VARCHAR(150))
- `source` (VARCHAR(50), DEFAULT 'manual') - Check: `('manual', 'indian_pharma_dataset', 'csv_import')`
- `external_source_id` (VARCHAR(100))
- `is_active` (BOOLEAN, DEFAULT true)

### 2.5 `medicine_batches`
Physical batch records registered and signed by approved manufacturers.
- `id` (UUID, PK)
- `serial_id` (UUID, UNIQUE, DEFAULT `gen_random_uuid()`) - Printed on QR code
- `medicine_id` (UUID, FK -> `medicines.id`)
- `manufacturer_id` (UUID, FK -> `manufacturers.id`)
- `batch_number` (VARCHAR(100), NOT NULL)
- `manufacturing_date` (DATE, NOT NULL)
- `expiry_date` (DATE, NOT NULL) - Constraint: `expiry_date > manufacturing_date`
- `revision_number` (INT, DEFAULT 1)
- `status` (VARCHAR(32), DEFAULT 'active') - Check: `('active', 'suspended', 'revoked')`
- Constraint: `UNIQUE (manufacturer_id, medicine_id, batch_number, revision_number)`

### 2.6 `digital_signatures`
Stores cryptographic Ed25519 digital signatures.
- `id` (UUID, PK)
- `batch_id` (UUID, FK -> `medicine_batches.id`)
- `key_id` (VARCHAR(100), FK -> `manufacturer_keys.key_id`)
- `canonical_payload` (TEXT, NOT NULL) - Deterministically sorted JSON string
- `signature_base64` (TEXT, NOT NULL) - Ed25519 signature in Base64

### 2.7 `scan_history`
Real-time audit log of every verification scan.
- `id` (UUID, PK)
- `batch_id` (UUID, FK -> `medicine_batches.id`, NULLABLE)
- `serial_id` (VARCHAR(100), NOT NULL)
- `user_id` (UUID, FK -> `users.id`, NULLABLE)
- `ip_address` (VARCHAR(64))
- `user_agent` (TEXT)
- `scan_status` (VARCHAR(64), NOT NULL)
- `verification_message` (TEXT)
- `created_at` (TIMESTAMP WITH TIME ZONE)

### 2.8 `suspicious_reports`
Citizen and healthcare professional incident reports.
- `id` (UUID, PK)
- `batch_id` (UUID, FK -> `medicine_batches.id`, NULLABLE)
- `serial_id` (VARCHAR(100))
- `reporter_user_id` (UUID, FK -> `users.id`, NULLABLE)
- `reporter_email` (VARCHAR(255))
- `reason` (VARCHAR(100), NOT NULL)
- `description` (TEXT, NOT NULL)
- `status` (VARCHAR(32), DEFAULT 'pending') - Check: `('pending', 'reviewed', 'resolved', 'dismissed')`
- `admin_notes` (TEXT)

### 2.9 `cdsco_nsq_alerts`
Published Not of Standard Quality (NSQ) regulatory alerts from Central Drugs Standard Control Organisation.
- `id` (UUID, PK)
- `medicine_name` (VARCHAR(255), NOT NULL)
- `manufacturer_name` (VARCHAR(255))
- `batch_number` (VARCHAR(100))
- `alert_month_year` (VARCHAR(50))
- `reported_quality_issue` (TEXT, NOT NULL)
- `source_url` (TEXT)
- `publication_details` (TEXT)
- `alert_status` (VARCHAR(32), DEFAULT 'active') - Check: `('active', 'archived', 'resolved')`
- `import_date` (TIMESTAMP WITH TIME ZONE)
