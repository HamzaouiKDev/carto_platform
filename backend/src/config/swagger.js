export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'CartoPlatform Enterprise API',
    description: 'High-Performance Multi-Provider Cartographic Gateway, Vector/Raster Tile Server, and GIS Platform',
    version: '1.0.0',
    contact: {
      name: 'CartoPlatform Engineering Team',
      email: 'gis-platform@carto-platform.local'
    }
  },
  servers: [
    { url: '/api', description: 'Current Carto API Gateway' }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT token obtained via /api/auth/login'
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Provide personal or machine API token (e.g. cpt_live_...)'
      },
      ApiKeyQuery: {
        type: 'apiKey',
        in: 'query',
        name: 'key',
        description: 'Provide API token in URL query parameter'
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'System health check and dependency statuses',
        responses: { 200: { description: 'System healthy' }, 503: { description: 'System degraded or down' } }
      }
    },
    '/providers': {
      get: {
        summary: 'List all cartographic providers (Google, Esri, OSM, MapTiler, COG)',
        responses: { 200: { description: 'List of providers' } }
      }
    },
    '/providers/test': {
      post: {
        summary: 'Test availability and measure latency for a provider',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { providerId: { type: 'string' } } } } }
        },
        responses: { 200: { description: 'Latency test result' } }
      }
    },
    '/tiles/{provider}/{z}/{x}/{y}': {
      get: {
        summary: 'Fetch cartographic map tile with ETag conditional caching and circuit breaker',
        parameters: [
          { name: 'provider', in: 'path', required: true, schema: { type: 'string' }, example: 'esri-imagery' },
          { name: 'z', in: 'path', required: true, schema: { type: 'integer' }, example: 6 },
          { name: 'x', in: 'path', required: true, schema: { type: 'integer' }, example: 33 },
          { name: 'y', in: 'path', required: true, schema: { type: 'string' }, example: '25.png' }
        ],
        security: [{ ApiKeyAuth: [] }, { ApiKeyQuery: [] }, { BearerAuth: [] }],
        responses: {
          200: { description: 'Raw tile image binary (PNG, JPEG, WebP)' },
          304: { description: 'Tile not modified (ETag match, 0 bytes transmitted)' },
          502: { description: 'Provider upstream unavailable' }
        }
      }
    },
    '/static-map': {
      get: {
        summary: 'Generate static map image preview or export',
        parameters: [
          { name: 'center', in: 'query', schema: { type: 'string' }, example: '10.1815,36.8065' },
          { name: 'zoom', in: 'query', schema: { type: 'integer' }, example: 12 },
          { name: 'provider', in: 'query', schema: { type: 'string' }, example: 'esri-streets' }
        ],
        responses: { 200: { description: 'Static preview image' } }
      }
    },
    '/geocode': {
      get: {
        summary: 'Forward address geocoding with Redis cache',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' }, example: 'Tunis' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 5 } }
        ],
        responses: { 200: { description: 'Geocoding matches' } }
      }
    },
    '/reverse-geocode': {
      get: {
        summary: 'Reverse coordinate geocoding with Redis cache',
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number' }, example: 36.8065 },
          { name: 'lon', in: 'query', required: true, schema: { type: 'number' }, example: 10.1815 }
        ],
        responses: { 200: { description: 'Reverse geocoded address' } }
      }
    },
    '/routing/route': {
      get: {
        summary: 'Calculate multi-modal route (Car, Pedestrian, Bicycle) with turn-by-turn steps & Redis caching',
        parameters: [
          { name: 'start', in: 'query', required: true, schema: { type: 'string' }, example: '10.1815,36.8065', description: 'Start lon,lat or place name' },
          { name: 'end', in: 'query', required: true, schema: { type: 'string' }, example: '10.3217,36.8529', description: 'End lon,lat or place name' },
          { name: 'mode', in: 'query', schema: { type: 'string', enum: ['car', 'foot', 'bike'], default: 'car' }, description: 'Transport mode: car (driving), foot (pedestrian/walking), bike (cycling)' },
          { name: 'steps', in: 'query', schema: { type: 'boolean', default: true }, description: 'Include turn-by-turn guidance in French' },
          { name: 'alternatives', in: 'query', schema: { type: 'boolean', default: false }, description: 'Return alternative routes' }
        ],
        security: [{ ApiKeyAuth: [] }, { ApiKeyQuery: [] }, { BearerAuth: [] }],
        responses: {
          200: { description: 'Calculated route with GeoJSON geometry, distance, duration, and step-by-step instructions' },
          400: { description: 'Missing or invalid start/end coordinates' },
          502: { description: 'Routing engine failure or unreachable' }
        }
      },
      post: {
        summary: 'Calculate multi-modal route via JSON payload',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['start', 'end'],
                properties: {
                  start: { type: 'string', example: '10.1815,36.8065' },
                  end: { type: 'string', example: '10.3217,36.8529' },
                  mode: { type: 'string', enum: ['car', 'foot', 'bike'], default: 'car' },
                  steps: { type: 'boolean', default: true }
                }
              }
            }
          }
        },
        security: [{ ApiKeyAuth: [] }, { ApiKeyQuery: [] }, { BearerAuth: [] }],
        responses: {
          200: { description: 'Calculated route object' },
          400: { description: 'Missing coordinates' }
        }
      }
    },
    '/layers': {
      get: {
        summary: 'List custom PostGIS geographic layers',
        responses: { 200: { description: 'List of spatial layers' } }
      },
      post: {
        summary: 'Create or upload new spatial layer (GeoJSON)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } }
        },
        responses: { 201: { description: 'Layer created' } }
      }
    },
    '/styles': {
      get: {
        summary: 'List available map styles (streets, satellite, hybrid, terrain, dark)',
        responses: { 200: { description: 'Available styles' } }
      }
    },
    '/maps': {
      get: {
        summary: 'List saved custom maps',
        responses: { 200: { description: 'Saved maps' } }
      },
      post: {
        summary: 'Save a custom map view with layers and pitch for sharing',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Saved map with share token' } }
      }
    },
    '/tokens': {
      get: {
        summary: 'List active API tokens for current user',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'List of tokens' } }
      },
      post: {
        summary: 'Generate a new scoped API key (Revealed once)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  allowedDomains: { type: 'array', items: { type: 'string' } },
                  rateLimitPerMin: { type: 'integer' },
                  dailyQuota: { type: 'integer' }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Token generated with secret key' } }
      }
    },
    '/tokens/{id}': {
      delete: {
        summary: 'Revoke an API token immediately',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Token revoked' } }
      }
    },
    '/usage': {
      get: {
        summary: 'Get usage metrics and quotas',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Usage summary' } }
      }
    },
    '/statistics': {
      get: {
        summary: 'Get full admin analytics, p95/p99 latency, and cost estimates',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['1h', '24h', '7d', '30d'], default: '24h' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv'], default: 'json' } }
        ],
        responses: { 200: { description: 'Aggregated analytics' } }
      }
    },
    '/admin/audit-logs': {
      get: {
        summary: 'Security and administrative audit trail with filters',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Audit trail records' } }
      }
    },
    '/me': {
      get: {
        summary: 'Current authenticated user profile and permissions',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'User profile' } }
      }
    }
  }
};
