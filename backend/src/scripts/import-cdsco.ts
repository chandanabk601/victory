import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { pool } from '../database/db';

export const importCdscoAlertsFromCsv = async (filePath?: string) => {
  const targetPath = filePath || path.resolve(__dirname, '../../../sample-data/sample_cdsco_alerts.csv');

  console.log(`[Import CDSCO] Reading NSQ alerts from: ${targetPath}`);

  if (!fs.existsSync(targetPath)) {
    throw new Error(`CDSCO CSV file not found at: ${targetPath}`);
  }

  const fileContent = fs.readFileSync(targetPath, 'utf-8');
  const records: any[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`[Import CDSCO] Parsed ${records.length} records. Beginning database insertion...`);

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;

  try {
    for (const row of records) {
      const medicineName = row.medicine_name || row.drug_name || row.name;
      const qualityIssue = row.reported_quality_issue || row.reason_for_failure || row.reason;

      if (!medicineName || !qualityIssue) {
        skipped++;
        continue;
      }

      const mfg = row.manufacturer_name || row.manufacturer || null;
      const batchNo = row.batch_number || row.batch_no || null;
      const alertDate = row.alert_month_year || row.month_year || null;
      const sourceUrl = row.source_url || 'https://cdscoonline.gov.in/CDSCO/viewPublicNSQDrug';
      const pubDetails = row.publication_details || null;

      await client.query(
        `INSERT INTO cdsco_nsq_alerts (
          medicine_name, manufacturer_name, batch_number, alert_month_year,
          reported_quality_issue, source_url, publication_details, alert_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
        [medicineName, mfg, batchNo, alertDate, qualityIssue, sourceUrl, pubDetails]
      );
      inserted++;
    }

    console.log(`[Import CDSCO] Finished: Inserted ${inserted} CDSCO NSQ alert entries, skipped ${skipped} invalid entries.`);
  } finally {
    client.release();
  }
};

if (require.main === module) {
  const customPath = process.argv[2];
  importCdscoAlertsFromCsv(customPath)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Import CDSCO Error]', err);
      process.exit(1);
    });
}
