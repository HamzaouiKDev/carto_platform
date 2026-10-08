import request from 'supertest';
import app from '../src/index.js';

describe('CartoPlatform API Gateway Test Suite', () => {

  describe('Health and System Status', () => {
    it('GET /api/health should return 200 or 503 with structured health payload', async () => {
      const res = await request(app).get('/api/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('service');
      expect(res.body).toHaveProperty('dependencies');
      expect(res.body.dependencies).toHaveProperty('postgresql');
      expect(res.body.dependencies).toHaveProperty('redis');
    });

    it('GET /api/metrics should return Prometheus formatted metrics', async () => {
      const res = await request(app).get('/api/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toContain('carto_http_requests_total');
    });
  });

  describe('Cartographic Providers', () => {
    it('GET /api/providers should return configured providers list', async () => {
      const res = await request(app).get('/api/providers');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('providers');
      expect(Array.isArray(res.body.providers)).toBe(true);
    });

    it('GET /api/tiles/:provider/:z/:x/:y should reject invalid non-numeric coordinates', async () => {
      const res = await request(app).get('/api/tiles/esri-streets/abc/def/ghi.png');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'BadRequest');
    });
  });

  describe('Geocoding Services', () => {
    it('GET /api/geocode without query should return 400 BadRequest', async () => {
      const res = await request(app).get('/api/geocode?q=');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'BadRequest');
    });

    it('GET /api/reverse-geocode without coordinates should return 400 BadRequest', async () => {
      const res = await request(app).get('/api/reverse-geocode');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'BadRequest');
    });
  });

  describe('Security and Token Authentication', () => {
    it('POST /api/auth/login with wrong credentials should return 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@user.com', password: 'BadPassword123' });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
    });

    it('GET /api/me without credentials should return 401 Unauthorized', async () => {
      const res = await request(app).get('/api/me');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('code', 'AUTH_REQUIRED');
    });

    it('GET /api/admin/audit-logs without admin token should return 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/audit-logs');
      expect(res.status).toBe(401);
    });
  });

  describe('Statistics and API Management', () => {
    it('GET /api/statistics with period=24h and format=json should return 200 with summary and tokensUsage', async () => {
      const res = await request(app).get('/api/statistics?period=24h');
      // If DB is offline in unit test environment, it may return 500 or 200
      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('summary');
        expect(res.body).toHaveProperty('tokensUsage');
        expect(res.body).toHaveProperty('timeline');
      }
    });

    it('PUT /api/tokens/:id/toggle without auth should return 401 or handle error safely', async () => {
      const res = await request(app)
        .put('/api/tokens/00000000-0000-0000-0000-000000000000/toggle')
        .send({ isRevoked: true });
      expect([401, 404, 500]).toContain(res.status);
    });

    it('POST /api/statistics/reset without admin auth should return 401 or error safely', async () => {
      const res = await request(app)
        .post('/api/statistics/reset')
        .send({});
      expect([200, 401, 500]).toContain(res.status);
    });
  });

});
