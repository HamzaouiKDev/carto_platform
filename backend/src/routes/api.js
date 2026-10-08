import express from 'express';
import { authController } from '../controllers/authController.js';
import { providerController } from '../controllers/providerController.js';
import { tileController } from '../controllers/tileController.js';
import { geocodeController } from '../controllers/geocodeController.js';
import { layerController } from '../controllers/layerController.js';
import { tokenController } from '../controllers/tokenController.js';
import { statsController } from '../controllers/statsController.js';
import { seedController } from '../controllers/seedController.js';
import { routingController } from '../controllers/routingController.js';
import { userController } from '../controllers/userController.js';
import { authenticate, requireAuth, requireRole } from '../middlewares/auth.js';
import { dynamicRateLimiter } from '../middlewares/rateLimiter.js';
import { metricsRegistry } from '../config/metrics.js';

export const apiRouter = express.Router();

// ── 1. PUBLIC HEALTH & METRICS ──────────────────────────────────────────────
apiRouter.get('/health', statsController.getHealth);
apiRouter.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', metricsRegistry.contentType);
  res.send(await metricsRegistry.metrics());
});

// ── 2. AUTHENTICATION & USERS ───────────────────────────────────────────────
apiRouter.post('/auth/login', authController.login);
apiRouter.post('/auth/refresh', authController.refresh);
apiRouter.get('/me', authenticate, requireAuth, authController.getMe);
apiRouter.put('/auth/change-password', authenticate, requireAuth, userController.changePassword);

apiRouter.get('/users', authenticate, requireAuth, userController.listUsers);
apiRouter.post('/users', authenticate, requireAuth, userController.createUser);
apiRouter.put('/users/:id/reset-password', authenticate, requireAuth, userController.resetPassword);
apiRouter.delete('/users/:id', authenticate, requireAuth, userController.deleteUser);

// ── 3. CARTOGRAPHIC TILES & STATIC MAPS (Fast path with rate limiting) ──────
apiRouter.get('/tiles/:provider/:z/:x/:y', authenticate, dynamicRateLimiter, tileController.getTile);
apiRouter.get('/static-map', authenticate, dynamicRateLimiter, tileController.getStaticMap);

// ── 4. GEOCODING & REVERSE GEOCODING ────────────────────────────────────────
apiRouter.get('/geocode', authenticate, dynamicRateLimiter, geocodeController.geocode);
apiRouter.get('/reverse-geocode', authenticate, dynamicRateLimiter, geocodeController.reverseGeocode);

// ── 4.1 MULTI-MODAL ROUTING (Car, Pedestrian, Bike) ──────────────────────────
apiRouter.get('/routing/route', authenticate, dynamicRateLimiter, routingController.getRoute);
apiRouter.post('/routing/route', authenticate, dynamicRateLimiter, routingController.postRoute);

// ── 5. PROVIDERS, STYLES & LAYERS ───────────────────────────────────────────
apiRouter.get('/providers', providerController.getProviders);
apiRouter.post('/providers/test', authenticate, requireAuth, providerController.testProvider);
apiRouter.put('/providers/:id/toggle', authenticate, requireRole(['admin']), providerController.toggleProvider);

apiRouter.get('/styles', layerController.getStyles);
apiRouter.get('/layers', layerController.getLayers);
apiRouter.post('/layers', authenticate, requireAuth, layerController.createLayer);

apiRouter.get('/maps', layerController.getMaps);
apiRouter.post('/maps', authenticate, requireAuth, layerController.createMap);

// ── 6. API TOKENS & KEYS (One-time reveal, activation, deactivation, deletion) ──
apiRouter.get('/tokens', authenticate, tokenController.listTokens);
apiRouter.post('/tokens', authenticate, tokenController.createToken);
apiRouter.put('/tokens/:id/toggle', authenticate, tokenController.toggleToken);
apiRouter.delete('/tokens/:id', authenticate, tokenController.deleteToken);

// ── 7. STATISTICS, USAGE & AUDIT ────────────────────────────────────────────
apiRouter.get('/usage', authenticate, statsController.getUsage);
apiRouter.get('/statistics', authenticate, statsController.getStatistics);
apiRouter.post('/statistics/reset', authenticate, statsController.resetStatistics);
apiRouter.get('/admin/audit-logs', authenticate, statsController.getAuditLogs);

// ── 8. OFFLINE TILE SEEDING & PRE-CACHING ───────────────────────────────────
apiRouter.get('/seed/status', seedController.getStatus);
apiRouter.post('/seed/start', seedController.startSeed);
apiRouter.post('/seed/pause', seedController.pauseSeed);
apiRouter.post('/seed/stop', seedController.stopSeed);
apiRouter.post('/seed/purge', seedController.purgeCache);
