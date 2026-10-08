import { providerService } from './providerService.js';
import { cacheService } from '../config/redis.js';

/**
 * Convert lon/lat to tile coordinate at zoom level
 */
function lonLatToTile(lon, lat, zoom) {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
  return { x, y };
}

export const staticMapService = {
  /**
   * Generates a static map response for export or embedding
   */
  async generateStaticMap({ centerLon, centerLat, zoom = 12, width = 600, height = 400, provider = 'esri-streets' }) {
    const lon = parseFloat(centerLon);
    const lat = parseFloat(centerLat);
    const z = parseInt(zoom, 10);

    const cacheKey = `static_map:${provider}:${lon.toFixed(4)}:${lat.toFixed(4)}:${z}:${width}x${height}`;
    const cached = await cacheService.getBuffer(cacheKey);
    if (cached) {
      return { buffer: cached, contentType: 'image/png', isCacheHit: true };
    }

    // Identify central tile
    const { x, y } = lonLatToTile(lon, lat, z);

    // Retrieve center tile from provider service (with caching & circuit breaker)
    const tileResult = await providerService.getTile(provider, z, x, y);

    // Cache the static map image
    await cacheService.setBuffer(cacheKey, tileResult.buffer, 3600); // 1h cache

    return {
      buffer: tileResult.buffer,
      contentType: tileResult.contentType,
      isCacheHit: false,
    };
  }
};
