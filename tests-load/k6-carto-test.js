import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom Prometheus / k6 Metrics
export const cacheHitRate = new Rate('carto_k6_cache_hit_rate');
export const tileDuration = new Trend('carto_k6_tile_duration_ms');
export const geocodeDuration = new Trend('carto_k6_geocode_duration_ms');
export const errorRate = new Rate('carto_k6_error_rate');

// ── TEST STAGES: 10 -> 100 -> 500 -> 1,000 CONCURRENT USERS ────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10 },    // Baseline: 10 concurrent users
    { duration: '1m', target: 100 },    // Standard load: 100 concurrent users
    { duration: '2m', target: 500 },    // Peak load: 500 concurrent users
    { duration: '2m', target: 1000 },   // Stress / Limit: 1,000 concurrent users
    { duration: '1m', target: 0 },      // Ramp-down
  ],
  thresholds: {
    // SLA 1: 95% of all tile requests must be under 200ms when cached
    'carto_k6_tile_duration_ms': ['p(95)<200', 'p(99)<500'],
    // SLA 2: Cache hit rate must exceed 80% on repeated tiles
    'carto_k6_cache_hit_rate': ['rate>0.80'],
    // SLA 3: Global HTTP error rate must remain under 1%
    'carto_k6_error_rate': ['rate<0.01'],
    // SLA 4: Geocoding latency p90 under 600ms
    'carto_k6_geocode_duration_ms': ['p(90)<600'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000/api';
const VALID_API_KEY = __ENV.API_KEY || 'cpt_live_load_test_key_sample';

export default function () {

  // SCENARIO 1: REPEATED TILE CALLS (HOT CACHE VS COLD CACHE)
  group('1. Cartographic Tile Calls (Cache Hot/Cold)', () => {
    // Sample coordinates over Tunisia / Maghreb
    const tiles = [
      { z: 6, x: 33, y: 25 },
      { z: 7, x: 67, y: 51 },
      { z: 8, x: 135, y: 103 },
      { z: 12, x: 2165, y: 1650 },
    ];
    const tile = tiles[Math.floor(Math.random() * tiles.length)];

    const res = http.get(`${BASE_URL}/tiles/esri-imagery/${tile.z}/${tile.x}/${tile.y}.png`, {
      headers: { 'x-api-key': VALID_API_KEY }
    });

    const isSuccess = check(res, {
      'Tile status is 200 or 304': (r) => r.status === 200 || r.status === 304,
      'Has valid content-type': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('image'),
      'Has ETag header': (r) => !!r.headers['ETag'],
    });

    errorRate.add(!isSuccess);
    tileDuration.add(res.timings.duration);

    // Track Cache Hit header
    const isHit = res.headers['X-Cache'] === 'HIT' || res.status === 304;
    cacheHitRate.add(isHit);
  });

  // SCENARIO 2: FORWARD & REVERSE GEOCODING WITH CACHE
  group('2. Geocoding Queries', () => {
    const queries = ['Tunis', 'Sfax', 'Sousse', 'Bizerte', 'Ariana'];
    const q = queries[Math.floor(Math.random() * queries.length)];

    const res = http.get(`${BASE_URL}/geocode?q=${encodeURIComponent(q)}&limit=3`, {
      headers: { 'x-api-key': VALID_API_KEY }
    });

    const isOk = check(res, {
      'Geocode status is 200': (r) => r.status === 200,
      'Returns results array': (r) => JSON.parse(r.body).results !== undefined,
    });

    geocodeDuration.add(res.timings.duration);
    errorRate.add(!isOk);
  });

  // SCENARIO 3: SECURITY & UNHEALTHY TOKENS (NEGATIVE TESTING)
  group('3. Security & Boundary Checks', () => {
    // 3a: Bad Token
    const resBad = http.get(`${BASE_URL}/tiles/esri-streets/6/33/25.png`, {
      headers: { 'x-api-key': 'invalid_token_999999999' }
    });
    check(resBad, {
      'Bad token rejected with 401': (r) => r.status === 401,
    });

    // 3b: Bad Coordinate Injection
    const resInvalidCoords = http.get(`${BASE_URL}/tiles/esri-streets/xyz/invalid/bad.png`);
    check(resInvalidCoords, {
      'Invalid tile coordinate rejected with 400': (r) => r.status === 400,
    });
  });

  // Sleep between 100ms and 400ms to simulate human browsing / map panning
  sleep(0.1 + Math.random() * 0.3);
}
