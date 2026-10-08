import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { dbPool } from './config/database.js';
import { redisClient } from './config/redis.js';
import { swaggerDocument } from './config/swagger.js';
import { apiRouter } from './routes/api.js';
import { auditAndMetricsMiddleware } from './middlewares/auditLogger.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// Trust proxy for Docker/Nginx/Traefik reverse proxy headers
app.set('trust proxy', 1);

// 1. Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Allows flexible MapLibre and Swagger assets
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// 2. CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'If-None-Match'],
  exposedHeaders: ['ETag', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Cache', 'X-Carto-Provider', 'X-Carto-Attribution'],
}));

// 3. Compression (Gzip / Deflate)
app.use(compression({
  filter: (req, res) => {
    // Skip compression for image tiles (they are already compressed PNG/JPEG/WebP)
    if (req.path.includes('/tiles/')) return false;
    return compression.filter(req, res);
  }
}));

// 4. Request Body Parsers (with safe limits)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// 5. Telemetry & Audit Middleware
app.use(auditAndMetricsMiddleware);

// 6. Interactive OpenAPI/Swagger Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'CartoPlatform API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
}));

// 7. Mount Core API
app.use('/api', apiRouter);

// 8. Root Welcome & Health Redirect
app.get('/', (req, res) => {
  res.json({
    platform: 'CartoPlatform Enterprise Web GIS',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/api/health',
    status: 'ACTIVE'
  });
});

// 9. Centralized Error Handler
app.use(errorHandler);

// 10. Start Server
const server = app.listen(config.port, config.host, () => {
  logger.info(`CartoPlatform API Gateway active on http://${config.host}:${config.port}`);
  logger.info(`Swagger OpenAPI interactive documentation available at http://${config.host}:${config.port}/api/docs`);
});

// Graceful Shutdown Handler
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await dbPool.end();
      logger.info('PostgreSQL pool closed.');
    } catch (e) {}
    try {
      if (redisClient) {
        await redisClient.quit();
        logger.info('Redis client disconnected.');
      }
    } catch (e) {}
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception in process', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason });
});

export default app;
