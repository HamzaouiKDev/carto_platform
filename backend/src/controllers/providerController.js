import { providerService } from '../services/providerService.js';
import { dbPool } from '../config/database.js';
import { cacheService } from '../config/redis.js';

export const providerController = {
  /**
   * GET /api/providers
   */
  async getProviders(req, res) {
    const providers = await providerService.getAllProviders();
    return res.json({
      count: providers.length,
      providers: providers.map(p => ({
        id: p.id,
        name: p.display_name,
        type: p.provider_type,
        attribution: p.attribution,
        isActive: p.is_active,
        priority: p.priority,
        minZoom: p.min_zoom,
        maxZoom: p.max_zoom,
        costPer1000Tiles: parseFloat(p.cost_per_1000_tiles),
        healthStatus: p.health_status,
        lastHealthCheck: p.last_health_check_at,
        circuitBreaker: p.circuitBreakerState,
      })),
    });
  },

  /**
   * POST /api/providers/test
   */
  async testProvider(req, res) {
    const { providerId } = req.body;
    if (!providerId) {
      return res.status(400).json({ error: 'BadRequest', message: 'providerId is required' });
    }

    try {
      const result = await providerService.testProvider(providerId);
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: 'ProviderTestError', message: err.message });
    }
  },

  /**
   * PUT /api/providers/:id/toggle (Admin only)
   */
  async toggleProvider(req, res) {
    const { id } = req.params;
    const { isActive, priority } = req.body;

    const updates = [];
    const params = [];
    let pIdx = 1;

    if (typeof isActive === 'boolean') {
      updates.push(`is_active = $${pIdx++}`);
      params.push(isActive);
    }
    if (typeof priority === 'number') {
      updates.push(`priority = $${pIdx++}`);
      params.push(priority);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'BadRequest', message: 'Nothing to update' });
    }

    params.push(id);
    const query = `UPDATE providers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${pIdx} RETURNING *`;
    const result = await dbPool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Provider not found' });
    }

    // Invalidate provider meta cache
    await cacheService.del(`provider:meta:${id}`);

    return res.json({
      message: 'Provider status updated',
      provider: result.rows[0],
    });
  }
};
