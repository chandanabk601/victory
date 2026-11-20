import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { pool } from '../database/db';

export const importMedicinesFromCsv = async (filePath?: string) => {
  const targetPath = filePath || path.resolve(__dirname, '../../../sample-data/sample_medicines.csv');

  console.log(`[Import Medicines] Reading dataset from: ${targetPath}`);

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Medicines CSV file not found at: ${targetPath}`);
  }

  const fileContent = fs.readFileSync(targetPath, 'utf-8');
  const records: any[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`[Import Medicines] Parsed ${records.length} records. Beginning database insertion...`);

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;

  try {
    for (const row of records) {
      const medicineName = row.medicine_name || row.name || row.drug_name;
      if (!medicineName) {
        skipped++;
        continue;
      }

      const brandName = row.brand_name || row.brand || null;
      const manufacturer = row.manufacturer_name || row.manufacturer || null;
      const composition = row.composition || row.salt_composition || null;
      const strength = row.strength || null;
      const dosageForm = row.dosage_form || row.type || null;
      const therapeuticClass = row.therapeutic_class || row.category || null;

      // Duplicate check based on name + strength + dosageForm
      const dup = await client.query(
        `SELECT id FROM medicines 
         WHERE LOWER(medicine_name) = LOWER($1) 
           AND COALESCE(LOWER(strength), '') = COALESCE(LOWER($2), '') 
           AND COALESCE(LOWER(dosage_form), '') = COALESCE(LOWER($3), '')`,
        [medicineName, strength || '', dosageForm || '']
      );

      if (dup.rows.length > 0) {
        skipped++;
        continue;
      }

      await client.query(
        `INSERT INTO medicines (
          medicine_name, brand_name, manufacturer_name, composition, strength, dosage_form, therapeutic_class, source, external_source_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'indian_pharma_dataset', $8)`,
        [
          medicineName,
          brandName,
          manufacturer,
          composition,
          strength,
          dosageForm,
          therapeuticClass,
          row.id || row.external_id || null,
        ]
      );
      inserted++;
    }

    console.log(`[Import Medicines] Finished: Inserted ${inserted} new catalogue entries, skipped ${skipped} duplicate/invalid entries.`);
  } finally {
    client.release();
  }
};

if (require.main === module) {
  const customPath = process.argv[2];
  importMedicinesFromCsv(customPath)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Import Medicines Error]', err);
      process.exit(1);
    });
}
