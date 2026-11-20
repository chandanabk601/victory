import { initAdmin } from '../backend/src/scripts/init-admin';
import { pool } from '../backend/src/database/db';

console.log('[Script] Initializing VICTORY System Administrator...');
initAdmin()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[Script Error]', err);
    process.exit(1);
  });
