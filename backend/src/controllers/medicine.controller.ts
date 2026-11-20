import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import { query } from '../database/db';
import { createMedicineSchema } from '../validators';

export class MedicineController {
  /**
   * Search / List Medicines (Accessible to Admin, Manufacturer, and Public)
   */
  public static async listMedicines(req: Request, res: Response): Promise<void> {
    try {
      const { search, dosage_form, source, active_only, page = 1, limit = 50 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let queryText = 'SELECT * FROM medicines WHERE 1=1';
      const params: any[] = [];

      if (active_only !== 'false') {
        queryText += ' AND is_active = true';
      }

      if (dosage_form && typeof dosage_form === 'string') {
        params.push(dosage_form);
        queryText += ` AND dosage_form ILIKE $${params.length}`;
      }

      if (source && typeof source === 'string') {
        params.push(source);
        queryText += ` AND source = $${params.length}`;
      }

      if (search && typeof search === 'string') {
        params.push(`%${search}%`);
        queryText += ` AND (
          medicine_name ILIKE $${params.length} 
          OR brand_name ILIKE $${params.length} 
          OR composition ILIKE $${params.length}
          OR manufacturer_name ILIKE $${params.length}
        )`;
      }

      // Count query
      const countRes = await query(`SELECT COUNT(*) as total FROM (${queryText}) as filtered`, params);
      const total = parseInt(countRes.rows[0].total, 10);

      queryText += ` ORDER BY medicine_name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list medicines.' });
    }
  }

  /**
   * Get single medicine by ID
   */
  public static async getMedicineById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await query('SELECT * FROM medicines WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Medicine not found.' });
        return;
      }

      res.status(200).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch medicine.' });
    }
  }

  /**
   * Create a medicine (Admin only)
   */
  public static async createMedicine(req: Request, res: Response): Promise<void> {
    try {
      const validated = createMedicineSchema.parse(req.body);

      // Check duplicate
      const dupCheck = await query(
        `SELECT id FROM medicines 
         WHERE LOWER(medicine_name) = LOWER($1) 
           AND COALESCE(LOWER(strength), '') = COALESCE(LOWER($2), '') 
           AND COALESCE(LOWER(dosage_form), '') = COALESCE(LOWER($3), '')`,
        [validated.medicine_name, validated.strength || '', validated.dosage_form || '']
      );

      if (dupCheck.rows.length > 0) {
        res.status(409).json({
          success: false,
          error: `A medicine with name "${validated.medicine_name}", strength "${validated.strength || 'N/A'}", and dosage form "${validated.dosage_form || 'N/A'}" already exists.`,
        });
        return;
      }

      const result = await query(
        `INSERT INTO medicines (
          medicine_name, brand_name, manufacturer_name, composition, strength, dosage_form, therapeutic_class, source, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual', $8)
        RETURNING *`,
        [
          validated.medicine_name,
          validated.brand_name || null,
          validated.manufacturer_name || null,
          validated.composition || null,
          validated.strength || null,
          validated.dosage_form || null,
          validated.therapeutic_class || null,
          validated.is_active ?? true,
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Medicine created in master catalogue.',
        data: result.rows[0],
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      res.status(500).json({ success: false, error: err.message || 'Failed to create medicine.' });
    }
  }

  /**
   * Update medicine (Admin only)
   */
  public static async updateMedicine(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validated = createMedicineSchema.parse(req.body);

      const result = await query(
        `UPDATE medicines SET
          medicine_name = $1,
          brand_name = $2,
          manufacturer_name = $3,
          composition = $4,
          strength = $5,
          dosage_form = $6,
          therapeutic_class = $7,
          is_active = $8,
          updated_at = NOW()
        WHERE id = $9
        RETURNING *`,
        [
          validated.medicine_name,
          validated.brand_name || null,
          validated.manufacturer_name || null,
          validated.composition || null,
          validated.strength || null,
          validated.dosage_form || null,
          validated.therapeutic_class || null,
          validated.is_active ?? true,
          id,
        ]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Medicine not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Medicine updated successfully.',
        data: result.rows[0],
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      res.status(500).json({ success: false, error: err.message || 'Failed to update medicine.' });
    }
  }

  /**
   * Toggle medicine active status (Admin only)
   */
  public static async toggleMedicineStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      const result = await query(
        'UPDATE medicines SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, medicine_name, is_active',
        [Boolean(is_active), id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Medicine not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: `Medicine marked as ${is_active ? 'active' : 'inactive'}.`,
        data: result.rows[0],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to update medicine status.' });
    }
  }

  /**
   * Import medicines via CSV file or raw CSV text (Admin only)
   */
  public static async importMedicinesCsv(req: Request, res: Response): Promise<void> {
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
      const errors: string[] = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const medicineName = row.medicine_name || row.name || row.drug_name;
        if (!medicineName) {
          skippedCount++;
          errors.push(`Row ${i + 1}: Missing required medicine_name.`);
          continue;
        }

        const brandName = row.brand_name || row.brand || null;
        const manufacturer = row.manufacturer_name || row.manufacturer || null;
        const composition = row.composition || row.salt_composition || null;
        const strength = row.strength || null;
        const dosageForm = row.dosage_form || row.type || null;
        const therapeuticClass = row.therapeutic_class || row.category || null;

        try {
          const insertRes = await query(
            `INSERT INTO medicines (
              medicine_name, brand_name, manufacturer_name, composition, strength, dosage_form, therapeutic_class, source
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'csv_import')
            ON CONFLICT DO NOTHING
            RETURNING id`,
            [medicineName, brandName, manufacturer, composition, strength, dosageForm, therapeuticClass]
          );

          if (insertRes.rows.length > 0) {
            insertedCount++;
          } else {
            skippedCount++;
          }
        } catch (e: any) {
          skippedCount++;
          errors.push(`Row ${i + 1} (${medicineName}): ${e.message}`);
        }
      }

      res.status(200).json({
        success: true,
        message: `CSV import completed. Successfully inserted ${insertedCount} medicines. Skipped ${skippedCount} duplicate or invalid rows.`,
        data: {
          total_rows: records.length,
          inserted: insertedCount,
          skipped: skippedCount,
          errors: errors.slice(0, 10),
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'CSV import failed.' });
    }
  }
}
