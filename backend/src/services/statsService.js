import { dbPool } from '../config/database.js';
import { cacheService } from '../config/redis.js';

export const statsService = {
  /**
   * Get high-level system usage and latency metrics for the Admin Dashboard
   */
  /**
   * Get high-level system usage and latency metrics for the Admin Dashboard
   * Supports global or per-token metrics and various time periods
   */
  async getDashboardStatistics(period = '24h', tokenId = null) {
    let intervalClause = "l.created_at >= NOW() - INTERVAL '24 hours'";
    let timeTrunc = 'hour';
    if (period === '1h') {
      intervalClause = "l.created_at >= NOW() - INTERVAL '1 hour'";
      timeTrunc = 'minute';
    } else if (period === '7d') {
      intervalClause = "l.created_at >= NOW() - INTERVAL '7 days'";
      timeTrunc = 'day';
    } else if (period === '30d') {
      intervalClause = "l.created_at >= NOW() - INTERVAL '30 days'";
      timeTrunc = 'day';
    } else if (period === 'all') {
      intervalClause = "1=1";
      timeTrunc = 'day';
    }

    // Build WHERE clause for api_usage_logs (aliased as l)
    const conditions = [intervalClause];
    const params = [];
    if (tokenId) {
      params.push(tokenId);
      conditions.push(`l.token_id = $${params.length}`);
    }
    const whereClause = conditions.join(' AND ');

    // 1. Overall volume, status & latency percentiles
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN l.http_status >= 200 AND l.http_status < 400 THEN 1 END) as success_calls,
        COUNT(CASE WHEN l.http_status >= 400 THEN 1 END) as error_calls,
        COUNT(CASE WHEN l.is_cache_hit = TRUE THEN 1 END) as cache_hits,
        ROUND(AVG(l.response_time_ms)::numeric, 1) as avg_latency_ms,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY l.response_time_ms) as p50_latency_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY l.response_time_ms) as p95_latency_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY l.response_time_ms) as p99_latency_ms
      FROM api_usage_logs l
      WHERE ${whereClause}
    `;

    // 2. HTTP status code breakdown
    const statusQuery = `
      SELECT l.http_status, COUNT(*) as count
      FROM api_usage_logs l
      WHERE ${whereClause}
      GROUP BY l.http_status
      ORDER BY count DESC
    `;

    // 3. Provider breakdown & estimated cost
    const providerQuery = `
      SELECT 
        COALESCE(l.provider_used, 'internal') as provider,
        COUNT(*) as calls,
        p.cost_per_1000_tiles,
        ROUND((COUNT(*) * COALESCE(p.cost_per_1000_tiles, 0) / 1000.0)::numeric, 4) as estimated_cost_usd
      FROM api_usage_logs l
      LEFT JOIN providers p ON l.provider_used = p.id
      WHERE ${whereClause}
      GROUP BY l.provider_used, p.cost_per_1000_tiles
      ORDER BY calls DESC
    `;

    // 4. Calls by endpoint
    const endpointQuery = `
      SELECT 
        SPLIT_PART(l.endpoint, '?', 1) as endpoint_path,
        COUNT(*) as calls,
        ROUND(AVG(l.response_time_ms)::numeric, 1) as avg_latency
      FROM api_usage_logs l
      WHERE ${whereClause}
      GROUP BY endpoint_path
      ORDER BY calls DESC
      LIMIT 10
    `;

    // 5. Calls by IP
    const ipQuery = `
      SELECT l.ip_address, COUNT(*) as calls
      FROM api_usage_logs l
      WHERE ${whereClause}
      GROUP BY l.ip_address
      ORDER BY calls DESC
      LIMIT 10
    `;

    // 6. Time series calls
    const timelineQuery = `
      SELECT 
        DATE_TRUNC('${timeTrunc}', l.created_at) as timestamp,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN l.is_cache_hit = TRUE THEN 1 END) as cache_hits,
        COUNT(CASE WHEN l.http_status >= 400 THEN 1 END) as errors
      FROM api_usage_logs l
      WHERE ${whereClause}
      GROUP BY DATE_TRUNC('${timeTrunc}', l.created_at)
      ORDER BY timestamp ASC
    `;

    // 7. Stats per API Token (Usage breakdown per API client)
    const tokensUsageQuery = `
      SELECT 
        t.id, t.name, t.token_prefix, t.is_revoked, t.rate_limit_per_min, t.daily_quota, t.current_day_usage,
        COUNT(l.id) as total_calls,
        COUNT(CASE WHEN l.http_status >= 200 AND l.http_status < 400 THEN 1 END) as success_calls,
        COUNT(CASE WHEN l.http_status >= 400 THEN 1 END) as error_calls,
        COUNT(CASE WHEN l.is_cache_hit = TRUE THEN 1 END) as cache_hits,
        ROUND(COALESCE(AVG(l.response_time_ms), 0)::numeric, 1) as avg_latency_ms,
        MAX(l.created_at) as last_call_at
      FROM api_tokens t
      LEFT JOIN api_usage_logs l ON t.id = l.token_id AND ${intervalClause}
      ${tokenId ? 'WHERE t.id = $1' : ''}
      GROUP BY t.id, t.name, t.token_prefix, t.is_revoked, t.rate_limit_per_min, t.daily_quota, t.current_day_usage
      ORDER BY total_calls DESC, t.created_at DESC
    `;

    const [summaryRes, statusRes, providerRes, endpointRes, ipRes, timelineRes, tokensUsageRes] = await Promise.all([
      dbPool.query(summaryQuery, params),
      dbPool.query(statusQuery, params),
      dbPool.query(providerQuery, params),
      dbPool.query(endpointQuery, params),
      dbPool.query(ipQuery, params),
      dbPool.query(timelineQuery, params),
      dbPool.query(tokensUsageQuery, tokenId ? [tokenId] : []),
    ]);

    const summary = summaryRes.rows[0] || {};
    const totalCalls = parseInt(summary.total_calls, 10) || 0;
    const cacheHits = parseInt(summary.cache_hits, 10) || 0;
    const errorCalls = parseInt(summary.error_calls, 10) || 0;

    const cacheHitRate = totalCalls > 0 ? ((cacheHits / totalCalls) * 100).toFixed(1) : 0;
    const errorRate = totalCalls > 0 ? ((errorCalls / totalCalls) * 100).toFixed(2) : 0;

    const cacheStats = await cacheService.getCacheStats();

    return {
      period,
      tokenId: tokenId || null,
      summary: {
        totalCalls,
        successCalls: parseInt(summary.success_calls, 10) || 0,
        errorCalls,
        errorRatePercent: parseFloat(errorRate),
        cacheHits,
        cacheHitRatePercent: parseFloat(cacheHitRate),
        avgLatencyMs: parseFloat(summary.avg_latency_ms || 0),
        p50LatencyMs: parseFloat(summary.p50_latency_ms || 0),
        p95LatencyMs: parseFloat(summary.p95_latency_ms || 0),
        p99LatencyMs: parseFloat(summary.p99_latency_ms || 0),
      },
      cache: cacheStats,
      statusCodes: statusRes.rows,
      providers: providerRes.rows,
      tokensUsage: tokensUsageRes.rows.map(t => ({
        id: t.id,
        name: t.name,
        prefix: t.token_prefix,
        isRevoked: t.is_revoked,
        rateLimitPerMin: t.rate_limit_per_min,
        dailyQuota: t.daily_quota,
        currentDayUsage: parseInt(t.current_day_usage, 10) || 0,
        totalCalls: parseInt(t.total_calls, 10) || 0,
        successCalls: parseInt(t.success_calls, 10) || 0,
        errorCalls: parseInt(t.error_calls, 10) || 0,
        cacheHits: parseInt(t.cache_hits, 10) || 0,
        avgLatencyMs: parseFloat(t.avg_latency_ms || 0),
        lastCallAt: t.last_call_at,
      })),
      topEndpoints: endpointRes.rows,
      topIps: ipRes.rows,
      timeline: timelineRes.rows,
    };
  },

  /**
   * Reset / Initialize Statistics (Global or per API token)
   */
  async resetStatistics({ tokenId = null, resetQuota = true, userId = null, ip = '127.0.0.1' } = {}) {
    let deletedCount = 0;

    if (tokenId) {
      const res = await dbPool.query('DELETE FROM api_usage_logs WHERE token_id = $1', [tokenId]);
      deletedCount = res.rowCount;
      if (resetQuota) {
        await dbPool.query('UPDATE api_tokens SET current_day_usage = 0 WHERE id = $1', [tokenId]);
      }
    } else {
      const res = await dbPool.query('TRUNCATE TABLE api_usage_logs RESTART IDENTITY');
      if (resetQuota) {
        await dbPool.query('UPDATE api_tokens SET current_day_usage = 0');
      }
    }

    // Invalidate cached stats
    await cacheService.del('stats:dashboard');

    // Audit the reset action
    await dbPool.query(
      `INSERT INTO security_audit_logs (user_id, action, resource_type, resource_id, details, ip_address, severity)
       VALUES ($1, 'STATS_RESET', 'statistics', $2, $3, $4, 'WARNING')`,
      [userId, tokenId || 'GLOBAL', JSON.stringify({ tokenId, deletedCount, resetQuota }), ip]
    );

    return {
      success: true,
      tokenId: tokenId || 'GLOBAL',
      message: tokenId ? 'Statistiques de l’API réinitialisées avec succès' : 'Statistiques globales réinitialisées avec succès'
    };
  },

  /**
   * Get audit logs with pagination and filters
   */
  async getAuditLogs({ limit = 50, offset = 0, severity, action, search }) {
    let whereClauses = [];
    let params = [];
    let pIdx = 1;

    if (severity) {
      whereClauses.push(`severity = $${pIdx++}`);
      params.push(severity);
    }
    if (action) {
      whereClauses.push(`action = $${pIdx++}`);
      params.push(action);
    }
    if (search) {
      whereClauses.push(`(ip_address LIKE $${pIdx} OR action LIKE $${pIdx} OR resource_id LIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM security_audit_logs ${whereSql}`;
    const dataQuery = `
      SELECT l.*, u.email as user_email
      FROM security_audit_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ${whereSql}
      ORDER BY l.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    params.push(limit, offset);

    const [countRes, dataRes] = await Promise.all([
      dbPool.query(countQuery, params.slice(0, pIdx - 3)),
      dbPool.query(dataQuery, params),
    ]);

    return {
      total: parseInt(countRes.rows[0].count, 10),
      limit,
      offset,
      logs: dataRes.rows,
    };
  }
};
