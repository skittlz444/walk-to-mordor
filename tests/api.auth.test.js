// API tests for authentication endpoints
const request = require('supertest');
const { cleanupAllTestData } = require('./helpers/cleanup');

const server = 'http://localhost:8787';

describe('Authentication API - Success Flows', () => {
  let sessionToken;
  let username;

  afterAll(async () => {
    // Clean up test data
    await cleanupAllTestData();
  });

  describe('Registration', () => {
    it('should register a new user successfully', async () => {
      username = `testuser_${Date.now()}`;
      const res = await request(server)
        .post('/api/register')
        .send({
          username,
          email: `${username}@example.com`,
          password: 'Test1234!'
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('username', username);
    });

    it('should reject duplicate username', async () => {
      const res = await request(server)
        .post('/api/register')
        .send({
          username,
          email: 'different@example.com',
          password: 'Test1234!'
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('already exists');
    });

    it('should reject invalid password', async () => {
      const res = await request(server)
        .post('/api/register')
        .send({
          username: `testuser2_${Date.now()}`,
          email: 'test2@example.com',
          password: 'weak'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject invalid email', async () => {
      const res = await request(server)
        .post('/api/register')
        .send({
          username: `testuser3_${Date.now()}`,
          email: 'not-an-email',
          password: 'Test1234!'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('email');
    });
  });

  describe('Login', () => {
    it('should login successfully with valid credentials', async () => {
      const res = await request(server)
        .post('/api/login')
        .send({
          username,
          password: 'Test1234!'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sessionId');
      expect(res.body).toHaveProperty('expiresAt');
      expect(res.body).toHaveProperty('username', username);
      
      sessionToken = res.body.sessionId;
    });

    it('should reject invalid password', async () => {
      const res = await request(server)
        .post('/api/login')
        .send({
          username,
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid');
    });

    it('should reject non-existent user', async () => {
      const res = await request(server)
        .post('/api/login')
        .send({
          username: 'nonexistent',
          password: 'Test1234!'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid');
    });
  });

  describe('Session Validation', () => {
    it('should validate valid session', async () => {
      const res = await request(server)
        .get('/api/session')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('userId');
      expect(res.body).toHaveProperty('username', username);
    });

    it('should reject invalid session token', async () => {
      const res = await request(server)
        .get('/api/session')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });

    it('should reject missing authorization header', async () => {
      const res = await request(server)
        .get('/api/session');

      expect(res.status).toBe(401);
    });
  });

  describe('Protected Endpoints', () => {
    it('should allow authenticated access to calendar-progress', async () => {
      const res = await request(server)
        .get('/api/calendar-progress')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should reject unauthenticated access to calendar-progress', async () => {
      const res = await request(server)
        .get('/api/calendar-progress');

      expect(res.status).toBe(401);
    });

    it('should allow authenticated access to total-distance', async () => {
      const res = await request(server)
        .get('/api/total-distance')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalDistance');
    });
  });

  describe('Logout', () => {
    it('should logout successfully', async () => {
      const res = await request(server)
        .post('/api/logout')
        .send({ sessionId: sessionToken });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Logout successful');
    });

    it('should invalidate session after logout', async () => {
      const res = await request(server)
        .get('/api/session')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(401);
    });
  });
});
