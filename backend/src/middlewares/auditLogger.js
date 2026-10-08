import { dbPool } from '../config/database.js';
import { httpRequestDurationMicroseconds, httpRequestsTotal } from '../config/metrics.js';
import { logger } from '../config/logger.js';

export function auditAndMetricsMiddleware(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;
    const route = req.baseUrl + (req.route?.path || req.path || '');
    const statusCode = res.statusCode;

    // Record Prometheus metrics
    try {
      httpRequestDurationMicroseconds
        .labels(req.method, route, statusCode.toString())
        .observe(durationSec);

      httpRequestsTotal
        .labels(req.method, route, statusCode.toString())
        .inc();
    } catch (e) {
      // Ignore metric collection failure
    }

    // Skip recording raw tile logs if not desired to prevent DB bloat (or sample 1/10)
    const isTileRoute = req.path.includes('/tiles/');
    if (isTileRoute && Math.random() > 0.05) {
      return; // Sample 5% of tile calls to maintain high database throughput
    }

    // Insert to api_usage_logs asynchronously
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const tokenId = req.apiToken?.id || null;
    const userId = req.user?.id || null;
    const providerUsed = req.cartoProviderUsed || null;
    const isCacheHit = !!req.isCacheHit;

    dbPool.query(
      `INSERT INTO api_usage_logs 
       (token_id, user_id, ip_address, endpoint, http_method, http_status, response_time_ms, provider_used, is_cache_hit, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [tokenId, userId, ip, req.originalUrl.substring(0, 255), req.method, statusCode, durationMs, providerUsed, isCacheHit, req.headers['user-agent']?.substring(0, 500)]
    ).catch(err => {
      logger.debug('Failed to write audit log to database', { error: err.message });
    });
  });

  next();
}
