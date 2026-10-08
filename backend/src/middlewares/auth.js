import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { dbPool } from '../config/database.js';
import { redisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';

// Cache TTL for token metadata in Redis (5 minutes)
const TOKEN_CACHE_TTL_SEC = 300;

export async function authenticate(req, res, next) {
  try {
    // 1. Check for Bearer JWT token (Dashboard UI / Admin API)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, config.jwt.accessSecret);
        req.user = decoded; // { id, email, role }
        return next();
      } catch (jwtErr) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired JWT token',
          code: 'AUTH_INVALID_JWT'
        });
      }
    }

    // 2. Check for API Token (Machine-to-Machine / Web GIS client: Header or Query)
    const apiKey = req.headers['x-api-key'] || req.query.key;
    if (apiKey && typeof apiKey === 'string') {
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
      const cacheKey = `cache:token:${hashedKey}`;

      let tokenData = null;

      // 2.1 Fast-path: Check Redis cache first
      if (redisClient && redisClient.status === 'ready') {
        try {
          const cached = await redisClient.get(cacheKey);
          if (cached) {
            tokenData = JSON.parse(cached);
          }
        } catch (e) {
          // Redis cache miss/error fallback to DB
        }
      }

      // 2.2 Database lookup on cache miss
      if (!tokenData) {
        const tokenQuery = `
          SELECT t.*, u.role as user_role, u.is_active as user_active
          FROM api_tokens t
          JOIN users u ON t.user_id = u.id
          WHERE t.token_hash = $1
        `;
        const result = await dbPool.query(tokenQuery, [hashedKey]);

        if (result.rows.length === 0) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid API Key',
            code: 'AUTH_INVALID_API_KEY'
          });
        }

        tokenData = result.rows[0];

        // Cache in Redis for high throughput
        if (redisClient && redisClient.status === 'ready') {
          redisClient.set(cacheKey, JSON.stringify(tokenData), 'EX', TOKEN_CACHE_TTL_SEC).catch(() => {});
        }
      }

      // Verification checks
      if (tokenData.is_revoked || !tokenData.user_active) {
        return res.status(403).json({ error: 'Forbidden', message: 'API token has been revoked', code: 'AUTH_TOKEN_REVOKED' });
      }

      const now = new Date();
      if (tokenData.expires_at && new Date(tokenData.expires_at) < now) {
        return res.status(403).json({ error: 'Forbidden', message: 'API token has expired', code: 'AUTH_TOKEN_EXPIRED' });
      }

      if (tokenData.starts_at && new Date(tokenData.starts_at) > now) {
        return res.status(403).json({ error: 'Forbidden', message: 'API token not active yet', code: 'AUTH_TOKEN_NOT_STARTED' });
      }

      // Check HTTP method whitelist (GET automatically allows HEAD and OPTIONS)
      const allowedMethods = tokenData.allowed_methods || ['GET'];
      const effectiveAllowed = [...allowedMethods];
      if (effectiveAllowed.includes('GET')) {
        if (!effectiveAllowed.includes('HEAD')) effectiveAllowed.push('HEAD');
        if (!effectiveAllowed.includes('OPTIONS')) effectiveAllowed.push('OPTIONS');
      }
      if (effectiveAllowed.length > 0 && !effectiveAllowed.includes(req.method)) {
        return res.status(403).json({ error: 'Forbidden', message: `Method ${req.method} not allowed for this token`, code: 'AUTH_METHOD_NOT_ALLOWED' });
      }

      // Check domain / Origin whitelist
      const origin = req.headers.origin || req.headers.referer;
      if (tokenData.allowed_domains?.length > 0 && origin) {
        const domainAllowed = tokenData.allowed_domains.some(d => origin.includes(d) || d === '*');
        if (!domainAllowed) {
          return res.status(403).json({ error: 'Forbidden', message: 'Domain not authorized for this API token', code: 'AUTH_DOMAIN_RESTRICTED' });
        }
      }

      // Check IP whitelist
      const clientIp = req.ip || req.connection?.remoteAddress;
      if (tokenData.allowed_ips?.length > 0 && clientIp) {
        const ipAllowed = tokenData.allowed_ips.some(ip => ip === clientIp || ip === '0.0.0.0/0');
        if (!ipAllowed) {
          return res.status(403).json({ error: 'Forbidden', message: 'Client IP address not authorized', code: 'AUTH_IP_RESTRICTED' });
        }
      }

      // Daily quota check
      if (tokenData.daily_quota > 0 && tokenData.current_day_usage >= tokenData.daily_quota) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Daily quota exceeded for this API token',
          code: 'QUOTA_EXCEEDED'
        });
      }

      // Asynchronous usage update (batched / non-blocking)
      const isTileCall = req.path.includes('/tiles/');
      if (!isTileCall || Math.random() < 0.1) {
        dbPool.query(
          `UPDATE api_tokens 
           SET current_day_usage = current_day_usage + 1, last_used_at = NOW() 
           WHERE id = $1`,
          [tokenData.id]
        ).catch(e => logger.debug('Non-blocking token usage update notice', { error: e.message }));
      }

      req.apiToken = tokenData;
      req.user = { id: tokenData.user_id, role: tokenData.user_role };
      return next();
    }

    // 3. Optional unauthenticated endpoints handling: caller can verify req.user
    req.user = null;
    return next();
  } catch (err) {
    logger.error('Authentication middleware error', { error: err.message });
    return res.status(500).json({ error: 'Internal Server Error', message: 'Authentication processing failure' });
  }
}

export function requireAuth(req, res, next) {
  if (!req.user && !req.apiToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication credentials (JWT Bearer or x-api-key) required',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
}

export function requireRole(allowedRoles = ['admin']) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires one of roles: [${allowedRoles.join(', ')}]`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    next();
  };
}
