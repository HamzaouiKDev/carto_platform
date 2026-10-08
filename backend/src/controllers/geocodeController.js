import { geocodeService } from '../services/geocodeService.js';

export const geocodeController = {
  /**
   * GET /api/geocode?q=Tunis&limit=5
   */
  async geocode(req, res) {
    const { q, limit = 5, country = 'tn' } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'BadRequest', message: 'Query parameter q must be at least 2 characters' });
    }

    try {
      const { results, isCacheHit } = await geocodeService.geocode(q, parseInt(limit, 10), country);
      res.setHeader('X-Cache', isCacheHit ? 'HIT' : 'MISS');
      return res.json({ count: results.length, query: q, results });
    } catch (err) {
      return res.status(502).json({ error: 'GeocodingError', message: err.message });
    }
  },

  /**
   * GET /api/reverse-geocode?lat=36.8&lon=10.18
   */
  async reverseGeocode(req, res) {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'BadRequest', message: 'Both lat and lon query parameters are required' });
    }

    try {
      const { result, isCacheHit } = await geocodeService.reverseGeocode(lat, lon);
      res.setHeader('X-Cache', isCacheHit ? 'HIT' : 'MISS');
      return res.json({ query: { lat, lon }, result });
    } catch (err) {
      return res.status(502).json({ error: 'ReverseGeocodingError', message: err.message });
    }
  }
};
