import { providerService } from '../services/providerService.js';
import { staticMapService } from '../services/staticMapService.js';
import { logger } from '../config/logger.js';

export const tileController = {
  /**
   * GET /api/tiles/:provider/:z/:x/:y
   */
  async getTile(req, res) {
    const { provider, z, x, y } = req.params;

    // Validate zoom and coordinates format
    if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+(\.[a-z]+)?$/i.test(y)) {
      return res.status(400).json({ error: 'BadRequest', message: 'Tile coordinates (z, x, y) must be valid integers' });
    }

    // Clean any extension on y (e.g. 12.png -> 12)
    const cleanY = y.split('.')[0];

    try {
      const tile = await providerService.getTile(provider, z, x, cleanY);

      // Attach for audit logger middleware
      req.cartoProviderUsed = tile.providerUsed;
      req.isCacheHit = tile.isCacheHit;

      // Check HTTP ETag conditional request
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag && clientEtag === tile.etag) {
        return res.status(304).end();
      }

      // High-performance HTTP caching headers
      res.setHeader('Content-Type', tile.contentType);
      res.setHeader('ETag', tile.etag);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      res.setHeader('X-Cache', tile.isCacheHit ? 'HIT' : 'MISS');
      res.setHeader('X-Carto-Provider', tile.providerUsed);
      if (tile.attribution) {
        res.setHeader('X-Carto-Attribution', encodeURIComponent(tile.attribution));
      }

      return res.status(200).send(tile.buffer);
    } catch (err) {
      logger.warn('Failed to serve tile', { provider, z, x, y, error: err.message });
      return res.status(502).json({
        error: 'BadGateway',
        message: `Cartographic tile unavailable: ${err.message}`,
        provider,
      });
    }
  },

  /**
   * GET /api/static-map
   */
  async getStaticMap(req, res) {
    const { center, lon, lat, zoom = 12, width = 600, height = 400, provider = 'esri-streets' } = req.query;

    let centerLon = lon;
    let centerLat = lat;

    if (center && center.includes(',')) {
      const parts = center.split(',');
      centerLon = parts[0];
      centerLat = parts[1];
    }

    if (!centerLon || !centerLat) {
      // Default to Tunis center if not specified
      centerLon = 10.1815;
      centerLat = 36.8065;
    }

    try {
      const map = await staticMapService.generateStaticMap({
        centerLon,
        centerLat,
        zoom,
        width,
        height,
        provider,
      });

      res.setHeader('Content-Type', map.contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Cache', map.isCacheHit ? 'HIT' : 'MISS');
      return res.send(map.buffer);
    } catch (err) {
      return res.status(500).json({ error: 'StaticMapError', message: err.message });
    }
  }
};
