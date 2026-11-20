import bcrypt from 'bcryptjs';
import { pool } from './db';
import { config } from '../config';
import { CryptoService } from '../services/crypto.service';
import { importMedicinesFromCsv } from '../scripts/import-medicines';
import { importCdscoAlertsFromCsv } from '../scripts/import-cdsco';
import { CanonicalBatchPayload } from '../types';

export const runSeed = async () => {
  console.log('[Seed] Starting comprehensive database seeding...');
  const client = await pool.connect();

  try {
    // 1. Ensure Keys directory
    CryptoService.ensureKeysDirectory();

    // 2. Passwords
    const adminPassHash = await bcrypt.hash('Admin@12345', config.bcrypt.saltRounds);
    const mfgPassHash = await bcrypt.hash('Mfg@12345', config.bcrypt.saltRounds);
    const userPassHash = await bcrypt.hash('User@12345', config.bcrypt.saltRounds);

    // 3. Admin User
    const adminRes = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, is_active)
       VALUES ('admin@victory.pharma', $1, 'admin', 'Chief Regulatory Officer', true)
       ON CONFLICT (email) DO UPDATE SET password_hash = $1
       RETURNING id`,
      [adminPassHash]
    );
    const adminId = adminRes.rows[0].id;
    console.log('[Seed] Admin user seeded (admin@victory.pharma / Admin@12345)');

    // 4. Approved Manufacturer (Cipla Ltd)
    const ciplaUserRes = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, is_active)
       VALUES ('mfg@cipla.com', $1, 'manufacturer', 'Cipla Quality Assurance Head', true)
       ON CONFLICT (email) DO UPDATE SET password_hash = $1
       RETURNING id`,
      [mfgPassHash]
    );
    const ciplaUserId = ciplaUserRes.rows[0].id;

    const ciplaRes = await client.query(
      `INSERT INTO manufacturers (
        user_id, company_name, license_number, contact_email, contact_phone, address, approval_status, approved_at, approved_by
      ) VALUES ($1, 'Cipla Ltd', 'MH-FDA-2021-00451', 'qa@cipla.com', '+91 22 2482 6000', 'Cipla House, Peninsula Business Park, Lower Parel, Mumbai', 'approved', NOW(), $2)
      ON CONFLICT (license_number) DO UPDATE SET approval_status = 'approved', approved_at = NOW()
      RETURNING id`,
      [ciplaUserId, adminId]
    );
    const ciplaMfgId = ciplaRes.rows[0].id;

    // 5. Generate Ed25519 key for Cipla Ltd
    let keyId = '';
    const keyCheck = await client.query(
      'SELECT key_id FROM manufacturer_keys WHERE manufacturer_id = $1 AND status = \'active\' LIMIT 1',
      [ciplaMfgId]
    );

    if (keyCheck.rows.length === 0) {
      const generated = CryptoService.generateManufacturerKeyPair(ciplaMfgId);
      keyId = generated.keyId;

      await client.query(
        `INSERT INTO manufacturer_keys (manufacturer_id, key_id, public_key_pem, algorithm, status)
         VALUES ($1, $2, $3, 'ed25519', 'active')`,
        [ciplaMfgId, keyId, generated.publicKeyPem]
      );
      console.log(`[Seed] Ed25519 key pair generated and registered for Cipla Ltd (${keyId})`);
    } else {
      keyId = keyCheck.rows[0].key_id;
    }

    // 6. Pending Manufacturer (Sun Pharma)
    const sunUserRes = await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, is_active)
       VALUES ('mfg@sunpharma.com', $1, 'manufacturer', 'Sun Pharma Regulatory Head', true)
       ON CONFLICT (email) DO UPDATE SET password_hash = $1
       RETURNING id`,
      [mfgPassHash]
    );
    const sunUserId = sunUserRes.rows[0].id;

    await client.query(
      `INSERT INTO manufacturers (
        user_id, company_name, license_number, contact_email, contact_phone, address, approval_status
      ) VALUES ($1, 'Sun Pharmaceutical Industries Ltd', 'GJ-FDA-2022-00918', 'regulatory@sunpharma.com', '+91 22 4324 4324', 'Sun House, Goregaon, Mumbai', 'pending')
      ON CONFLICT (license_number) DO NOTHING`,
      [sunUserId]
    );
    console.log('[Seed] Pending manufacturer seeded (mfg@sunpharma.com / Mfg@12345)');

    // 7. Regular Citizen User
    await client.query(
      `INSERT INTO users (email, password_hash, role, full_name, is_active)
       VALUES ('user@example.com', $1, 'user', 'Rahul Sharma', true)
       ON CONFLICT (email) DO UPDATE SET password_hash = $1`,
      [userPassHash]
    );
    console.log('[Seed] Citizen user seeded (user@example.com / User@12345)');

    // 8. Import Medicine Master Catalogue & CDSCO Alerts
    await importMedicinesFromCsv();
    await importCdscoAlertsFromCsv();

    // 9. Fetch an active medicine from catalogue to create realistic batches
    const medRes = await client.query(
      'SELECT id, medicine_name, brand_name FROM medicines WHERE medicine_name ILIKE \'%Azithromycin%\' OR brand_name ILIKE \'%Azee%\' LIMIT 1'
    );

    const paraRes = await client.query(
      'SELECT id, medicine_name, brand_name FROM medicines WHERE medicine_name ILIKE \'%Paracetamol%\' OR brand_name ILIKE \'%Dolo%\' LIMIT 1'
    );

    if (medRes.rows.length > 0 && paraRes.rows.length > 0) {
      const azithroId = medRes.rows[0].id;
      const paracetamolId = paraRes.rows[0].id;

      // Batch A: VALID, ACTIVE BATCH
      const batch1Res = await client.query(
        `INSERT INTO medicine_batches (
          medicine_id, manufacturer_id, batch_number, manufacturing_date, expiry_date, revision_number, status
        ) VALUES ($1, $2, 'CIP-AZ-9921', '2024-06-01', '2027-05-31', 1, 'active')
        ON CONFLICT (manufacturer_id, medicine_id, batch_number, revision_number) 
        DO UPDATE SET updated_at = NOW()
        RETURNING id, serial_id, batch_number`,
        [azithroId, ciplaMfgId]
      );
      const batch1 = batch1Res.rows[0];

      const payload1: CanonicalBatchPayload = {
        serial_id: batch1.serial_id,
        medicine_id: azithroId,
        manufacturer_id: ciplaMfgId,
        batch_number: 'CIP-AZ-9921',
        manufacturing_date: '2024-06-01',
        expiry_date: '2027-05-31',
        revision_number: 1,
      };
      const canon1 = CryptoService.canonicalizePayload(payload1);
      const sig1 = CryptoService.signPayload(keyId, canon1);

      await client.query(
        `INSERT INTO digital_signatures (batch_id, key_id, canonical_payload, signature_base64)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [batch1.id, keyId, canon1, sig1]
      );
      console.log(`[Seed] Batch 1 (VALID): Serial ID = ${batch1.serial_id} (CIP-AZ-9921)`);

      // Batch B: EXPIRED BATCH
      const batch2Res = await client.query(
        `INSERT INTO medicine_batches (
          medicine_id, manufacturer_id, batch_number, manufacturing_date, expiry_date, revision_number, status
        ) VALUES ($1, $2, 'CIP-PARA-EXP', '2021-01-10', '2023-01-09', 1, 'active')
        ON CONFLICT (manufacturer_id, medicine_id, batch_number, revision_number) 
        DO UPDATE SET updated_at = NOW()
        RETURNING id, serial_id, batch_number`,
        [paracetamolId, ciplaMfgId]
      );
      const batch2 = batch2Res.rows[0];

      const payload2: CanonicalBatchPayload = {
        serial_id: batch2.serial_id,
        medicine_id: paracetamolId,
        manufacturer_id: ciplaMfgId,
        batch_number: 'CIP-PARA-EXP',
        manufacturing_date: '2021-01-10',
        expiry_date: '2023-01-09',
        revision_number: 1,
      };
      const canon2 = CryptoService.canonicalizePayload(payload2);
      const sig2 = CryptoService.signPayload(keyId, canon2);

      await client.query(
        `INSERT INTO digital_signatures (batch_id, key_id, canonical_payload, signature_base64)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [batch2.id, keyId, canon2, sig2]
      );
      console.log(`[Seed] Batch 2 (EXPIRED): Serial ID = ${batch2.serial_id} (CIP-PARA-EXP)`);

      // Batch C: FORGED / INVALID SIGNATURE BATCH
      const batch3Res = await client.query(
        `INSERT INTO medicine_batches (
          medicine_id, manufacturer_id, batch_number, manufacturing_date, expiry_date, revision_number, status
        ) VALUES ($1, $2, 'FORGED-BATCH-001', '2024-01-01', '2026-12-31', 1, 'active')
        ON CONFLICT (manufacturer_id, medicine_id, batch_number, revision_number) 
        DO UPDATE SET updated_at = NOW()
        RETURNING id, serial_id, batch_number`,
        [azithroId, ciplaMfgId]
      );
      const batch3 = batch3Res.rows[0];

      const payload3: CanonicalBatchPayload = {
        serial_id: batch3.serial_id,
        medicine_id: azithroId,
        manufacturer_id: ciplaMfgId,
        batch_number: 'FORGED-BATCH-001',
        manufacturing_date: '2024-01-01',
        expiry_date: '2026-12-31',
        revision_number: 1,
      };
      const canon3 = CryptoService.canonicalizePayload(payload3);
      // Intentionally invalid / corrupted signature base64
      const invalidSig = 'TG9yZW0gaXBzdW0gZG9sb3Igc2l0IGF1dGhlbnRpYyBwbGFjZWhvbGRlciBiYXNlNjQgaW52YWxpZA==';

      await client.query(
        `INSERT INTO digital_signatures (batch_id, key_id, canonical_payload, signature_base64)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [batch3.id, keyId, canon3, invalidSig]
      );
      console.log(`[Seed] Batch 3 (INVALID SIGNATURE): Serial ID = ${batch3.serial_id} (FORGED-BATCH-001)`);
    }

    console.log('[Seed] Database seeding completed successfully.');
  } catch (err) {
    console.error('[Seed Error] Database seeding encountered an error:', err);
    throw err;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
