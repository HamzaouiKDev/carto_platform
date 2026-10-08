import { routingService } from '../services/routingService.js';
import { logger } from '../config/logger.js';

export const routingController = {
  /**
   * GET /api/routing/route
   * Query params: start, end, mode (car|foot|bike), steps (true|false)
   */
  async getRoute(req, res) {
    const { start, end, mode, steps, alternatives } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Les paramètres de départ "start" et d\'arrivée "end" sont obligatoires (ex: start=10.1815,36.8065&end=10.3217,36.8529 ou noms de lieux)',
        code: 'ROUTING_MISSING_COORDINATES'
      });
    }

    try {
      const result = await routingService.calculateRoute({
        start,
        end,
        mode: mode || 'car',
        steps: steps !== 'false',
        alternatives: alternatives === 'true',
      });

      res.setHeader('X-Cache', result.isCacheHit ? 'HIT' : 'MISS');
      res.setHeader('X-Routing-Mode', result.mode);
      return res.json(result);
    } catch (err) {
      logger.warn('Failed to calculate route', { error: err.message, query: req.query });
      return res.status(502).json({
        error: 'RoutingError',
        message: err.message,
        code: 'ROUTING_CALCULATION_FAILED'
      });
    }
  },

  /**
   * POST /api/routing/route
   * JSON Body: { start, end, mode, steps, alternatives }
   */
  async postRoute(req, res) {
    const { start, end, mode, steps, alternatives } = req.body;

    if (!start || !end) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Les champs "start" et "end" sont obligatoires dans le corps JSON',
        code: 'ROUTING_MISSING_COORDINATES'
      });
    }

    try {
      const result = await routingService.calculateRoute({
        start,
        end,
        mode: mode || 'car',
        steps: steps !== false,
        alternatives: alternatives === true,
      });

      res.setHeader('X-Cache', result.isCacheHit ? 'HIT' : 'MISS');
      res.setHeader('X-Routing-Mode', result.mode);
      return res.json(result);
    } catch (err) {
      logger.warn('Failed to calculate route (POST)', { error: err.message });
      return res.status(502).json({
        error: 'RoutingError',
        message: err.message,
        code: 'ROUTING_CALCULATION_FAILED'
      });
    }
  }
};
