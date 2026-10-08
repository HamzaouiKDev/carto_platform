import { logger } from './logger.js';

/**
 * Validates critical environment variables for production security and stability.
 * Fails fast on invalid configuration during container boot.
 */
export function validateEnvironment() {
  const isProd = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  // 1. Mandatory Core Variables
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is missing. A valid PostgreSQL/PostGIS connection string is required.');
  }

  if (!process.env.REDIS_URL) {
    errors.push('REDIS_URL is missing. A valid Redis connection string is required for caching & rate limiting.');
  }

  // 2. Cryptographic Secrets (Must be at least 32 characters, no default dummy values)
  const jwtSecret = process.env.JWT_SECRET || '';
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || '';

  if (!jwtSecret) {
    errors.push('JWT_SECRET is required.');
  } else if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long for cryptographic security.');
  } else if (isProd && (jwtSecret.includes('dev_') || jwtSecret.includes('change_this') || jwtSecret.includes('test_'))) {
    errors.push('JWT_SECRET uses an insecure default development secret in production.');
  }

  if (!jwtRefreshSecret) {
    errors.push('JWT_REFRESH_SECRET is required.');
  } else if (jwtRefreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters long for cryptographic security.');
  } else if (isProd && (jwtRefreshSecret.includes('dev_') || jwtRefreshSecret.includes('change_this') || jwtRefreshSecret.includes('test_'))) {
    errors.push('JWT_REFRESH_SECRET uses an insecure default development secret in production.');
  }

  // 3. PostgreSQL Database Credentials Check
  if (isProd && process.env.DATABASE_URL && process.env.DATABASE_URL.includes('carto_secure_pass')) {
    warnings.push('DATABASE_URL contains the default password (carto_secure_pass). Please update POSTGRES_PASSWORD in production.');
  }

  if (isProd && process.env.REDIS_URL && process.env.REDIS_URL.includes('redis_secure_pass')) {
    warnings.push('REDIS_URL contains the default password (redis_secure_pass). Please update REDIS_PASSWORD in production.');
  }

  // 4. Rate Limiting and Cache Sanity
  const tileTtl = parseInt(process.env.TILE_CACHE_TTL || '86400', 10);
  if (isNaN(tileTtl) || tileTtl < 60) {
    warnings.push('TILE_CACHE_TTL is invalid or too low (< 60s). Falling back to 86400s.');
  }

  // Log Warnings
  warnings.forEach(w => logger.warn(`[Config Warning] ${w}`));

  // If fatal errors exist, abort process
  if (errors.length > 0) {
    errors.forEach(e => logger.error(`[Config Fatal Error] ${e}`));
    if (isProd) {
      throw new Error(`Fatal configuration error(s) prevented startup in production: \n - ${errors.join('\n - ')}`);
    } else {
      logger.warn('Running in non-production mode with configuration warnings. Review .env.example before deploying to production.');
    }
  }

  logger.info(`Environment configuration validated successfully [Environment: ${process.env.NODE_ENV || 'development'}]`);
}
