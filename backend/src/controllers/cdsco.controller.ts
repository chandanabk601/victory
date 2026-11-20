import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import { query } from '../database/db';

export class CdscoController {
  /**
   * Search / List CDSCO NSQ Alerts (Public & Admin reference query)
   */
  public static async listAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { search, batch_number, status = 'active', page = 1, limit = 50 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let queryText = 'SELECT * FROM cdsco_nsq_alerts WHERE 1=1';
      const params: any[] = [];

      if (status && status !== 'all') {
        params.push(status);
        queryText += ` AND alert_status = $${params.length}`;
      }

      if (batch_number && typeof batch_number === 'string') {
        params.push(batch_number.trim());
        queryText += ` AND batch_number = $${params.length}`;
      }

      if (search && typeof search === 'string') {
        params.push(`%${search}%`);
        queryText += ` AND (
          medicine_name ILIKE $${params.length} 
          OR manufacturer_name ILIKE $${params.length} 
          OR reported_quality_issue ILIKE $${params.length}
        )`;
      }

      const countRes = await query(`SELECT COUNT(*) as total FROM (${queryText}) as filtered`, params);
      const total = parseInt(countRes.rows[0].total, 10);

      queryText += ` ORDER BY import_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(Number(limit), offset);

      const result = await query(queryText, params);

      res.status(200).json({
        success: true,
        data: {
          items: result.rows,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit)),
          },
          disclaimer: 'CDSCO Not of Standard Quality (NSQ) records represent official regulatory sample failures. Absence from this list does not guarantee authenticity.',
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list CDSCO alerts.' });
    }
  }

  /**
   * Create a single CDSCO NSQ alert (Admin only)
   */
  public static async createAlert(req: Request, res: Response): Promise<void> {
    try {
      const {
        medicine_name,
        manufacturer_name,
        batch_number,
        alert_month_year,
        reported_quality_issue,
        source_url,
        publication_details,
      } = req.body;

      if (!medicine_name || !reported_quality_issue) {
        res.status(400).json({ success: false, error: 'medicine_name and reported_quality_issue are required.' });
        return;
      }

      const result = await query(
        `INSERT INTO cdsco_nsq_alerts (
          medicine_name, manufacturer_name, batch_number, alert_month_year,
          reported_quality_issue, source_url, publication_details, alert_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
        RETURNING *`,
        [
          medicine_name.trim(),
          manufacturer_name ? manufacturer_name.trim() : null,
          batch_number ? batch_number.trim() : null,
          alert_month_year || null,
          reported_quality_issue.trim(),
          source_url || 'https://cdscoonline.gov.in/CDSCO/viewPublicNSQDrug',
          publication_details || null,
        ]
      );

      res.status(201).json({
        success: true,
        message: 'CDSCO NSQ alert created.',
        data: result.rows[0],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to create CDSCO alert.' });
    }
  }

  /**
   * Update CDSCO NSQ alert status (Admin only)
   */
  public static async updateAlertStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { alert_status } = req.body;

      if (!['active', 'archived', 'resolved'].includes(alert_status)) {
        res.status(400).json({ success: false, error: 'Invalid alert status.' });
        return;
      }

      const result = await query(
        'UPDATE cdsco_nsq_alerts SET alert_status = $1 WHERE id = $2 RETURNING *',
        [alert_status, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Alert not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'CDSCO alert status updated.',
        data: result.rows[0],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to update alert.' });
    }
  }

  /**
   * Import CDSCO NSQ alerts via CSV (Admin only)
   */
  public static async importCdscoCsv(req: Request, res: Response): Promise<void> {
    try {
      let csvContent = '';

      if (req.file) {
        csvContent = req.file.buffer.toString('utf-8');
      } else if (req.body.csv_text) {
        csvContent = req.body.csv_text;
      } else {
        res.status(400).json({ success: false, error: 'No CSV file or csv_text payload provided.' });
        return;
      }

      const records: any[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      let insertedCount = 0;
      let skippedCount = 0;

      for (const row of records) {
        const medicineName = row.medicine_name || row.drug_name || row.name;
        const qualityIssue = row.reported_quality_issue || row.reason_for_failure || row.reason || row.issue;

        if (!medicineName || !qualityIssue) {
          skippedCount++;
          continue;
        }

        const mfg = row.manufacturer_name || row.manufacturer || null;
        const batchNo = row.batch_number || row.batch_no || null;
        const alertDate = row.alert_month_year || row.month_year || row.date || null;
        const sourceUrl = row.source_url || 'https://cdscoonline.gov.in/CDSCO/viewPublicNSQDrug';
        const pubDetails = row.publication_details || row.circular_no || null;

        await query(
          `INSERT INTO cdsco_nsq_alerts (
            medicine_name, manufacturer_name, batch_number, alert_month_year,
            reported_quality_issue, source_url, publication_details, alert_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
          [medicineName, mfg, batchNo, alertDate, qualityIssue, sourceUrl, pubDetails]
        );

        insertedCount++;
      }

      res.status(200).json({
        success: true,
        message: `Imported ${insertedCount} CDSCO NSQ regulatory alerts. Skipped ${skippedCount} invalid rows.`,
        data: {
          inserted: insertedCount,
          skipped: skippedCount,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'CDSCO CSV import failed.' });
    }
  }
}
