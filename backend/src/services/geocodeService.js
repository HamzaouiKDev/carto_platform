import { cacheService } from '../config/redis.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

export const geocodeService = {
  /**
   * Forward geocoding: Query text -> list of geo coordinates
   */
  async geocode(query, limit = 5, countryCodes = 'tn') {
    if (!query || query.trim().length < 2) {
      throw new Error('Query parameter must have at least 2 characters');
    }

    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `geocode:q:${encodeURIComponent(normalizedQuery)}:${countryCodes}:${limit}`;

    // 1. Check Redis Cache
    const cached = await cacheService.getJSON(cacheKey);
    if (cached) {
      return { results: cached, isCacheHit: true };
    }

    // 2. Fetch from Geocoder (Nominatim compliant)
    const url = new URL(`${config.nominatimUrl}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', limit.toString());
    if (countryCodes) {
      url.searchParams.set('countrycodes', countryCodes);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': config.providers.osm.userAgent },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Geocoding provider returned HTTP ${response.status}`);
      }

      const raw = await response.json();
      const results = raw.map(item => ({
        placeId: item.place_id,
        osmId: item.osm_id,
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type,
        category: item.category,
        importance: item.importance,
        address: item.address,
        bbox: item.boundingbox ? item.boundingbox.map(Number) : null,
      }));

      // Cache for 7 days
      await cacheService.setJSON(cacheKey, results, config.redis.geocodeTtlSeconds);

      return { results, isCacheHit: false };
    } catch (err) {
      clearTimeout(timeout);
      logger.error('Geocoding service error', { query, error: err.message });
      throw err;
    }
  },

  /**
   * Reverse geocoding: lat, lon -> Address
   */
  async reverseGeocode(lat, lon) {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || isNaN(lonNum)) {
      throw new Error('Valid lat and lon numeric parameters required');
    }

    // Round to 5 decimal places for caching (~1.1 meter resolution)
    const roundedLat = latNum.toFixed(5);
    const roundedLon = lonNum.toFixed(5);
    const cacheKey = `geocode:rev:${roundedLat}:${roundedLon}`;

    const cached = await cacheService.getJSON(cacheKey);
    if (cached) {
      return { result: cached, isCacheHit: true };
    }

    const url = new URL(`${config.nominatimUrl}/reverse`);
    url.searchParams.set('lat', roundedLat);
    url.searchParams.set('lon', roundedLon);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': config.providers.osm.userAgent },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Reverse geocoding provider returned HTTP ${response.status}`);
      }

      const item = await response.json();
      const result = {
        placeId: item.place_id,
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        address: item.address,
      };

      await cacheService.setJSON(cacheKey, result, config.redis.geocodeTtlSeconds);
      return { result, isCacheHit: false };
    } catch (err) {
      clearTimeout(timeout);
      logger.error('Reverse geocoding service error', { lat, lon, error: err.message });
      throw err;
    }
  }
};
