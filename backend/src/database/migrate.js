import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import argon2 from 'argon2';
import { dbPool } from '../config/database.js';
import { logger } from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_LOCK_ID = 991823;

export async function runMigrations() {
  logger.info('[Migration] Acquiring PostgreSQL advisory lock...');
  const client = await dbPool.connect();

  try {
    // Acquire exclusive advisory lock so concurrent containers wait cleanly
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    logger.info('[Migration] Lock acquired. Verifying schema_migrations tracking table...');

    // Migration metadata tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.resolve(__dirname, '../../migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at ${migrationsDir}`);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const checkRes = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [file]
      );

      if (checkRes.rows.length === 0) {
        logger.info(`[Migration] Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        logger.info(`[Migration] Successfully applied: ${file}`);
      } else {
        logger.debug(`[Migration] Skipping already applied migration: ${file}`);
      }
    }

    // Default Admin Seed check (Idempotent: single adminCarto account)
    const userCheck = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count, 10) === 0) {
      const defaultAdminPass = process.env.ADMIN_INITIAL_PASSWORD || 'ins@carto2026';
      const hash = await argon2.hash(defaultAdminPass, { type: argon2.argon2id });
      await client.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        ['adminCarto', hash, 'Administrateur', 'admin']
      );
      logger.info('[Migration] Default admin account ensured: adminCarto');
    }

    logger.info('[Migration] All database migrations are up to date.');
  } catch (err) {
    logger.error('[Migration] Migration execution error', { error: err.message, stack: err.stack });
    throw err;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
      logger.info('[Migration] Advisory lock released.');
    } catch (unlockErr) {
      logger.warn('[Migration] Error releasing advisory lock', { error: unlockErr.message });
    }
    client.release();
  }
}

// Auto-run if executed directly via node CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      logger.info('[Migration CLI] Completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('[Migration CLI] Fatal error:', { error: err.message });
      process.exit(1);
    });
}
