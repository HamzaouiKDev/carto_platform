import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { dbPool } from '../config/database.js';
import { cacheService } from '../config/redis.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { tileRequestsTotal, upstreamProviderDurationSeconds, circuitBreakerStateGauge } from '../config/metrics.js';

// Circuit breaker state map: providerId -> { failures: number, lastFailureTime: number, state: 'CLOSED'|'OPEN'|'HALF-OPEN' }
const circuitBreakers = new Map();

function getCircuitBreaker(providerId) {
  if (!circuitBreakers.has(providerId)) {
    circuitBreakers.set(providerId, {
      failures: 0,
      lastFailureTime: 0,
      state: 'CLOSED'
    });
    circuitBreakerStateGauge.labels(providerId).set(0);
  }
  return circuitBreakers.get(providerId);
}

function recordSuccess(providerId) {
  const cb = getCircuitBreaker(providerId);
  cb.failures = 0;
  cb.state = 'CLOSED';
  circuitBreakerStateGauge.labels(providerId).set(0);
}

function recordFailure(providerId) {
  const cb = getCircuitBreaker(providerId);
  cb.failures += 1;
  cb.lastFailureTime = Date.now();
  if (cb.failures >= config.circuitBreaker.failureThreshold) {
    cb.state = 'OPEN';
    circuitBreakerStateGauge.labels(providerId).set(2);
    logger.warn(`Circuit Breaker tripped to OPEN for provider: ${providerId}`);
  }
}

function isProviderAvailable(providerId) {
  const cb = getCircuitBreaker(providerId);
  if (cb.state === 'OPEN') {
    if (Date.now() - cb.lastFailureTime > config.circuitBreaker.resetTimeoutMs) {
      cb.state = 'HALF-OPEN';
      circuitBreakerStateGauge.labels(providerId).set(1);
      return true; // allow trial request
    }
    return false;
  }
  return true;
}

/**
 * Perform native fetch with timeout
 */
async function fetchTileWithTimeout(url, headers = {}, timeoutMs = config.circuitBreaker.requestTimeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': config.providers.osm.userAgent,
        'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*',
        ...headers,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Upstream returned HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export const providerService = {
  /**
   * Fetch active provider configuration from PostgreSQL (or cached memory)
   */
  async getProvider(providerId) {
    const cacheKey = `provider:meta:${providerId}`;
    const cached = await cacheService.getJSON(cacheKey);
    if (cached) return cached;

    const res = await dbPool.query('SELECT * FROM providers WHERE id = $1', [providerId]);
    if (res.rows.length === 0) return null;

    const provider = res.rows[0];
    await cacheService.setJSON(cacheKey, provider, 600); // 10 min cache
    return provider;
  },

  /**
   * List all providers with health and stats
   */
  async getAllProviders() {
    const res = await dbPool.query('SELECT * FROM providers ORDER BY priority ASC, display_name ASC');
    return res.rows.map(p => {
      const cb = getCircuitBreaker(p.id);
      return {
        ...p,
        circuitBreakerState: cb.state,
        failures: cb.failures,
      };
    });
  },

  /**
   * Resolve tile URL with provider API keys and coordinates
   */
  resolveTileUrl(provider, z, x, y) {
    let url = provider.base_url
      .replace('{z}', z)
      .replace('{x}', x)
      .replace('{y}', y);

    // Dynamic API key injection from environment if configured
    if (provider.id.includes('google')) {
      url = url.replace('{key}', config.providers.google.apiKey);
    } else if (provider.id.includes('maptiler')) {
      url = url.replace('{key}', config.providers.maptiler.apiKey);
    } else if (provider.id.includes('esri') && config.providers.esri.apiKey) {
      url += (url.includes('?') ? '&' : '?') + `token=${config.providers.esri.apiKey}`;
    }

    return url;
  },

  /**
   * Fetch tile with Multi-tier Redis Cache, Circuit Breaker, and Fallback Provider
   */
  async getTile(providerId, z, x, y) {
    const tileKey = `tile:${providerId}:${z}:${x}:${y}`;
    const metaKey = `tile:meta:${providerId}:${z}:${x}:${y}`;

    // 1. Check Redis Cache
    const cachedBuffer = await cacheService.getBuffer(tileKey);
    if (cachedBuffer) {
      tileRequestsTotal.labels(providerId, 'HIT').inc();
      const meta = (await cacheService.getJSON(metaKey)) || { contentType: 'image/png' };
      const etag = `W/"${crypto.createHash('md5').update(cachedBuffer).digest('hex')}"`;
      return {
        buffer: cachedBuffer,
        contentType: meta.contentType,
        etag,
        isCacheHit: true,
        providerUsed: providerId,
      };
    }

    // 2. Load provider configuration
    let provider = await this.getProvider(providerId);
    if (!provider || !provider.is_active) {
      throw new Error(`Provider '${providerId}' not found or inactive`);
    }

    // Check zoom levels
    const zNum = parseInt(z, 10);
    if (zNum < provider.min_zoom || zNum > provider.max_zoom) {
      throw new Error(`Zoom level ${z} out of bounds for ${providerId} (${provider.min_zoom}-${provider.max_zoom})`);
    }

    // 3. Check Circuit Breaker
    let currentProviderId = providerId;
    let targetProvider = provider;

    if (!isProviderAvailable(providerId)) {
      logger.warn(`Provider ${providerId} circuit open. Attempting fallback provider...`);
      // Find fallback provider from carto_styles
      const fallbackRes = await dbPool.query(
        `SELECT fallback_provider_id FROM carto_styles WHERE primary_provider_id = $1 LIMIT 1`,
        [providerId]
      );
      const fallbackId = fallbackRes.rows[0]?.fallback_provider_id || 'osm-standard';
      if (fallbackId && fallbackId !== providerId) {
        currentProviderId = fallbackId;
        targetProvider = await this.getProvider(fallbackId);
      }
    }

    // 4. Fetch upstream with timing
    const upstreamUrl = this.resolveTileUrl(targetProvider, z, x, y);
    const startUpstream = Date.now();

    try {
      const { buffer, contentType } = await fetchTileWithTimeout(upstreamUrl);
      const upstreamDuration = (Date.now() - startUpstream) / 1000;

      upstreamProviderDurationSeconds.labels(currentProviderId).observe(upstreamDuration);
      recordSuccess(currentProviderId);
      tileRequestsTotal.labels(currentProviderId, 'MISS').inc();

      // Store in Redis with TTL
      await cacheService.setBuffer(tileKey, buffer, config.redis.tileTtlSeconds);
      await cacheService.setJSON(metaKey, { contentType }, config.redis.tileTtlSeconds);

      const etag = `W/"${crypto.createHash('md5').update(buffer).digest('hex')}"`;
      return {
        buffer,
        contentType,
        etag,
        isCacheHit: false,
        providerUsed: currentProviderId,
        attribution: targetProvider.attribution,
      };
    } catch (err) {
      recordFailure(currentProviderId);
      tileRequestsTotal.labels(currentProviderId, 'ERROR').inc();
      logger.error(`Tile fetch failed from ${currentProviderId}`, { url: upstreamUrl, error: err.message });

      // Secondary emergency fallback to OSM if not already attempted
      if (currentProviderId !== 'osm-standard') {
        logger.info(`Invoking emergency fallback to OSM for tile ${z}/${x}/${y}`);
        const osmProvider = await this.getProvider('osm-standard');
        if (osmProvider) {
          const osmUrl = this.resolveTileUrl(osmProvider, z, x, y);
          const { buffer, contentType } = await fetchTileWithTimeout(osmUrl);
          const etag = `W/"${crypto.createHash('md5').update(buffer).digest('hex')}"`;
          return {
            buffer,
            contentType,
            etag,
            isCacheHit: false,
            providerUsed: 'osm-standard',
            attribution: osmProvider.attribution,
          };
        }
      }

      throw err;
    }
  },

  /**
   * Test availability and measure latency of a provider
   */
  async testProvider(providerId) {
    const provider = await this.getProvider(providerId);
    if (!provider) throw new Error('Provider not found');

    // Test with sample tile (Zoom 6 over Tunisia/Mediterranean: z=6, x=33, y=25)
    const testUrl = this.resolveTileUrl(provider, 6, 33, 25);
    const start = Date.now();

    try {
      const { buffer, contentType } = await fetchTileWithTimeout(testUrl, {}, 5000);
      const latencyMs = Date.now() - start;

      // Update provider health in database
      await dbPool.query(
        `UPDATE providers SET health_status = 'HEALTHY', last_health_check_at = NOW() WHERE id = $1`,
        [providerId]
      );

      return {
        status: 'UP',
        latencyMs,
        tileSizeKb: (buffer.length / 1024).toFixed(2),
        contentType,
        provider: provider.display_name,
      };
    } catch (err) {
      await dbPool.query(
        `UPDATE providers SET health_status = 'DEGRADED', last_health_check_at = NOW() WHERE id = $1`,
        [providerId]
      );
      return {
        status: 'DOWN',
        latencyMs: Date.now() - start,
        error: err.message,
        provider: provider.display_name,
      };
    }
  }
};
