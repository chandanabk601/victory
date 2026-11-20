import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5433', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'victory_db',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'victory_fallback_secret_key_minimum_32_chars_long_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  },

  keys: {
    storageDir: path.resolve(process.env.KEYS_STORAGE_DIR || path.join(__dirname, '../../../keys')),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  },

  securityPrincipleDisclaimer: 
    'A valid Ed25519 signature proves the integrity and origin of a signed digital record. It does NOT independently prove that the physical medicine is genuine.',
};
