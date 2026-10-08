import { redisClient } from '../config/redis.js';
import { dbPool } from '../config/database.js';
import { logger } from '../config/logger.js';
import { providerService } from '../services/providerService.js';

logger.info('[Worker] CartoPlatform Background Worker starting...');

let isWorkerRunning = true;

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`[Worker] Received ${signal}. Stopping worker gracefully...`);
  isWorkerRunning = false;
  try {
    await dbPool.end();
  } catch (e) {}
  try {
    if (redisClient) await redisClient.quit();
  } catch (e) {}
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * Worker Main Loop: Consumes background job queues from Redis
 */
async function startWorkerLoop() {
  logger.info('[Worker] CartoPlatform Asynchronous Worker initialized and waiting for tasks.');

  while (isWorkerRunning) {
    try {
      if (!redisClient || redisClient.status !== 'ready') {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      // Check for seed job tasks in Redis list queue
      const jobData = await redisClient.brpop('queue:carto_tasks', 5);
      if (jobData && jobData.length === 2) {
        const payload = JSON.parse(jobData[1]);
        logger.info(`[Worker] Processing job type: ${payload.type}`, { jobId: payload.id });

        if (payload.type === 'SEED_TILE') {
          const { provider, z, x, y } = payload.data;
          try {
            await providerService.getTile(provider, z, x, y);
          } catch (tileErr) {
            logger.debug(`[Worker] Failed seeding tile ${provider}/${z}/${x}/${y}`, { error: tileErr.message });
          }
        } else if (payload.type === 'CLEANUP_EXPIRED_TOKENS') {
          try {
            const res = await dbPool.query("DELETE FROM api_tokens WHERE expires_at < NOW() AND is_revoked = true");
            logger.info(`[Worker] Cleaned up ${res.rowCount} expired revoked tokens.`);
          } catch (dbErr) {
            logger.warn('[Worker] Token cleanup error', { error: dbErr.message });
          }
        }
      }
    } catch (err) {
      if (isWorkerRunning) {
        logger.error('[Worker] Unexpected error in worker loop', { error: err.message });
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
}

// Start worker
startWorkerLoop().catch(err => {
  logger.error('[Worker Fatal]', { error: err.message });
  process.exit(1);
});
