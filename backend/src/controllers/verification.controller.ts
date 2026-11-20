import { Response } from 'express';
import { VerificationService } from '../services/verification.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { verifySerialSchema } from '../validators';
import { query } from '../database/db';

export class VerificationController {
  /**
   * Public Medicine Verification API (No authentication required; supports optional auth)
   */
  public static async verify(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validated = verifySerialSchema.parse(req.body);
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const userId = req.user?.userId;

      const result = await VerificationService.verifyMedicine({
        serialId: validated.serial_id,
        userId,
        ipAddress,
        userAgent,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      res.status(500).json({ success: false, error: err.message || 'Verification process encountered an internal error.' });
    }
  }

  /**
   * Get Personal Scan History for Logged-In User
   */
  public static async getUserScanHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized.' });
        return;
      }

      const result = await query(
        `SELECT s.id, s.serial_id, s.scan_status, s.verification_message, s.created_at,
                b.batch_number, b.manufacturing_date, b.expiry_date,
                m.medicine_name, m.brand_name, m.dosage_form,
                mfg.company_name
         FROM scan_history s
         LEFT JOIN medicine_batches b ON s.batch_id = b.id
         LEFT JOIN medicines m ON b.medicine_id = m.id
         LEFT JOIN manufacturers mfg ON b.manufacturer_id = mfg.id
         WHERE s.user_id = $1
         ORDER BY s.created_at DESC
         LIMIT 100`,
        [userId]
      );

      res.status(200).json({
        success: true,
        data: result.rows,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch scan history.' });
    }
  }
}
