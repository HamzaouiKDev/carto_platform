import pg from 'pg';
import { config } from './index.js';
import { logger } from './logger.js';

const { Pool } = pg;

export const dbPool = new Pool({
  connectionString: config.db.connectionString,
  min: config.db.poolMin,
  max: config.db.poolMax,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis,
});

dbPool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message, stack: err.stack });
});

export async function checkDatabaseHealth() {
  const start = Date.now();
  try {
    const res = await dbPool.query('SELECT 1 as healthy, PostGIS_Version() as postgis_version');
    return {
      status: 'UP',
      latencyMs: Date.now() - start,
      postgis: res.rows[0]?.postgis_version || 'Not installed',
    };
  } catch (err) {
    logger.warn('Database health check failed', { error: err.message });
    return {
      status: 'DOWN',
      latencyMs: Date.now() - start,
      error: err.message,
    };
  }
}
