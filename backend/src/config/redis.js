import Redis from 'ioredis';
import { config } from './index.js';
import { logger } from './logger.js';

let redisClient = null;
let isRedisConnected = false;

// Fallback in-memory cache for development/emergency if Redis unreachable
const memoryCache = new Map();

try {
  redisClient = new Redis(config.redis.url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    connectTimeout: 4000,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
  });

  redisClient.on('connect', () => {
    isRedisConnected = true;
    logger.info('Connected to Redis Cache Engine');
  });

  redisClient.on('ready', async () => {
    isRedisConnected = true;
    try {
      await redisClient.config('SET', 'stop-writes-on-bgsave-error', 'no');
    } catch (_) {
      // Ignore if CONFIG command is restricted
    }
  });

  redisClient.on('error', (err) => {
    isRedisConnected = false;
    logger.warn('Redis error, switching to graceful fallback', { error: err.message });
  });

  redisClient.on('close', () => {
    isRedisConnected = false;
  });
} catch (e) {
  logger.error('Failed to initialize Redis client', { error: e.message });
}

export { redisClient };

export async function checkRedisHealth() {
  if (!redisClient || !isRedisConnected) {
    return { status: 'DEGRADED', message: 'In-memory fallback active' };
  }
  const start = Date.now();
  try {
    const ping = await redisClient.ping();
    const info = await redisClient.info('memory');
    const usedMemory = info.match(/used_memory_human:(.*)/)?.[1]?.trim() || 'N/A';
    return {
      status: ping === 'PONG' ? 'UP' : 'DOWN',
      latencyMs: Date.now() - start,
      usedMemory,
    };
  } catch (err) {
    // If Redis suffers from MISCONF RDB snapshot failure, attempt immediate self-healing
    if (err.message && err.message.includes('MISCONF')) {
      try {
        await redisClient.config('SET', 'stop-writes-on-bgsave-error', 'no');
        const retryPing = await redisClient.ping();
        if (retryPing === 'PONG') {
          return {
            status: 'UP',
            latencyMs: Date.now() - start,
            note: 'Auto-recovered from MISCONF snapshot error'
          };
        }
      } catch (_) {}
    }
    return { status: 'DOWN', error: err.message };
  }
}

/**
 * Cache abstraction supporting binary buffers (PNG, JPEG, WebP, PBF) and JSON objects
 */
export const cacheService = {
  async getBuffer(key) {
    try {
      if (isRedisConnected && redisClient) {
        return await redisClient.getBuffer(key);
      }
      return memoryCache.get(key) || null;
    } catch (err) {
      logger.debug('Cache getBuffer error', { key, error: err.message });
      return null;
    }
  },

  async setBuffer(key, buffer, ttlSeconds = config.redis.tileTtlSeconds) {
    try {
      if (isRedisConnected && redisClient) {
        if (ttlSeconds && ttlSeconds > 0) {
          await redisClient.set(key, buffer, 'EX', ttlSeconds);
        } else {
          // Stockage permanent sans expiration pour cartographie 100% locale hors-ligne
          await redisClient.set(key, buffer);
        }
        return true;
      }
      if (memoryCache.size > 2000) {
        const firstKey = memoryCache.keys().next().value;
        memoryCache.delete(firstKey);
      }
      memoryCache.set(key, buffer);
      return true;
    } catch (err) {
      logger.debug('Cache setBuffer error', { key, error: err.message });
      return false;
    }
  },

  async getJSON(key) {
    try {
      if (isRedisConnected && redisClient) {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
      }
      const item = memoryCache.get(key);
      return item ? JSON.parse(item) : null;
    } catch (err) {
      return null;
    }
  },

  async setJSON(key, data, ttlSeconds = 300) {
    try {
      const payload = JSON.stringify(data);
      if (isRedisConnected && redisClient) {
        if (ttlSeconds && ttlSeconds > 0) {
          await redisClient.set(key, payload, 'EX', ttlSeconds);
        } else {
          // Stockage permanent sans expiration
          await redisClient.set(key, payload);
        }
        return true;
      }
      memoryCache.set(key, payload);
      return true;
    } catch (err) {
      return false;
    }
  },

  async del(patternOrKey) {
    try {
      if (isRedisConnected && redisClient) {
        const keys = await redisClient.keys(patternOrKey);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      }
      for (const k of memoryCache.keys()) {
        if (k.includes(patternOrKey.replace('*', ''))) {
          memoryCache.delete(k);
        }
      }
      return true;
    } catch (err) {
      return false;
    }
  },

  async getCacheStats() {
    let totalKeys = memoryCache.size;
    let memoryUsage = 'Memory cache';
    if (isRedisConnected && redisClient) {
      try {
        const dbsize = await redisClient.dbsize();
        totalKeys = dbsize;
        const mem = await redisClient.info('memory');
        memoryUsage = mem.match(/used_memory_human:(.*)/)?.[1]?.trim() || 'N/A';
      } catch (e) {}
    }
    return { totalKeys, memoryUsage, backend: isRedisConnected ? 'Redis 7' : 'InMemory Fallback' };
  }
};
