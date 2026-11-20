import path from 'path';
import { importMedicinesFromCsv } from '../backend/src/scripts/import-medicines';
import { pool } from '../backend/src/database/db';

const filePath = process.argv[2] || path.resolve(__dirname, '../sample-data/sample_medicines.csv');

console.log(`[Script] Executing Indian Pharma Dataset import from: ${filePath}`);
importMedicinesFromCsv(filePath)
  .then(() => pool.end())
  .catch((err) => {
    console.error('[Script Error]', err);
    process.exit(1);
  });
