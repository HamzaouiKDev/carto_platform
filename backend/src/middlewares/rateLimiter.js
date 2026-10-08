import { redisClient } from '../config/redis.js';
import { config } from '../config/index.js';

export async function dynamicRateLimiter(req, res, next) {
  // Determine identifier: Token ID if authenticated via API key, otherwise client IP
  const identifier = req.apiToken ? `token:${req.apiToken.id}` : `ip:${req.ip || '127.0.0.1'}`;
  // Map tiles require very high throughput (hundreds of tiles per minute during zoom/pan)
  const isTile = req.path.includes('/tiles/');
  const defaultLimit = isTile ? 15000 : (config.rateLimit?.maxDefault || 600);
  const maxLimit = isTile
    ? Math.max(req.apiToken?.rate_limit_per_min || 0, 15000)
    : (req.apiToken?.rate_limit_per_min || defaultLimit);
  const windowSec = 60;
  const key = `ratelimit:${isTile ? 'tiles:' : 'api:'}${identifier}`;

  try {
    if (redisClient && redisClient.status === 'ready') {
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.expire(key, windowSec);
      }
      const ttl = await redisClient.ttl(key);

      res.setHeader('X-RateLimit-Limit', maxLimit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxLimit - current));
      res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSec));

      if (current > maxLimit) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit of ${maxLimit} requests per minute exceeded. Retry in ${ttl}s.`,
          retryAfter: ttl,
        });
      }
    }
  } catch (err) {
    // If Redis rate limiting fails, do not block users (graceful fail-open)
  }

  next();
}
