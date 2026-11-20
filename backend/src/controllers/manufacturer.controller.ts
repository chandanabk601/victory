import { Response } from 'express';
import { query, getClient } from '../database/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { registerBatchSchema } from '../validators';
import { CryptoService } from '../services/crypto.service';
import { QrService } from '../services/qr.service';
import { CanonicalBatchPayload } from '../types';

export class ManufacturerController {
  /**
   * Get manufacturer dashboard metrics & active cryptographic key
   */
  public static async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const manufacturerId = req.user?.manufacturerId;
      if (!manufacturerId) {
        res.status(403).json({ success: false, error: 'Manufacturer identity not found.' });
        return;
      }

      // Manufacturer profile
      const mfgRes = await query(
        `SELECT id, company_name, license_number, contact_email, contact_phone,
                address, approval_status, approved_at, rejection_reason
         FROM manufacturers WHERE id = $1`,
        [manufacturerId]
      );

      if (mfgRes.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Manufacturer profile not found.' });
        return;
      }

      // Active cryptographic key
      const keyRes = await query(
        `SELECT key_id, algorithm, status, created_at, public_key_pem
         FROM manufacturer_keys
         WHERE manufacturer_id = $1 AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [manufacturerId]
      );

      // Batch counts
      const countsRes = await query(
        `SELECT 
          COUNT(*) as total_batches,
          COUNT(CASE WHEN status = 'active' AND expiry_date >= CURRENT_DATE THEN 1 END) as active_batches,
          COUNT(CASE WHEN expiry_date < CURRENT_DATE THEN 1 END) as expired_batches,
          COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_batches
         FROM medicine_batches
         WHERE manufacturer_id = $1`,
        [manufacturerId]
      );

      const counts = countsRes.rows[0];

      res.status(200).json({
        success: true,
        data: {
          profile: mfgRes.rows[0],
          cryptographic_key: keyRes.rows[0] || null,
          metrics: {
            total_batches: parseInt(counts.total_batches, 10),
            active_batches: parseInt(counts.active_batches, 10),
            expired_batches: parseInt(counts.expired_batches, 10),
            suspended_batches: parseInt(counts.suspended_batches, 10),
          },
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to load manufacturer dashboard.' });
    }
  }

  /**
   * Register a new medicine batch with real Ed25519 digital signature & QR code
   */
  public static async registerBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    const client = await getClient();
    try {
      const manufacturerId = req.user?.manufacturerId;
      if (!manufacturerId) {
        res.status(403).json({ success: false, error: 'Manufacturer identity not found.' });
        return;
      }

      // Enforce approval status
      const mfgCheck = await client.query(
        'SELECT approval_status FROM manufacturers WHERE id = $1',
        [manufacturerId]
      );

      if (mfgCheck.rows.length === 0 || mfgCheck.rows[0].approval_status !== 'approved') {
        res.status(403).json({
          success: false,
          error: 'Only approved manufacturers can register medicine batches.',
        });
        return;
      }

      const validated = registerBatchSchema.parse(req.body);

      // Verify medicine exists in master catalogue
      const medCheck = await client.query(
        'SELECT id, medicine_name, brand_name FROM medicines WHERE id = $1 AND is_active = true',
        [validated.medicine_id]
      );

      if (medCheck.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Medicine not found in active master catalogue.' });
        return;
      }

      // Check for active cryptographic key
      const keyRes = await client.query(
        'SELECT key_id, public_key_pem FROM manufacturer_keys WHERE manufacturer_id = $1 AND status = \'active\' LIMIT 1',
        [manufacturerId]
      );

      if (keyRes.rows.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No active Ed25519 signing key found. Please contact administration.',
        });
        return;
      }

      const { key_id } = keyRes.rows[0];

      // Check for duplicate batch registration
      const dupCheck = await client.query(
        `SELECT id, revision_number FROM medicine_batches 
         WHERE manufacturer_id = $1 AND medicine_id = $2 AND batch_number = $3
         ORDER BY revision_number DESC LIMIT 1`,
        [manufacturerId, validated.medicine_id, validated.batch_number]
      );

      if (dupCheck.rows.length > 0) {
        res.status(409).json({
          success: false,
          error: `Batch number "${validated.batch_number}" is already registered for this medicine. To update batch data, submit an official revision.`,
        });
        return;
      }

      await client.query('BEGIN');

      // Insert new batch record
      const batchRes = await client.query(
        `INSERT INTO medicine_batches (
          medicine_id, manufacturer_id, batch_number, manufacturing_date, expiry_date, revision_number, status
        ) VALUES ($1, $2, $3, $4, $5, 1, 'active')
        RETURNING id, serial_id, batch_number, manufacturing_date, expiry_date, revision_number, status, created_at`,
        [
          validated.medicine_id,
          manufacturerId,
          validated.batch_number,
          validated.manufacturing_date,
          validated.expiry_date,
        ]
      );

      const batch = batchRes.rows[0];

      // Construct canonical JSON payload
      const canonicalObj: CanonicalBatchPayload = {
        serial_id: batch.serial_id,
        medicine_id: validated.medicine_id,
        manufacturer_id: manufacturerId,
        batch_number: batch.batch_number,
        manufacturing_date: validated.manufacturing_date,
        expiry_date: validated.expiry_date,
        revision_number: 1,
      };

      const canonicalPayload = CryptoService.canonicalizePayload(canonicalObj);

      // Sign payload with Ed25519
      const signatureBase64 = CryptoService.signPayload(key_id, canonicalPayload);

      // Store digital signature
      await client.query(
        `INSERT INTO digital_signatures (
          batch_id, key_id, canonical_payload, signature_base64
        ) VALUES ($1, $2, $3, $4)`,
        [batch.id, key_id, canonicalPayload, signatureBase64]
      );

      await client.query('COMMIT');

      // Generate QR Code data URL
      const qrDataUrl = await QrService.generateQrDataUrl(batch.serial_id);
      const verificationUrl = QrService.getVerificationUrl(batch.serial_id);

      res.status(201).json({
        success: true,
        message: 'Medicine batch registered, cryptographically signed with Ed25519, and QR code generated.',
        data: {
          batch: {
            id: batch.id,
            serial_id: batch.serial_id,
            batch_number: batch.batch_number,
            manufacturing_date: validated.manufacturing_date,
            expiry_date: validated.expiry_date,
            revision_number: batch.revision_number,
            status: batch.status,
            medicine: medCheck.rows[0],
          },
          cryptography: {
            key_id,
            algorithm: 'Ed25519',
            canonical_payload: canonicalPayload,
            signature_base64: signatureBase64,
          },
          qr: {
            verification_url: verificationUrl,
            qr_data_url: qrDataUrl,
          },
        },
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      res.status(500).json({ success: false, error: err.message || 'Batch registration failed.' });
    } finally {
      client.release();
    }
  }

  /**
   * Submit an authorized revision to an existing batch
   * Creates a new revision record and newly signed canonical payload
   */
  public static async reviseBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    const client = await getClient();
    try {
      const { id } = req.params;
      const manufacturerId = req.user?.manufacturerId;
      const validated = registerBatchSchema.parse(req.body);

      // Verify original batch belongs to manufacturer
      const origRes = await client.query(
        `SELECT id, serial_id, batch_number, revision_number 
         FROM medicine_batches 
         WHERE id = $1 AND manufacturer_id = $2`,
        [id, manufacturerId]
      );

      if (origRes.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Original batch record not found or unauthorized.' });
        return;
      }

      const orig = origRes.rows[0];
      const newRevisionNumber = orig.revision_number + 1;

      // Active key
      const keyRes = await client.query(
        'SELECT key_id FROM manufacturer_keys WHERE manufacturer_id = $1 AND status = \'active\' LIMIT 1',
        [manufacturerId]
      );
      const { key_id } = keyRes.rows[0];

      await client.query('BEGIN');

      // Update existing batch to superseded/update revision
      const updateRes = await client.query(
        `UPDATE medicine_batches 
         SET manufacturing_date = $1, expiry_date = $2, revision_number = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING id, serial_id, batch_number, manufacturing_date, expiry_date, revision_number`,
        [validated.manufacturing_date, validated.expiry_date, newRevisionNumber, id]
      );

      const updatedBatch = updateRes.rows[0];

      const canonicalObj: CanonicalBatchPayload = {
        serial_id: updatedBatch.serial_id,
        medicine_id: validated.medicine_id,
        manufacturer_id: manufacturerId!,
        batch_number: updatedBatch.batch_number,
        manufacturing_date: validated.manufacturing_date,
        expiry_date: validated.expiry_date,
        revision_number: newRevisionNumber,
      };

      const canonicalPayload = CryptoService.canonicalizePayload(canonicalObj);
      const signatureBase64 = CryptoService.signPayload(key_id, canonicalPayload);

      // Insert revision signature
      await client.query(
        `INSERT INTO digital_signatures (batch_id, key_id, canonical_payload, signature_base64)
         VALUES ($1, $2, $3, $4)`,
        [id, key_id, canonicalPayload, signatureBase64]
      );

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: `Batch revised to Revision ${newRevisionNumber} and resigned with Ed25519.`,
        data: {
          batch: updatedBatch,
          cryptography: {
            key_id,
            revision_number: newRevisionNumber,
            signature_base64: signatureBase64,
          },
        },
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ success: false, error: err.message || 'Batch revision failed.' });
    } finally {
      client.release();
    }
  }

  /**
   * List batches registered by this manufacturer
   */
  public static async listMyBatches(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const manufacturerId = req.user?.manufacturerId;
      const { search, status } = req.query;

      let queryText = `
        SELECT b.id, b.serial_id, b.batch_number, b.manufacturing_date, b.expiry_date,
               b.revision_number, b.status, b.created_at,
               m.id as medicine_id, m.medicine_name, m.brand_name, m.dosage_form, m.strength,
               ds.key_id, ds.signature_base64,
               (SELECT COUNT(*) FROM scan_history s WHERE s.batch_id = b.id) as scan_count
        FROM medicine_batches b
        JOIN medicines m ON b.medicine_id = m.id
        LEFT JOIN digital_signatures ds ON b.id = ds.batch_id
        WHERE b.manufacturer_id = $1
      `;
      const params: any[] = [manufacturerId];

      if (status && typeof status === 'string') {
        params.push(status);
        queryText += ` AND b.status = $${params.length}`;
      }

      if (search && typeof search === 'string') {
        params.push(`%${search}%`);
        queryText += ` AND (b.batch_number ILIKE $${params.length} OR m.medicine_name ILIKE $${params.length} OR m.brand_name ILIKE $${params.length})`;
      }

      queryText += ' ORDER BY b.created_at DESC';

      const result = await query(queryText, params);
      res.status(200).json({ success: true, data: result.rows });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list batches.' });
    }
  }

  /**
   * Download QR code as PNG image for a specific batch
   */
  public static async downloadQrCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { serialId } = req.params;
      const manufacturerId = req.user?.manufacturerId;

      // Verify batch belongs to manufacturer
      const batchRes = await query(
        'SELECT batch_number FROM medicine_batches WHERE serial_id = $1 AND manufacturer_id = $2',
        [serialId, manufacturerId]
      );

      if (batchRes.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Batch not found or unauthorized.' });
        return;
      }

      const qrPngBuffer = await QrService.generateQrBuffer(serialId);

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="VICTORY-QR-${batchRes.rows[0].batch_number}-${serialId.slice(0, 8)}.png"`);
      res.send(qrPngBuffer);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to download QR code.' });
    }
  }
}
