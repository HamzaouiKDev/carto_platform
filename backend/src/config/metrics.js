import client from 'prom-client';

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'carto_' });

export const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'carto_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const httpRequestsTotal = new client.Counter({
  name: 'carto_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const tileRequestsTotal = new client.Counter({
  name: 'carto_tile_requests_total',
  help: 'Total number of tile requests with cache status',
  labelNames: ['provider', 'cache_status'], // HIT, MISS, ERROR
});

export const upstreamProviderDurationSeconds = new client.Histogram({
  name: 'carto_upstream_provider_duration_seconds',
  help: 'Duration of external upstream provider requests',
  labelNames: ['provider'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 4, 8],
});

export const circuitBreakerStateGauge = new client.Gauge({
  name: 'carto_circuit_breaker_state',
  help: 'Circuit breaker state: 0=CLOSED (Normal), 1=HALF-OPEN, 2=OPEN (Tripped)',
  labelNames: ['provider'],
});

export const activeConnectionsGauge = new client.Gauge({
  name: 'carto_active_connections',
  help: 'Number of active HTTP requests being processed',
});

export const metricsRegistry = client.register;
