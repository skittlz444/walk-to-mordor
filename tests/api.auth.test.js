const request = require('supertest');
const { cleanupAllTestData } = require('./helpers/cleanup');

/**
 * API Authentication Tests
 * Tests the authentication endpoints (register, login, logout, me) 
 */

const server = 'http://localhost:8787';

describe('API Authentication Endpoints', () => {
  let testUser = null;
  let sessionCookie = null;

  // Clean up before and after all tests
  beforeAll(async () => {
    try {
      await cleanupAllTestData();
    } catch (error) {
      // Cleanup may fail if server not available, continue with tests
    }
  });

  afterAll(async () => {
    try {
      await cleanupAllTestData();
    } catch (error) {
      // Cleanup may fail if server not available, that's ok
    }
  });

  // Clean up test user before each test
  beforeEach(async () => {
    // Generate unique test user for each test (keep username <= 20 chars)
    const randomSuffix = Math.random().toString(36).substring(2, 8); // 6 chars
    testUser = {
      username: `user_${randomSuffix}`, // 11 chars total (user_ + 6 chars)
      password: 'TestPassword123!'
    };
    sessionCookie = null;
  });

  describe('User Registration', () => {
    test('should register a new user successfully', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/register')
        .send({
          username: testUser.username,
          password: testUser.password
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User registered successfully');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe(testUser.username);
      expect(res.body.sessionId).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
      
      // Should set a session cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies.some(cookie => cookie.startsWith('session='))).toBe(true);
    });

    test('should reject registration with missing username', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/register')
        .send({
          password: testUser.password
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields: username, password');
    });

    test('should reject registration with missing password', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/register')
        .send({
          username: testUser.username
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields: username, password');
    });

    test('should reject registration with invalid username', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/register')
        .send({
          username: 'ab', // Too short
          password: testUser.password
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid username. Must be 3-20 characters, alphanumeric, underscores, or hyphens only');
    });

    test('should reject registration with invalid password', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/register')
        .send({
          username: testUser.username,
          password: '1234567' // Too short and no letters
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid password. Must be at least 8 characters and contain both letters and numbers');
    });

    test('should reject registration with duplicate username', async () => {
      // First registration should succeed
      const res1 = await request(server)
        .post('/wtm/api/auth/register')
        .send({
          username: testUser.username,
          password: testUser.password
        });
      
      expect(res1.status).toBe(201);

      // Second registration with same username should fail
      const res2 = await request(server)
        .post('/wtm/api/auth/register')
        .send({
          username: testUser.username,
          password: testUser.password
        });

      expect(res2.status).toBe(409);
      expect(res2.body.error).toBe('Username already exists');
    });

    test('should handle invalid JSON in registration request', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid JSON');
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Register a user for login tests
      const registerRes = await request(server)
        .post('/wtm/api/auth/register')
        .send({
          username: testUser.username,
          password: testUser.password
        });
      
      expect(registerRes.status).toBe(201);
    });

    test('should login user successfully', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe(testUser.username);
      expect(res.body.user.id).toBeDefined();
      
      // Should set a session cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies.some(cookie => cookie.startsWith('session='))).toBe(true);
      
      // Store cookie for other tests
      sessionCookie = cookies.find(cookie => cookie.startsWith('session='));
    });

    test('should reject login with missing username', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/login')
        .send({
          password: testUser.password
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields: username, password');
    });

    test('should reject login with missing password', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/login')
        .send({
          username: testUser.username
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields: username, password');
    });

    test('should reject login with non-existent user', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/login')
        .send({
          username: 'nonexistentuser',
          password: testUser.password
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid username or password');
    });

    test('should reject login with wrong password', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid username or password');
    });

    test('should handle invalid JSON in login request', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid JSON');
    });
  });

  describe('Current User Info', () => {
    beforeEach(async () => {
      // Register and login a user
      await request(server)
        .post('/wtm/api/auth/register')
        .send({
          username: testUser.username,
          password: testUser.password
        });

      const loginRes = await request(server)
        .post('/wtm/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password
        });

      sessionCookie = loginRes.headers['set-cookie'].find(cookie => cookie.startsWith('session='));
    });

    test('should return current user info for authenticated user', async () => {
      const res = await request(server)
        .get('/wtm/api/auth/me')
        .set('Cookie', sessionCookie);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe(testUser.username);
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.password).toBeUndefined(); // Password should not be returned
    });

    test('should reject request without session cookie', async () => {
      const res = await request(server)
        .get('/wtm/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Not authenticated');
    });

    test('should reject request with invalid session cookie', async () => {
      const res = await request(server)
        .get('/wtm/api/auth/me')
        .set('Cookie', 'session=invalid-session-id');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Session invalid or expired');
    });
  });

  describe('User Logout', () => {
    beforeEach(async () => {
      // Register and login a user
      await request(server)
        .post('/wtm/api/auth/register')
        .send({
          username: testUser.username,
          password: testUser.password
        });

      const loginRes = await request(server)
        .post('/wtm/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password
        });

      sessionCookie = loginRes.headers['set-cookie'].find(cookie => cookie.startsWith('session='));
    });

    test('should logout user successfully', async () => {
      // Verify user is authenticated first
      const meRes = await request(server)
        .get('/wtm/api/auth/me')
        .set('Cookie', sessionCookie);
      expect(meRes.status).toBe(200);

      // Logout
      const logoutRes = await request(server)
        .post('/wtm/api/auth/logout')
        .set('Cookie', sessionCookie);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toBe('Logout successful');
      
      // Should clear the session cookie
      const cookies = logoutRes.headers['set-cookie'];
      expect(cookies.some(cookie => cookie.includes('session=; HttpOnly; SameSite=Strict; Max-Age=0'))).toBe(true);

      // Verify user is no longer authenticated
      const meRes2 = await request(server)
        .get('/wtm/api/auth/me')
        .set('Cookie', sessionCookie);
      expect(meRes2.status).toBe(401);
    });

    test('should handle logout without session cookie', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logout successful');
    });

    test('should handle logout with invalid session cookie', async () => {
      const res = await request(server)
        .post('/wtm/api/auth/logout')
        .set('Cookie', 'session=invalid-session-id');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logout successful');
    });
  });

  describe('Session Management', () => {
    test('should maintain session across requests', async () => {
      // Register user
      const registerRes = await request(server)
        .post('/wtm/api/auth/register')
        .send({
          username: testUser.username,
          password: testUser.password
        });
      
      const sessionCookie = registerRes.headers['set-cookie'].find(cookie => cookie.startsWith('session='));

      // Use session to access protected endpoint
      const protectedRes = await request(server)
        .get('/wtm/api/calendar-progress')
        .set('Cookie', sessionCookie);

      expect(protectedRes.status).toBe(200);
      expect(Array.isArray(protectedRes.body)).toBe(true);
    });

    test('should reject access to protected endpoints without authentication', async () => {
      const protectedEndpoints = [
        '/wtm/api/calendar-progress',
        '/wtm/api/goals',
        '/wtm/api/total-distance'
      ];

      for (const endpoint of protectedEndpoints) {
        const res = await request(server).get(endpoint);
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Authentication required');
      }
    });

    test('should handle concurrent sessions for different users', async () => {
      // Create two different users
      const user1 = {
        username: `user1_${Date.now()}`,
        password: 'TestPassword123!'
      };
      const user2 = {
        username: `user2_${Date.now()}`,
        password: 'TestPassword123!'
      };

      // Register both users
      const reg1 = await request(server)
        .post('/wtm/api/auth/register')
        .send(user1);
      const reg2 = await request(server)
        .post('/wtm/api/auth/register')
        .send(user2);

      expect(reg1.status).toBe(201);
      expect(reg2.status).toBe(201);

      const cookie1 = reg1.headers['set-cookie'].find(cookie => cookie.startsWith('session='));
      const cookie2 = reg2.headers['set-cookie'].find(cookie => cookie.startsWith('session='));

      // Verify both users can access their own info
      const me1 = await request(server)
        .get('/wtm/api/auth/me')
        .set('Cookie', cookie1);
      const me2 = await request(server)
        .get('/wtm/api/auth/me')
        .set('Cookie', cookie2);

      expect(me1.status).toBe(200);
      expect(me2.status).toBe(200);
      expect(me1.body.user.username).toBe(user1.username);
      expect(me2.body.user.username).toBe(user2.username);
      expect(me1.body.user.id).not.toBe(me2.body.user.id);
    });
  });

  describe('HTTP Method Validation', () => {
    test('should reject invalid methods for auth endpoints', async () => {
      const endpoints = [
        { path: '/wtm/api/auth/register', validMethods: ['POST'] },
        { path: '/wtm/api/auth/login', validMethods: ['POST'] },
        { path: '/wtm/api/auth/logout', validMethods: ['POST'] },
        { path: '/wtm/api/auth/me', validMethods: ['GET'] }
      ];

      const invalidMethods = ['GET', 'PUT', 'DELETE', 'PATCH'];

      for (const endpoint of endpoints) {
        for (const method of invalidMethods) {
          if (!endpoint.validMethods.includes(method)) {
            const res = await request(server)[method.toLowerCase()](endpoint.path);
            expect(res.status).toBe(405);
            expect(res.body.error).toContain('Method');
          }
        }
      }
    });
  });
});