# VICTORY: REST API Documentation

**Project Title**: A Web-Based Pharmaceutical Verification System Using QR Codes and Ed25519 Digital Signatures  
**API Version**: `v1`  
**Base URL**: `http://localhost:5000/api/v1`  
**Protocol**: REST / JSON over HTTP

---

## 1. Authentication Endpoints (`/auth`)

### 1.1 Register Consumer / Citizen
- **Endpoint**: `POST /auth/register`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "full_name": "Rahul Sharma",
    "email": "rahul@example.com",
    "password": "Password@123"
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "success": true,
    "message": "User registered successfully.",
    "data": {
      "token": "<JWT_BEARER_TOKEN>",
      "user": {
        "id": "UUID",
        "email": "rahul@example.com",
        "role": "user",
        "full_name": "Rahul Sharma"
      }
    }
  }
  ```

### 1.2 Register Pharmaceutical Manufacturer
- **Endpoint**: `POST /auth/register-manufacturer`
- **Access**: Public (Approval required from Admin)
- **Request Body**:
  ```json
  {
    "company_name": "Cipla Ltd",
    "license_number": "MH-FDA-2024-99812",
    "full_name": "Dr. Rajesh Varma",
    "email": "qa@cipla.com",
    "contact_email": "regulatory@cipla.com",
    "contact_phone": "+91 22 2482 6000",
    "address": "Cipla House, Peninsula Business Park, Mumbai",
    "password": "Password@123"
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "success": true,
    "message": "Manufacturer registration submitted. Account is pending regulatory admin verification.",
    "data": {
      "token": "<JWT_BEARER_TOKEN>",
      "user": { ... },
      "manufacturer": {
        "id": "UUID",
        "company_name": "Cipla Ltd",
        "license_number": "MH-FDA-2024-99812",
        "approval_status": "pending"
      }
    }
  }
  ```

### 1.3 Universal Login (Admin / Manufacturer / User)
- **Endpoint**: `POST /auth/login`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "admin@victory.pharma",
    "password": "Admin@12345"
  }
  ```
- **Response** (200 OK): Returns JWT token, user payload, and manufacturer object (if role = manufacturer).

### 1.4 Get Current User Profile
- **Endpoint**: `GET /auth/me`
- **Access**: Authenticated (`Bearer <token>`)
- **Response** (200 OK): Returns user details and linked manufacturer company profile.

---

## 2. Medicine Verification Engine (`/verification`)

### 2.1 Verify Medicine by Serial ID
- **Endpoint**: `POST /verification/verify`
- **Access**: Public (Guest verification supported; optional Bearer token records scan under logged-in user)
- **Request Body**:
  ```json
  {
    "serial_id": "47ff01a4-4ad6-4792-91fd-196b00bd15e8"
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": {
      "code": "VERIFIED",
      "is_verified": true,
      "security_principle_disclaimer": "A valid Ed25519 signature proves the integrity and origin of a signed digital record. It does NOT independently prove that the physical medicine is genuine.",
      "conditions": [
        "Digital signature is cryptographically valid and signed by authorized manufacturer key."
      ],
      "explanation": "The digital record for Dolo 650 (Batch: CIP-AZ-9921) has been verified with a cryptographically valid Ed25519 signature from Cipla Ltd. All regulatory and expiry checks passed.",
      "warnings": [],
      "medicine": {
        "medicine_name": "Paracetamol 650mg",
        "brand_name": "Dolo 650",
        "composition": "Paracetamol IP",
        "strength": "650 mg",
        "dosage_form": "Tablet"
      },
      "batch": {
        "serial_id": "47ff01a4-4ad6-4792-91fd-196b00bd15e8",
        "batch_number": "CIP-AZ-9921",
        "manufacturing_date": "2024-06-01",
        "expiry_date": "2027-05-31",
        "status": "active",
        "revision_number": 1,
        "is_expired": false
      },
      "manufacturer": {
        "company_name": "Cipla Ltd",
        "license_number": "MH-FDA-2021-00451",
        "approval_status": "approved"
      },
      "cryptography": {
        "algorithm": "Ed25519",
        "key_id": "KEY-3B9A79B1-1795171954769",
        "key_status": "active",
        "signature_valid": true,
        "signed_at": "2026-11-20T10:52:35.000Z"
      },
      "alerts": {
        "cdsco_nsq": [],
        "suspicious_activity_detected": false,
        "scan_count_last_24h": 1
      }
    }
  }
  ```

### 2.2 Get User Scan History
- **Endpoint**: `GET /verification/my-history`
- **Access**: User Authenticated

---

## 3. Manufacturer Portal (`/manufacturer`)

### 3.1 Get Dashboard & Cryptographic Key Info
- **Endpoint**: `GET /manufacturer/dashboard`
- **Access**: Manufacturer Authenticated

### 3.2 Register & Sign Medicine Batch
- **Endpoint**: `POST /manufacturer/batches`
- **Access**: Approved Manufacturer Authenticated
- **Request Body**:
  ```json
  {
    "medicine_id": "<MEDICINE_UUID>",
    "batch_number": "LOT-2026-90",
    "manufacturing_date": "2024-05-01",
    "expiry_date": "2027-04-30"
  }
  ```
- **Operations Performed**:
  1. Validates expiry date > manufacturing date
  2. Generates UUID serial ID
  3. Constructs deterministic canonical JSON payload
  4. Signs canonical bytes using Ed25519 private key
  5. Inserts batch record and digital signature
  6. Generates QR code data URL (PNG)
- **Response** (201 Created): Returns batch record, signature, canonical payload, and QR data URL.

### 3.3 Download Batch QR Code Image
- **Endpoint**: `GET /manufacturer/batches/:serialId/qr`
- **Access**: Manufacturer Authenticated
- **Response**: Image binary (`image/png`)

---

## 4. Admin Management (`/admin`)

### 4.1 System Dashboard Metrics
- **Endpoint**: `GET /admin/dashboard-stats`
- **Access**: Admin Authenticated
- **Response**: Aggregated counts for users, manufacturers, active batches, verifications, reports, and CDSCO alerts.

### 4.2 Manufacturer Licensing Management
- `GET /admin/manufacturers` - List manufacturers (status filter)
- `POST /admin/manufacturers/:id/approve` - Approve manufacturer and generate Ed25519 key pair
- `POST /admin/manufacturers/:id/reject` - Reject with mandatory reason
- `POST /admin/manufacturers/:id/suspend` - Suspend manufacturer

---

## 5. Medicine Master Catalogue (`/medicines`)

- `GET /medicines` - Search catalogue (supports query `search`, `dosage_form`, `source`, `page`, `limit`)
- `POST /medicines` - Add medicine (Admin only)
- `PUT /medicines/:id` - Update medicine (Admin only)
- `PATCH /medicines/:id/status` - Toggle active status (Admin only)
- `POST /medicines/import-csv` - Upload CSV file / paste CSV text (Admin only)

---

## 6. Incident Reporting (`/reports`)

- `POST /reports` - Citizen submit incident report
- `GET /reports/my-reports` - User personal reports
- `GET /reports` - Admin review all reports (filter by status)
- `PATCH /reports/:id/status` - Admin update investigation status & notes

---

## 7. CDSCO NSQ Regulatory Alerts (`/cdsco`)

- `GET /cdsco` - Search official quality failure alerts
- `POST /cdsco` - Create alert entry (Admin only)
- `PATCH /cdsco/:id/status` - Archive or resolve alert (Admin only)
- `POST /cdsco/import-csv` - Bulk import CDSCO CSV records (Admin only)
