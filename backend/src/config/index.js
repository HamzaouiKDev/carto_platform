import dotenv from 'dotenv';
import { validateEnvironment } from './envValidator.js';
dotenv.config();

validateEnvironment();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',

  // Database PostgreSQL + PostGIS
  db: {
    connectionString: process.env.DATABASE_URL || 'postgresql://carto_user:carto_secure_pass@localhost:5432/carto_db',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },

  // Redis Cache
  redis: {
    url: process.env.REDIS_URL || 'redis://:redis_secure_pass@localhost:6379/0',
    tileTtlSeconds: parseInt(process.env.TILE_CACHE_TTL || '86400', 10), // 24h
    geocodeTtlSeconds: parseInt(process.env.GEOCODE_CACHE_TTL || '604800', 10), // 7 jours
    statsTtlSeconds: 300,
  },

  // JWT Security
  jwt: {
    accessSecret: process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production_min_32_characters_key_998',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_in_production_key_887',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  // Provider API Keys (From ENV only, NEVER hardcoded)
  providers: {
    google: {
      apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
      enabled: process.env.GOOGLE_MAPS_ENABLED === 'true',
    },
    esri: {
      apiKey: process.env.ESRI_API_KEY || '',
      enabled: process.env.ESRI_ENABLED !== 'false',
    },
    maptiler: {
      apiKey: process.env.MAPTILER_API_KEY || '',
      enabled: process.env.MAPTILER_ENABLED === 'true',
    },
    osm: {
      userAgent: process.env.OSM_USER_AGENT || 'CartoPlatform/1.0 (contact@carto-platform.local)',
      enabled: process.env.OSM_ENABLED !== 'false',
    },
  },

  // Circuit Breaker & Fallback defaults
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    requestTimeoutMs: 6000,
  },

  // Rate Limiting defaults
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxDefault: 120, // 120 requêtes/minute par IP/Token
  },

  // Geocoding Fallback URL
  nominatimUrl: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',

  // Routing Multi-Mode Engine (Car, Pedestrian/Foot, Bicycle)
  routing: {
    carUrl: process.env.OSRM_CAR_URL || 'https://router.project-osrm.org/route/v1/driving',
    footUrl: process.env.OSRM_FOOT_URL || 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
    bikeUrl: process.env.OSRM_BIKE_URL || 'https://routing.openstreetmap.de/routed-bike/route/v1/bike',
    cacheTtlSeconds: parseInt(process.env.ROUTING_CACHE_TTL || '604800', 10), // 7 jours en cache Redis
    timeoutMs: parseInt(process.env.ROUTING_TIMEOUT_MS || '12000', 10),
  },
};
