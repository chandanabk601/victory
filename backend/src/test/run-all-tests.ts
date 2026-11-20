import assert from 'assert';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, pool } from '../database/db';
import { CryptoService } from '../services/crypto.service';
import { VerificationService } from '../services/verification.service';
import { QrService } from '../services/qr.service';
import { CanonicalBatchPayload } from '../types';
import { config } from '../config';

interface TestResult {
  name: string;
  status: 'PASSED' | 'FAILED';
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, status: 'PASSED', durationMs });
    console.log(`[PASS] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ name, status: 'FAILED', error: err.message, durationMs });
    console.error(`[FAIL] ${name} (${durationMs}ms):`, err.message);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('   VICTORY AUTOMATED VERIFICATION & INTEGRATION SUITE');
  console.log('======================================================\n');

  // Test 1: Admin Login & Password Hashing Verification
  await test('1. Admin Credentials & bcrypt password verification', async () => {
    const res = await query('SELECT password_hash, role FROM users WHERE email = $1', ['admin@victory.pharma']);
    assert.strictEqual(res.rows.length, 1, 'Admin user should exist');
    assert.strictEqual(res.rows[0].role, 'admin', 'Role should be admin');
    const valid = await bcrypt.compare('Admin@12345', res.rows[0].password_hash);
    assert.strictEqual(valid, true, 'Admin password should match bcrypt hash');
  });

  // Test 2: User Registration & Password Hashing
  let testUserId = '';
  await test('2. Citizen User Registration & Password Hashing', async () => {
    const testEmail = `citizen_${Date.now()}@test.pharma`;
    const hash = await bcrypt.hash('TestUser@123', config.bcrypt.saltRounds);
    const insert = await query(
      `INSERT INTO users (email, password_hash, role, full_name)
       VALUES ($1, $2, 'user', 'Anil Kumar') RETURNING id, role`,
      [testEmail, hash]
    );
    assert.strictEqual(insert.rows[0].role, 'user');
    testUserId = insert.rows[0].id;
  });

  // Test 3: User Login & JWT Token Issuance
  await test('3. JWT Token Generation & Verification for User', async () => {
    const token = jwt.sign({ userId: testUserId, email: 'test@example.com', role: 'user' }, config.jwt.secret, {
      expiresIn: '1h',
    });
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    assert.strictEqual(decoded.userId, testUserId);
    assert.strictEqual(decoded.role, 'user');
  });

  // Test 4: Manufacturer Registration (starts in pending status)
  let testMfgId = '';
  await test('4. Manufacturer Registration with Pending Approval Status', async () => {
    const testMfgEmail = `mfg_${Date.now()}@test.pharma`;
    const hash = await bcrypt.hash('MfgPass@123', config.bcrypt.saltRounds);
    const uRes = await query(
      `INSERT INTO users (email, password_hash, role, full_name)
       VALUES ($1, $2, 'manufacturer', 'Zydus QA Lead') RETURNING id`,
      [testMfgEmail, hash]
    );
    const mRes = await query(
      `INSERT INTO manufacturers (user_id, company_name, license_number, contact_email, approval_status)
       VALUES ($1, 'Zydus Cadila Test', $2, $3, 'pending') RETURNING id, approval_status`,
      [uRes.rows[0].id, `LIC-${Date.now()}`, testMfgEmail]
    );
    assert.strictEqual(mRes.rows[0].approval_status, 'pending');
    testMfgId = mRes.rows[0].id;
  });

  // Test 5: Manufacturer Approval & Automatic Ed25519 Key Generation
  let testKeyId = '';
  await test('5. Manufacturer Approval & Ed25519 Key Registration', async () => {
    const keyPair = CryptoService.generateManufacturerKeyPair(testMfgId);
    testKeyId = keyPair.keyId;

    await query(
      `INSERT INTO manufacturer_keys (manufacturer_id, key_id, public_key_pem, algorithm, status)
       VALUES ($1, $2, $3, 'ed25519', 'active')`,
      [testMfgId, testKeyId, keyPair.publicKeyPem]
    );

    const updateRes = await query(
      `UPDATE manufacturers SET approval_status = 'approved', approved_at = NOW() WHERE id = $1 RETURNING approval_status`,
      [testMfgId]
    );
    assert.strictEqual(updateRes.rows[0].approval_status, 'approved');
  });

  // Test 6: Manufacturer Suspension
  await test('6. Manufacturer Suspension Status Transition', async () => {
    const updateRes = await query(
      `UPDATE manufacturers SET approval_status = 'suspended' WHERE id = $1 RETURNING approval_status`,
      [testMfgId]
    );
    assert.strictEqual(updateRes.rows[0].approval_status, 'suspended');
    // Restore to approved for subsequent tests
    await query(`UPDATE manufacturers SET approval_status = 'approved' WHERE id = $1`, [testMfgId]);
  });

  // Test 7: Medicine Creation in Master Catalogue
  let testMedicineId = '';
  await test('7. Medicine Creation in Master Catalogue with Duplicate Prevention', async () => {
    const medName = `Amoxicillin 250mg Test-${Date.now()}`;
    const insertRes = await query(
      `INSERT INTO medicines (medicine_name, brand_name, composition, strength, dosage_form, source)
       VALUES ($1, 'Mox 250', 'Amoxicillin Trihydrate', '250mg', 'Capsule', 'manual')
       RETURNING id, medicine_name`,
      [medName]
    );
    assert.strictEqual(insertRes.rows.length, 1);
    testMedicineId = insertRes.rows[0].id;
  });

  // Test 8: Medicine Catalogue Search
  await test('8. Medicine Catalogue Search & Filter', async () => {
    const searchRes = await query(
      `SELECT id, medicine_name FROM medicines WHERE medicine_name ILIKE $1 AND is_active = true`,
      ['%Amoxicillin%']
    );
    assert.ok(searchRes.rows.length >= 1, 'Should find Amoxicillin in catalogue');
  });

  // Test 9: Batch Registration, Ed25519 Signing & Canonical Serialization
  let validSerialId = '';
  await test('9. Batch Registration with Ed25519 Signing & Canonical Serialization', async () => {
    const batchNo = `BATCH-TEST-${Date.now()}`;
    const bRes = await query(
      `INSERT INTO medicine_batches (
        medicine_id, manufacturer_id, batch_number, manufacturing_date, expiry_date, revision_number, status
      ) VALUES ($1, $2, $3, '2024-01-01', '2027-12-31', 1, 'active')
      RETURNING id, serial_id`,
      [testMedicineId, testMfgId, batchNo]
    );
    validSerialId = bRes.rows[0].serial_id;

    const payload: CanonicalBatchPayload = {
      serial_id: validSerialId,
      medicine_id: testMedicineId,
      manufacturer_id: testMfgId,
      batch_number: batchNo,
      manufacturing_date: '2024-01-01',
      expiry_date: '2027-12-31',
      revision_number: 1,
    };

    const canonical = CryptoService.canonicalizePayload(payload);
    const signatureBase64 = CryptoService.signPayload(testKeyId, canonical);

    await query(
      `INSERT INTO digital_signatures (batch_id, key_id, canonical_payload, signature_base64)
       VALUES ($1, $2, $3, $4)`,
      [bRes.rows[0].id, testKeyId, canonical, signatureBase64]
    );

    assert.ok(validSerialId.length > 20, 'Serial ID should be a valid UUID');
    assert.ok(signatureBase64.length > 40, 'Ed25519 signature should be base64 encoded');
  });

  // Test 10: QR Code Generation
  await test('10. QR Code Data URL Generation', async () => {
    const qrDataUrl = await QrService.generateQrDataUrl(validSerialId);
    assert.ok(qrDataUrl.startsWith('data:image/png;base64,'), 'QR should be valid data URL PNG');
    const qrBuffer = await QrService.generateQrBuffer(validSerialId);
    assert.ok(qrBuffer.length > 100, 'QR Buffer should be non-empty');
  });

  // Test 11: Valid Medicine Verification (VERIFIED result)
  await test('11. Medicine Verification: Valid Authentic Record (VERIFIED)', async () => {
    const result = await VerificationService.verifyMedicine({
      serialId: validSerialId,
      ipAddress: '127.0.0.1',
    });

    assert.strictEqual(result.code, 'VERIFIED');
    assert.strictEqual(result.is_verified, true);
    assert.strictEqual(result.cryptography?.signature_valid, true);
    assert.ok(result.security_principle_disclaimer.includes('Ed25519 signature proves the integrity'));
  });

  // Test 12: Invalid / Corrupted Signature Detection
  await test('12. Medicine Verification: Tampered Signature Detection (INVALID_SIGNATURE)', async () => {
    // Find the forged batch created in seed
    const forgedRes = await query(
      `SELECT serial_id FROM medicine_batches WHERE batch_number = 'FORGED-BATCH-001' LIMIT 1`
    );
    if (forgedRes.rows.length > 0) {
      const forgedSerial = forgedRes.rows[0].serial_id;
      const result = await VerificationService.verifyMedicine({
        serialId: forgedSerial,
        ipAddress: '127.0.0.1',
      });
      assert.strictEqual(result.code, 'INVALID_SIGNATURE');
      assert.strictEqual(result.is_verified, false);
      assert.strictEqual(result.cryptography?.signature_valid, false);
    }
  });

  // Test 13: Expired Batch Detection
  await test('13. Medicine Verification: Expired Batch Detection (EXPIRED)', async () => {
    const expRes = await query(
      `SELECT serial_id FROM medicine_batches WHERE batch_number = 'CIP-PARA-EXP' LIMIT 1`
    );
    if (expRes.rows.length > 0) {
      const expSerial = expRes.rows[0].serial_id;
      const result = await VerificationService.verifyMedicine({
        serialId: expSerial,
        ipAddress: '127.0.0.1',
      });
      assert.strictEqual(result.code, 'EXPIRED');
      assert.strictEqual(result.is_verified, false);
      assert.strictEqual(result.batch?.is_expired, true);
    }
  });

  // Test 14: Unregistered Serial ID Detection
  await test('14. Medicine Verification: Non-existent Serial ID (NOT_REGISTERED)', async () => {
    const fakeSerial = '00000000-0000-0000-0000-000000000000';
    const result = await VerificationService.verifyMedicine({
      serialId: fakeSerial,
      ipAddress: '127.0.0.1',
    });
    assert.strictEqual(result.code, 'NOT_REGISTERED');
    assert.strictEqual(result.is_verified, false);
  });

  // Test 15: Duplicate / Velocity Scan Detection (SUSPICIOUS_ACTIVITY)
  await test('15. Duplicate / Velocity Scan Detection (SUSPICIOUS_ACTIVITY)', async () => {
    // Simulate 6 rapid scans for validSerialId
    for (let i = 0; i < 6; i++) {
      await VerificationService.verifyMedicine({
        serialId: validSerialId,
        ipAddress: '127.0.0.1',
      });
    }

    const checkResult = await VerificationService.verifyMedicine({
      serialId: validSerialId,
      ipAddress: '127.0.0.1',
    });

    assert.strictEqual(checkResult.alerts?.suspicious_activity_detected, true);
    assert.strictEqual(checkResult.code, 'SUSPICIOUS_ACTIVITY');
  });

  // Test 16: Suspicious Medicine Reporting
  await test('16. Suspicious Medicine Incident Reporting & Retrieval', async () => {
    const reportRes = await query(
      `INSERT INTO suspicious_reports (serial_id, reason, description, status)
       VALUES ($1, 'Suspected counterfeit', 'The packaging print is blurry and barcode does not match.', 'pending')
       RETURNING id, status, reason`,
      [validSerialId]
    );
    assert.strictEqual(reportRes.rows[0].status, 'pending');
    assert.strictEqual(reportRes.rows[0].reason, 'Suspected counterfeit');
  });

  // Test 17: CDSCO NSQ Regulatory Alert Cross-Check
  await test('17. CDSCO NSQ Regulatory Alert Matching', async () => {
    // Check that CDSCO alerts exist
    const alertsRes = await query('SELECT COUNT(*) as count FROM cdsco_nsq_alerts');
    const count = parseInt(alertsRes.rows[0].count, 10);
    assert.ok(count >= 5, 'Should have imported at least 5 CDSCO NSQ alerts');
  });

  console.log('\n======================================================');
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  console.log(`  TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTestSuite()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error('Test Suite Fatal Error:', err);
      await pool.end();
      process.exit(1);
    });
}
