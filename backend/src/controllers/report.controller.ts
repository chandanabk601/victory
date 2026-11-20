import { Response } from 'express';
import { query } from '../database/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { submitReportSchema } from '../validators';

export class ReportController {
  /**
   * Submit a Suspicious Medicine Incident Report
   */
  public static async submitReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validated = submitReportSchema.parse(req.body);
      const userId = req.user?.userId || null;
      const email = req.user?.email || validated.reporter_email || null;

      // Optional: if serial_id is provided, resolve batch_id
      let batchId = validated.batch_id || null;
      if (validated.serial_id && !batchId) {
        const batchRes = await query('SELECT id FROM medicine_batches WHERE serial_id = $1', [validated.serial_id]);
        if (batchRes.rows.length > 0) {
          batchId = batchRes.rows[0].id;
        }
      }

      const result = await query(
        `INSERT INTO suspicious_reports (
          batch_id, serial_id, reporter_user_id, reporter_email, reason, description, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING *`,
        [
          batchId,
          validated.serial_id || null,
          userId,
          email,
          validated.reason,
          validated.description,
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Suspicious medicine report registered successfully. Our regulatory verification team will investigate.',
        data: result.rows[0],
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      res.status(500).json({ success: false, error: err.message || 'Failed to submit report.' });
    }
  }

  /**
   * List all reports for Admin review
   */
  public static async listReports(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status, reason } = req.query;
      let queryText = `
        SELECT r.id, r.batch_id, r.serial_id, r.reporter_user_id, r.reporter_email,
               r.reason, r.description, r.status, r.admin_notes, r.created_at, r.updated_at,
               u.full_name as reporter_name,
               b.batch_number, m.medicine_name, m.brand_name, mfg.company_name
        FROM suspicious_reports r
        LEFT JOIN users u ON r.reporter_user_id = u.id
        LEFT JOIN medicine_batches b ON r.batch_id = b.id
        LEFT JOIN medicines m ON b.medicine_id = m.id
        LEFT JOIN manufacturers mfg ON b.manufacturer_id = mfg.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status && typeof status === 'string') {
        params.push(status);
        queryText += ` AND r.status = $${params.length}`;
      }

      if (reason && typeof reason === 'string') {
        params.push(reason);
        queryText += ` AND r.reason = $${params.length}`;
      }

      queryText += ' ORDER BY r.created_at DESC';

      const result = await query(queryText, params);
      res.status(200).json({ success: true, data: result.rows });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list reports.' });
    }
  }

  /**
   * Update report status and add administrative review notes (Admin only)
   */
  public static async updateReportStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;

      if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
        res.status(400).json({ success: false, error: 'Invalid report status.' });
        return;
      }

      const result = await query(
        `UPDATE suspicious_reports 
         SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [status, admin_notes || null, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Report not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Report status updated.',
        data: result.rows[0],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to update report status.' });
    }
  }

  /**
   * Get user's own submitted reports
   */
  public static async getMyReports(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized.' });
        return;
      }

      const result = await query(
        `SELECT r.id, r.serial_id, r.reason, r.description, r.status, r.admin_notes, r.created_at,
                b.batch_number, m.medicine_name, m.brand_name
         FROM suspicious_reports r
         LEFT JOIN medicine_batches b ON r.batch_id = b.id
         LEFT JOIN medicines m ON b.medicine_id = m.id
         WHERE r.reporter_user_id = $1
         ORDER BY r.created_at DESC`,
        [userId]
      );

      res.status(200).json({ success: true, data: result.rows });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch personal reports.' });
    }
  }
}
