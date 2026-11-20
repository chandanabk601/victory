import path from 'path';
import { importCdscoAlertsFromCsv } from '../backend/src/scripts/import-cdsco';
import { pool } from '../backend/src/database/db';

const filePath = process.argv[2] || path.resolve(__dirname, '../sample-data/sample_cdsco_alerts.csv');

console.log(`[Script] Executing CDSCO NSQ Drug Alerts import from: ${filePath}`);
importCdscoAlertsFromCsv(filePath)
  .then(() => pool.end())
  .catch((err) => {
    console.error('[Script Error]', err);
    process.exit(1);
  });
