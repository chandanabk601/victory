import { Response } from 'express';
import { query, getClient } from '../database/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { CryptoService } from '../services/crypto.service';

export class AdminController {
  /**
   * Get Real-time Aggregated System Statistics for Admin Dashboard
   */
  public static async getDashboardStats(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const statsQuery = `
        SELECT
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM users WHERE role = 'user') as citizen_users,
          (SELECT COUNT(*) FROM manufacturers) as total_manufacturers,
          (SELECT COUNT(*) FROM manufacturers WHERE approval_status = 'approved') as approved_manufacturers,
          (SELECT COUNT(*) FROM manufacturers WHERE approval_status = 'pending') as pending_manufacturers,
          (SELECT COUNT(*) FROM manufacturers WHERE approval_status = 'rejected') as rejected_manufacturers,
          (SELECT COUNT(*) FROM manufacturers WHERE approval_status = 'suspended') as suspended_manufacturers,
          (SELECT COUNT(*) FROM medicines) as total_medicines,
          (SELECT COUNT(*) FROM medicines WHERE is_active = true) as active_medicines,
          (SELECT COUNT(*) FROM medicine_batches) as total_batches,
          (SELECT COUNT(*) FROM medicine_batches WHERE status = 'active') as active_batches,
          (SELECT COUNT(*) FROM scan_history) as total_scans,
          (SELECT COUNT(*) FROM scan_history WHERE scan_status = 'VERIFIED') as verified_scans,
          (SELECT COUNT(*) FROM scan_history WHERE scan_status != 'VERIFIED') as alert_scans,
          (SELECT COUNT(*) FROM suspicious_reports) as total_reports,
          (SELECT COUNT(*) FROM suspicious_reports WHERE status = 'pending') as pending_reports,
          (SELECT COUNT(*) FROM cdsco_nsq_alerts) as total_cdsco_alerts,
          (SELECT COUNT(*) FROM cdsco_nsq_alerts WHERE alert_status = 'active') as active_cdsco_alerts;
      `;

      const result = await query(statsQuery);
      const row = result.rows[0];

      // Recent 7 days scan trend
      const trendQuery = `
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM-DD') as date,
          COUNT(*) as total_scans,
          COUNT(CASE WHEN scan_status = 'VERIFIED' THEN 1 END) as verified_count
        FROM scan_history
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
        ORDER BY date ASC;
      `;
      const trendRes = await query(trendQuery);

      res.status(200).json({
        success: true,
        data: {
          metrics: {
            total_users: parseInt(row.total_users, 10),
            citizen_users: parseInt(row.citizen_users, 10),
            total_manufacturers: parseInt(row.total_manufacturers, 10),
            approved_manufacturers: parseInt(row.approved_manufacturers, 10),
            pending_manufacturers: parseInt(row.pending_manufacturers, 10),
            rejected_manufacturers: parseInt(row.rejected_manufacturers, 10),
            suspended_manufacturers: parseInt(row.suspended_manufacturers, 10),
            total_medicines: parseInt(row.total_medicines, 10),
            active_medicines: parseInt(row.active_medicines, 10),
            total_batches: parseInt(row.total_batches, 10),
            active_batches: parseInt(row.active_batches, 10),
            total_scans: parseInt(row.total_scans, 10),
            verified_scans: parseInt(row.verified_scans, 10),
            alert_scans: parseInt(row.alert_scans, 10),
            total_reports: parseInt(row.total_reports, 10),
            pending_reports: parseInt(row.pending_reports, 10),
            total_cdsco_alerts: parseInt(row.total_cdsco_alerts, 10),
            active_cdsco_alerts: parseInt(row.active_cdsco_alerts, 10),
          },
          scan_trends: trendRes.rows,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch dashboard statistics.' });
    }
  }

  /**
   * List all manufacturers with optional status filter
   */
  public static async listManufacturers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status } = req.query;
      let queryText = `
        SELECT m.id, m.user_id, m.company_name, m.license_number, m.contact_email,
               m.contact_phone, m.address, m.approval_status, m.approved_at,
               m.rejection_reason, m.created_at, u.full_name as representative_name,
               u.email as account_email,
               (SELECT COUNT(*) FROM medicine_batches b WHERE b.manufacturer_id = m.id) as batch_count,
               (SELECT key_id FROM manufacturer_keys k WHERE k.manufacturer_id = m.id AND k.status = 'active' LIMIT 1) as active_key_id
        FROM manufacturers m
        JOIN users u ON m.user_id = u.id
      `;
      const params: any[] = [];

      if (status && typeof status === 'string') {
        queryText += ' WHERE m.approval_status = $1';
        params.push(status);
      }

      queryText += ' ORDER BY m.created_at DESC';

      const result = await query(queryText, params);
      res.status(200).json({ success: true, data: result.rows });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list manufacturers.' });
    }
  }

  /**
   * Approve a Manufacturer & Initialize Ed25519 Cryptographic Keys
   */
  public static async approveManufacturer(req: AuthenticatedRequest, res: Response): Promise<void> {
    const client = await getClient();
    try {
      const { id } = req.params;
      const adminId = req.user?.userId;

      await client.query('BEGIN');

      const mfgCheck = await client.query(
        'SELECT id, company_name, approval_status FROM manufacturers WHERE id = $1',
        [id]
      );

      if (mfgCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ success: false, error: 'Manufacturer not found.' });
        return;
      }

      // Generate or retrieve Ed25519 key pair for this manufacturer
      const keyCheck = await client.query(
        'SELECT id, key_id FROM manufacturer_keys WHERE manufacturer_id = $1 AND status = \'active\'',
        [id]
      );

      let keyId = '';
      if (keyCheck.rows.length === 0) {
        // Generate new Ed25519 cryptographic key pair
        const generated = CryptoService.generateManufacturerKeyPair(id);
        keyId = generated.keyId;

        await client.query(
          `INSERT INTO manufacturer_keys (manufacturer_id, key_id, public_key_pem, algorithm, status)
           VALUES ($1, $2, $3, 'ed25519', 'active')`,
          [id, keyId, generated.publicKeyPem]
        );
      } else {
        keyId = keyCheck.rows[0].key_id;
      }

      // Update manufacturer status to approved
      await client.query(
        `UPDATE manufacturers 
         SET approval_status = 'approved', approved_at = NOW(), approved_by = $1, rejection_reason = NULL, updated_at = NOW()
         WHERE id = $2`,
        [adminId, id]
      );

      await client.query('COMMIT');

      res.status(200).json({
        success: true,
        message: `Manufacturer "${mfgCheck.rows[0].company_name}" has been approved. Ed25519 key pair registered (${keyId}).`,
        data: {
          manufacturer_id: id,
          approval_status: 'approved',
          active_key_id: keyId,
        },
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ success: false, error: err.message || 'Failed to approve manufacturer.' });
    } finally {
      client.release();
    }
  }

  /**
   * Reject a Manufacturer with mandatory reason
   */
  public static async rejectManufacturer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        res.status(400).json({ success: false, error: 'Rejection reason is required.' });
        return;
      }

      const result = await query(
        `UPDATE manufacturers 
         SET approval_status = 'rejected', rejection_reason = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, company_name, approval_status, rejection_reason`,
        [reason.trim(), id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Manufacturer not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Manufacturer "${result.rows[0].company_name}" has been rejected.`,
        data: result.rows[0],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to reject manufacturer.' });
    }
  }

  /**
   * Suspend a Manufacturer (suspends active batch verification)
   */
  public static async suspendManufacturer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await query(
        `UPDATE manufacturers 
         SET approval_status = 'suspended', rejection_reason = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, company_name, approval_status, rejection_reason`,
        [reason || 'Regulatory suspension', id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Manufacturer not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Manufacturer "${result.rows[0].company_name}" has been suspended.`,
        data: result.rows[0],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to suspend manufacturer.' });
    }
  }

  /**
   * List all registered users (citizen, manufacturer, admin)
   */
  public static async listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { role, search } = req.query;
      let queryText = 'SELECT id, email, role, full_name, is_active, created_at, updated_at FROM users WHERE 1=1';
      const params: any[] = [];

      if (role && typeof role === 'string') {
        params.push(role);
        queryText += ` AND role = $${params.length}`;
      }

      if (search && typeof search === 'string') {
        params.push(`%${search}%`);
        queryText += ` AND (full_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
      }

      queryText += ' ORDER BY created_at DESC';

      const result = await query(queryText, params);
      res.status(200).json({ success: true, data: result.rows });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list users.' });
    }
  }

  /**
   * Toggle user active status
   */
  public static async toggleUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      const result = await query(
        'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, full_name, is_active',
        [Boolean(is_active), id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'User not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: `User status updated to ${is_active ? 'active' : 'inactive'}.`,
        data: result.rows[0],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to update user status.' });
    }
  }

  /**
   * View all batches across all manufacturers
   */
  public static async listAllBatches(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status, search } = req.query;
      let queryText = `
        SELECT b.id, b.serial_id, b.batch_number, b.manufacturing_date, b.expiry_date,
               b.revision_number, b.status, b.created_at,
               m.medicine_name, m.brand_name, m.composition, m.dosage_form,
               mfg.company_name, mfg.license_number,
               ds.key_id, ds.signature_base64
        FROM medicine_batches b
        JOIN medicines m ON b.medicine_id = m.id
        JOIN manufacturers mfg ON b.manufacturer_id = mfg.id
        LEFT JOIN digital_signatures ds ON b.id = ds.batch_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status && typeof status === 'string') {
        params.push(status);
        queryText += ` AND b.status = $${params.length}`;
      }

      if (search && typeof search === 'string') {
        params.push(`%${search}%`);
        queryText += ` AND (b.batch_number ILIKE $${params.length} OR m.medicine_name ILIKE $${params.length} OR mfg.company_name ILIKE $${params.length})`;
      }

      queryText += ' ORDER BY b.created_at DESC';

      const result = await query(queryText, params);
      res.status(200).json({ success: true, data: result.rows });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list batches.' });
    }
  }

  /**
   * View system-wide verification scan history
   */
  public static async listScanHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status, limit = 100 } = req.query;
      let queryText = `
        SELECT s.id, s.serial_id, s.batch_id, s.user_id, s.ip_address, s.user_agent,
               s.scan_status, s.verification_message, s.created_at,
               u.email as user_email, u.full_name as user_name,
               b.batch_number, m.medicine_name, m.brand_name, mfg.company_name
        FROM scan_history s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN medicine_batches b ON s.batch_id = b.id
        LEFT JOIN medicines m ON b.medicine_id = m.id
        LEFT JOIN manufacturers mfg ON b.manufacturer_id = mfg.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status && typeof status === 'string') {
        params.push(status);
        queryText += ` AND s.scan_status = $${params.length}`;
      }

      queryText += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1}`;
      params.push(parseInt(String(limit), 10) || 100);

      const result = await query(queryText, params);
      res.status(200).json({ success: true, data: result.rows });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list scan history.' });
    }
  }
}
