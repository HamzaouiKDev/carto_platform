import os from 'os';
import { statsService } from '../services/statsService.js';
import { checkDatabaseHealth } from '../config/database.js';
import { checkRedisHealth } from '../config/redis.js';

export const statsController = {
  /**
   * GET /api/health
   */
  async getHealth(req, res) {
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const isSystemHealthy = dbHealth.status === 'UP' && (redisHealth.status === 'UP' || redisHealth.status === 'DEGRADED');

    const health = {
      status: isSystemHealthy ? 'HEALTHY' : 'UNHEALTHY',
      service: 'Carto Platform API Gateway',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      system: {
        memoryUsedMb: (process.memoryUsage().rss / 1024 / 1024).toFixed(1),
        systemFreeMemoryMb: (os.freemem() / 1024 / 1024).toFixed(1),
        loadAverage: os.loadavg(),
      },
      dependencies: {
        postgresql: dbHealth,
        redis: redisHealth,
      }
    };

    return res.status(isSystemHealthy ? 200 : 503).json(health);
  },

  /**
   * GET /api/usage
   */
  async getUsage(req, res) {
    try {
      const period = req.query.period || '24h';
      const tokenId = req.query.tokenId || null;
      const stats = await statsService.getDashboardStatistics(period, tokenId);
      return res.json({
        period,
        tokenId,
        summary: stats.summary,
        cache: stats.cache,
      });
    } catch (err) {
      return res.status(500).json({ error: 'StatsError', message: err.message });
    }
  },

  /**
   * GET /api/statistics
   */
  async getStatistics(req, res) {
    try {
      const period = req.query.period || '24h';
      const tokenId = req.query.tokenId || null;
      const format = req.query.format || 'json';
      const stats = await statsService.getDashboardStatistics(period, tokenId);

      if (format === 'csv') {
        let csv = 'Timestamp,TotalCalls,CacheHits,Errors\n';
        for (const row of stats.timeline) {
          csv += `${new Date(row.timestamp).toISOString()},${row.total_calls},${row.cache_hits},${row.errors}\n`;
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="carto-stats-${period}${tokenId ? '-' + tokenId : ''}.csv"`);
        return res.send(csv);
      }

      return res.json(stats);
    } catch (err) {
      return res.status(500).json({ error: 'StatsError', message: err.message });
    }
  },

  /**
   * POST /api/statistics/reset
   */
  async resetStatistics(req, res) {
    const { tokenId, resetQuota } = req.body || {};
    const userId = req.user?.id || null;
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';

    try {
      const result = await statsService.resetStatistics({
        tokenId: tokenId || null,
        resetQuota: resetQuota !== false,
        userId,
        ip
      });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: 'ResetError', message: err.message });
    }
  },

  /**
   * GET /api/admin/audit-logs
   */
  async getAuditLogs(req, res) {
    const { limit = 50, offset = 0, severity, action, search } = req.query;
    const logs = await statsService.getAuditLogs({
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      severity,
      action,
      search,
    });
    return res.json(logs);
  }
};
