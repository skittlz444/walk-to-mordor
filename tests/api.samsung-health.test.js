// Samsung Health API Integration Tests
const request = require('supertest');

const baseUrl = 'http://localhost:8787';

describe('Samsung Health API Integration', () => {
  let sessionCookie = '';
  let userId = null;

  // Helper to create a test user and get session
  beforeAll(async () => {
    const username = `test_samsung_health_${Date.now()}`;
    const password = 'TestPassword123';

    // Register user
    const registerResponse = await request(baseUrl)
      .post('/wtm/api/auth/register')
      .send({ username, password });

    expect(registerResponse.status).toBe(201);
    sessionCookie = registerResponse.headers['set-cookie'][0];
    userId = registerResponse.body.user.id;
  });

  describe('GET /wtm/api/samsung-health/status', () => {
    it('should return not linked status initially', async () => {
      const response = await request(baseUrl)
        .get('/wtm/api/samsung-health/status')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.isLinked).toBe(false);
      expect(response.body.linkedAt).toBeNull();
    });

    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .get('/wtm/api/samsung-health/status');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('GET /wtm/api/samsung-health/auth-url', () => {
    it('should generate authorization URL', async () => {
      const response = await request(baseUrl)
        .get('/wtm/api/samsung-health/auth-url')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(200);
      expect(response.body.authUrl).toBeTruthy();
      expect(response.body.authUrl).toContain('https://account.samsung.com/accounts/oauth/authorize');
      expect(response.body.authUrl).toContain('client_id=mock_client_id');
      expect(response.body.state).toBeTruthy();
      expect(response.body.state).toContain(`user_${userId}_`);
    });

    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .get('/wtm/api/samsung-health/auth-url');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('POST /wtm/api/samsung-health/callback', () => {
    it('should link Samsung Health account with valid auth code', async () => {
      const state = `user_${userId}_${Date.now()}`;
      
      const response = await request(baseUrl)
        .post('/wtm/api/samsung-health/callback')
        .set('Cookie', sessionCookie)
        .send({
          authCode: 'mock_auth_code',
          state: state
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Samsung Health account linked successfully');
      expect(response.body.linkedAt).toBeTruthy();
    });

    it('should reject missing auth code', async () => {
      const state = `user_${userId}_${Date.now()}`;
      
      const response = await request(baseUrl)
        .post('/wtm/api/samsung-health/callback')
        .set('Cookie', sessionCookie)
        .send({
          state: state
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing authorization code');
    });

    it('should reject invalid state', async () => {
      const response = await request(baseUrl)
        .post('/wtm/api/samsung-health/callback')
        .set('Cookie', sessionCookie)
        .send({
          authCode: 'mock_auth_code',
          state: 'invalid_state'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid or missing state parameter');
    });

    it('should reject invalid auth code', async () => {
      const state = `user_${userId}_${Date.now()}`;
      
      const response = await request(baseUrl)
        .post('/wtm/api/samsung-health/callback')
        .set('Cookie', sessionCookie)
        .send({
          authCode: 'invalid_code',
          state: state
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Failed to exchange authorization code for tokens');
    });

    it('should require authentication', async () => {
      const response = await request(baseUrl)
        .post('/wtm/api/samsung-health/callback')
        .send({
          authCode: 'mock_auth_code',
          state: 'user_1_123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('After linking Samsung Health', () => {
    // Link Samsung Health for following tests
    beforeAll(async () => {
      const state = `user_${userId}_${Date.now()}`;
      
      await request(baseUrl)
        .post('/wtm/api/samsung-health/callback')
        .set('Cookie', sessionCookie)
        .send({
          authCode: 'mock_auth_code',
          state: state
        });
    });

    describe('GET /wtm/api/samsung-health/status', () => {
      it('should return linked status after linking', async () => {
        const response = await request(baseUrl)
          .get('/wtm/api/samsung-health/status')
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(200);
        expect(response.body.isLinked).toBe(true);
        expect(response.body.linkedAt).toBeTruthy();
      });
    });

    describe('POST /wtm/api/samsung-health/sync', () => {
      it('should sync walking distance for valid date', async () => {
        const response = await request(baseUrl)
          .post('/wtm/api/samsung-health/sync')
          .set('Cookie', sessionCookie)
          .send({
            date: '2024-01-15'
          });

        expect(response.status).toBe(200);
        expect(response.body.date).toBe('2024-01-15');
        expect(response.body.distance).toBeGreaterThanOrEqual(0);
        expect(response.body.distance).toBeLessThanOrEqual(10);
        expect(response.body.syncedAt).toBeTruthy();
      });

      it('should reject missing date', async () => {
        const response = await request(baseUrl)
          .post('/wtm/api/samsung-health/sync')
          .set('Cookie', sessionCookie)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Valid date (YYYY-MM-DD) is required');
      });

      it('should reject invalid date format', async () => {
        const response = await request(baseUrl)
          .post('/wtm/api/samsung-health/sync')
          .set('Cookie', sessionCookie)
          .send({
            date: 'invalid-date'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Valid date (YYYY-MM-DD) is required');
      });

      it('should require authentication', async () => {
        const response = await request(baseUrl)
          .post('/wtm/api/samsung-health/sync')
          .send({
            date: '2024-01-15'
          });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authentication required');
      });
    });

    describe('Progress with Samsung Health sync', () => {
      it('should save progress with samsung_health sync source', async () => {
        const testDate = '2024-01-20';
        const testDistance = 5.5;

        const response = await request(baseUrl)
          .post('/wtm/api/calendar-progress')
          .set('Cookie', sessionCookie)
          .send({
            start: testDate,
            title: testDistance.toString(),
            syncSource: 'samsung_health'
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Created successfully');
        expect(response.body.syncSource).toBe('samsung_health');
      });

      it('should retrieve progress with sync source information', async () => {
        const response = await request(baseUrl)
          .get('/wtm/api/calendar-progress')
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        
        // Find the Samsung Health synced entry
        const samsungHealthEntry = response.body.find(entry => entry.syncSource === 'samsung_health');
        expect(samsungHealthEntry).toBeTruthy();
        expect(samsungHealthEntry.syncSource).toBe('samsung_health');
      });
    });

    describe('POST /wtm/api/samsung-health/unlink', () => {
      it('should unlink Samsung Health account', async () => {
        const response = await request(baseUrl)
          .post('/wtm/api/samsung-health/unlink')
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Samsung Health account unlinked successfully');
      });

      it('should return not linked status after unlinking', async () => {
        const response = await request(baseUrl)
          .get('/wtm/api/samsung-health/status')
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(200);
        expect(response.body.isLinked).toBe(false);
        expect(response.body.linkedAt).toBeNull();
      });

      it('should fail to sync after unlinking', async () => {
        const response = await request(baseUrl)
          .post('/wtm/api/samsung-health/sync')
          .set('Cookie', sessionCookie)
          .send({
            date: '2024-01-15'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Samsung Health account not linked');
      });

      it('should handle unlinking when already unlinked', async () => {
        const response = await request(baseUrl)
          .post('/wtm/api/samsung-health/unlink')
          .set('Cookie', sessionCookie);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Samsung Health account not linked');
      });

      it('should require authentication', async () => {
        const response = await request(baseUrl)
          .post('/wtm/api/samsung-health/unlink');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authentication required');
      });
    });
  });

  describe('HTTP Method Validation', () => {
    it('should reject invalid methods for status endpoint', async () => {
      const response = await request(baseUrl)
        .post('/wtm/api/samsung-health/status')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(405);
      expect(response.body.error).toContain('Method POST not allowed');
    });

    it('should reject invalid methods for auth-url endpoint', async () => {
      const response = await request(baseUrl)
        .post('/wtm/api/samsung-health/auth-url')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(405);
      expect(response.body.error).toContain('Method POST not allowed');
    });

    it('should reject invalid methods for callback endpoint', async () => {
      const response = await request(baseUrl)
        .get('/wtm/api/samsung-health/callback')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(405);
      expect(response.body.error).toContain('Method GET not allowed');
    });

    it('should reject invalid methods for sync endpoint', async () => {
      const response = await request(baseUrl)
        .get('/wtm/api/samsung-health/sync')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(405);
      expect(response.body.error).toContain('Method GET not allowed');
    });

    it('should reject invalid methods for unlink endpoint', async () => {
      const response = await request(baseUrl)
        .get('/wtm/api/samsung-health/unlink')
        .set('Cookie', sessionCookie);

      expect(response.status).toBe(405);
      expect(response.body.error).toContain('Method GET not allowed');
    });
  });
});