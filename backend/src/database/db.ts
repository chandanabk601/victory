import { Pool, QueryResult, QueryResultRow, PoolClient } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle PostgreSQL client:', err);
});

export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (config.nodeEnv === 'development' && duration > 500) {
      console.warn(`[DB-SLOW] ${duration}ms query: ${text.slice(0, 100)}...`);
    }
    return res;
  } catch (error) {
    console.error(`[DB-ERROR] Query failed: ${text.slice(0, 150)}`, error);
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => {
  return await pool.connect();
};

export const testDbConnection = async (): Promise<boolean> => {
  try {
    const res = await pool.query('SELECT NOW() as current_time, current_database() as db_name;');
    console.log(`[DB] Successfully connected to PostgreSQL database "${res.rows[0].db_name}" at ${res.rows[0].current_time}`);
    return true;
  } catch (err: any) {
    console.error('[DB] Connection check failed:', err.message);
    return false;
  }
};
