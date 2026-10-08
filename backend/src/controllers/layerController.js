import crypto from 'crypto';
import { dbPool } from '../config/database.js';

export const layerController = {
  /**
   * GET /api/layers
   */
  async getLayers(req, res) {
    const query = `
      SELECT id, name, title, layer_type, source_url, properties, opacity, is_visible, min_zoom, max_zoom, created_at,
             CASE WHEN geom IS NOT NULL THEN ST_AsGeoJSON(geom)::json ELSE NULL END as geometry
      FROM custom_layers
      WHERE is_visible = TRUE
      ORDER BY created_at DESC
    `;
    const result = await dbPool.query(query);
    return res.json({ count: result.rows.length, layers: result.rows });
  },

  /**
   * POST /api/layers (Save new layer or uploaded GeoJSON)
   */
  async createLayer(req, res) {
    const { name, title, layerType = 'geojson', sourceUrl, geojson, opacity = 1.0 } = req.body;

    if (!name || !title) {
      return res.status(400).json({ error: 'BadRequest', message: 'Name and title are required' });
    }

    let geomSql = 'NULL';
    const params = [req.user?.id || null, name, title, layerType, sourceUrl || null, opacity];

    if (geojson && typeof geojson === 'object') {
      params.push(JSON.stringify(geojson));
      geomSql = 'ST_SetSRID(ST_GeomFromGeoJSON($7), 4326)';
    }

    const query = `
      INSERT INTO custom_layers (user_id, name, title, layer_type, source_url, opacity, geom)
      VALUES ($1, $2, $3, $4, $5, $6, ${geomSql})
      RETURNING id, name, title, layer_type, opacity, created_at
    `;

    const result = await dbPool.query(query, params);
    return res.status(201).json({ message: 'Layer created', layer: result.rows[0] });
  },

  /**
   * GET /api/styles
   */
  async getStyles(req, res) {
    const query = `
      SELECT s.id, s.display_name, s.description, s.is_default, s.is_public,
             p1.display_name as primary_provider_name, p1.id as primary_provider_id,
             p2.display_name as fallback_provider_name, p2.id as fallback_provider_id
      FROM carto_styles s
      LEFT JOIN providers p1 ON s.primary_provider_id = p1.id
      LEFT JOIN providers p2 ON s.fallback_provider_id = p2.id
      ORDER BY s.is_default DESC, s.display_name ASC
    `;
    const result = await dbPool.query(query);
    return res.json({ count: result.rows.length, styles: result.rows });
  },

  /**
   * GET /api/maps
   */
  async getMaps(req, res) {
    const query = `
      SELECT id, title, description, center_lon, center_lat, zoom, pitch, bearing, active_style_id, share_token, created_at
      FROM custom_maps
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const result = await dbPool.query(query);
    return res.json({ count: result.rows.length, maps: result.rows });
  },

  /**
   * POST /api/maps (Save map state for sharing)
   */
  async createMap(req, res) {
    const { title, description, centerLon = 10.1815, centerLat = 36.8065, zoom = 12, pitch = 0, bearing = 0, styleId = 'satellite', activeLayers = [] } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'BadRequest', message: 'Title is required' });
    }

    const shareToken = crypto.randomBytes(8).toString('hex');
    const query = `
      INSERT INTO custom_maps 
        (user_id, title, description, center_lon, center_lat, zoom, pitch, bearing, active_style_id, active_layers, share_token)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title, share_token, center_lon, center_lat, zoom, pitch, bearing, created_at
    `;

    const result = await dbPool.query(query, [
      req.user?.id || null,
      title,
      description,
      centerLon,
      centerLat,
      zoom,
      pitch,
      bearing,
      styleId,
      JSON.stringify(activeLayers),
      shareToken,
    ]);

    return res.status(201).json({
      message: 'Map saved',
      map: result.rows[0],
      shareUrl: `/view/${shareToken}`
    });
  }
};
