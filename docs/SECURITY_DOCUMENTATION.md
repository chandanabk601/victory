# VICTORY: Cryptographic & Application Security Documentation

---

## 1. The Fundamental Security Principle

> **CRUCIAL CLARIFICATION**:  
> A valid Ed25519 signature proves the integrity and origin of a signed digital record. It does **NOT** independently prove that the physical medicine is genuine.

### Security Threat Model Analysis
| Attack Vector | Threat Scenario | VICTORY Defense Mechanism |
| :--- | :--- | :--- |
| **Record Tampering** | Attacker alters batch expiry date or medicine composition in transit or DB. | **Ed25519 Asymmetric Signature**: Reconstructed canonical hash mismatch results in instant `INVALID_SIGNATURE` rejection. |
| **Origin Impersonation** | Fraudulent manufacturer claims to be Cipla or Sun Pharma. | **Public Key Registry**: Verification only uses keys officially provisioned to approved manufacturers by regulatory admins. |
| **QR Code Cloning** | Attacker photographs a genuine QR code and prints 10,000 copies on fake bottles. | **Velocity / Duplicate Scan Detection**: Scans within short intervals trigger immediate `SUSPICIOUS_ACTIVITY` alert to consumers. |
| **Regulatory NSQ Failure** | Manufacturer batch was recalled by CDSCO due to chemical contamination. | **CDSCO NSQ Integration**: Verification flags batch with active `NSQ_ALERT` even if cryptographic signature is valid. |
| **Key Compromise** | Manufacturer reports lost key. | **Key Revocation Support**: Admin revokes key in `manufacturer_keys`; subsequent verifications flag `REVOKED`. |

---

## 2. Ed25519 Asymmetric Cryptography

### Why Ed25519?
VICTORY implements **Ed25519** (Edwards-curve Digital Signature Algorithm over Curve25519) via the Node.js native `crypto` module:
- **Speed**: Signature generation takes ~0.1ms; verification takes ~0.2ms.
- **Security**: Equivalent to 3072-bit RSA or NIST P-256 with 128-bit security level.
- **Side-Channel Immunity**: Ed25519 operations run in constant time, eliminating cache-timing attacks.
- **Compact Signatures**: Signatures are exactly 64 bytes (Base64 length: 88 chars).

### Key Lifecycle Management
1. **Key Generation**: Triggered upon Regulatory Admin approval of manufacturer:
   ```typescript
   const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
   ```
2. **Private Key Isolation**: Private keys are formatted as PKCS#8 PEM and stored exclusively in the server filesystem (`keys/<key_id>.pem`) with restricted file permissions (`0o600`). Private keys are **never stored in PostgreSQL** and **never exposed to frontend API endpoints**.
3. **Public Key Registry**: Public keys are formatted as SPKI PEM and stored in `manufacturer_keys` table with unique identifier `KEY-<MFG_UUID>-<TIMESTAMP>`.
4. **Key Rotation & Revocation**: Manufacturers can rotate to a new key pair; old keys remain in registry for historical batch verification unless marked `status = 'revoked'`.

---

## 3. Deterministic Canonicalization

To ensure that valid data signed on one server produces identical bytes during verification, VICTORY applies deterministic canonical serialization:
```typescript
interface CanonicalBatchPayload {
  batch_number: string;
  expiry_date: string;
  manufacturer_id: string;
  manufacturing_date: string;
  medicine_id: string;
  revision_number: number;
  serial_id: string;
}
```
1. Object keys are sorted alphabetically.
2. Values are strictly string-cast.
3. Payload is serialized to compact JSON string:
   ```json
   {"batch_number":"CIP-AZ-9921","expiry_date":"2027-05-31","manufacturer_id":"...","manufacturing_date":"2024-06-01","medicine_id":"...","revision_number":"1","serial_id":"..."}
   ```
4. `crypto.sign(null, Buffer.from(canonical), privateKey)` generates the signature.

---

## 4. Application Security Controls

1. **SQL Injection Prevention**: 100% of queries use PostgreSQL parameterized statements (`$1, $2, ...`). No string concatenation is used in queries.
2. **Password Security**: Passwords are never stored in plaintext. They are hashed using **bcrypt** with a configurable salt cost factor (`saltRounds = 10-12`).
3. **JWT Authentication & RBAC**: Stateless JSON Web Tokens signed with HMAC-SHA256 containing expiration times. Strict Express middleware enforces access controls across `admin`, `manufacturer`, and `user` roles.
4. **Rate Limiting**: `express-rate-limit` prevents brute-force login attempts (20 attempts / 15 mins) and DoS attacks on verification endpoints (60 requests / minute).
5. **Security Headers**: `helmet` configures `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and Content-Security-Policy headers.
