import bcrypt from 'bcryptjs';
import { pool } from '../database/db';
import { config } from '../config';

export const initAdmin = async () => {
  const email = process.env.ADMIN_EMAIL || process.argv[2] || 'admin@victory.pharma';
  const password = process.env.ADMIN_PASSWORD || process.argv[3] || 'Admin@12345';
  const fullName = process.env.ADMIN_NAME || process.argv[4] || 'Chief Regulatory Officer';

  console.log(`[Admin Init] Initializing system administrator account: ${email}...`);

  const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);

  const client = await pool.connect();
  try {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE users 
         SET password_hash = $1, full_name = $2, role = 'admin', is_active = true, updated_at = NOW()
         WHERE email = $3`,
        [passwordHash, fullName, email]
      );
      console.log(`[Admin Init] Administrator account "${email}" updated successfully.`);
    } else {
      await client.query(
        `INSERT INTO users (email, password_hash, role, full_name, is_active)
         VALUES ($1, $2, 'admin', $3, true)`,
        [email, passwordHash, fullName]
      );
      console.log(`[Admin Init] Administrator account "${email}" created successfully.`);
    }
    console.log(`[Admin Init] Credentials -> Email: ${email} | Password: ${password}`);
  } catch (err) {
    console.error('[Admin Init Error] Failed to initialize admin account:', err);
    throw err;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  initAdmin()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
