import assert from 'node:assert';
import test from 'node:test';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000/api';

test('1. Health Check returns HEALTHY status', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'HEALTHY');
  assert.strictEqual(data.dependencies.postgresql.status, 'UP');
  assert.strictEqual(data.dependencies.redis.status, 'UP');
});

test('2. Providers Endpoint lists all configured services', async () => {
  const res = await fetch(`${BASE_URL}/providers`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(data.count >= 4);
  assert.ok(data.providers.some(p => p.id === 'esri-imagery'));
});

test('3. Tile Server returns 200 with valid Content-Type and ETag', async () => {
  const res = await fetch(`${BASE_URL}/tiles/esri-imagery/6/33/25.png`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('image'));
  assert.ok(res.headers.get('etag'));
});

test('4. Tile Server returns 304 on ETag Match (Cache Optimization)', async () => {
  const tileRes = await fetch(`${BASE_URL}/tiles/esri-imagery/6/33/25.png`);
  const etag = tileRes.headers.get('etag');

  const cachedRes = await fetch(`${BASE_URL}/tiles/esri-imagery/6/33/25.png`, {
    headers: { 'If-None-Match': etag }
  });
  assert.strictEqual(cachedRes.status, 304);
});

test('5. Geocoding Query returns normalized coordinates', async () => {
  const res = await fetch(`${BASE_URL}/geocode?q=Tunis`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(data.results.length > 0);
  assert.ok(data.results[0].lat !== undefined);
  assert.ok(data.results[0].lon !== undefined);
});

test('6. Security rejects unauthenticated profile query', async () => {
  const res = await fetch(`${BASE_URL}/me`);
  assert.strictEqual(res.status, 401);
});
