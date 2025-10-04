/**
 * Test authentication helper
 * Creates and manages test user authentication for API tests
 */

const request = require('supertest');

// Unique test user credentials
const TEST_USER_CREDENTIALS = {
  username: 'test_' + (Date.now() % 1000000), // Keep username short but unique
  password: 'testpass123'
};

let sessionCookie = null;
let isUserCreated = false;

/**
 * Create a test user and return authentication headers
 * @param {string} baseUrl - The base URL of the application (default: http://localhost:8787)
 * @returns {Promise<{cookie: string}>} Authentication headers for requests
 */
async function createTestUserAndAuth(baseUrl = 'http://localhost:8787') {
  if (sessionCookie && isUserCreated) {
    return { cookie: sessionCookie };
  }

  const server = baseUrl;
  
  try {
    // Register test user
    const registerRes = await request(server)
      .post('/wtm/api/auth/register')
      .send(TEST_USER_CREDENTIALS);
    
    if (registerRes.status !== 201 && registerRes.status !== 409) {
      throw new Error(`Failed to register test user: ${registerRes.status} - ${registerRes.text}`);
    }
    
    // Login to get session cookie
    const loginRes = await request(server)
      .post('/wtm/api/auth/login')
      .send(TEST_USER_CREDENTIALS);
    
    if (loginRes.status !== 200) {
      throw new Error(`Failed to login test user: ${loginRes.status} - ${loginRes.text}`);
    }
    
    // Extract session cookie from response
    const setCookieHeader = loginRes.headers['set-cookie'];
    if (!setCookieHeader) {
      throw new Error('No session cookie received after login');
    }
    
    // Find the session cookie
    let sessionValue = null;
    for (const cookie of setCookieHeader) {
      if (cookie.startsWith('session=')) {
        sessionValue = cookie.split(';')[0]; // Get just the session=value part
        break;
      }
    }
    
    if (!sessionValue) {
      throw new Error('Session cookie not found in login response');
    }
    
    sessionCookie = sessionValue;
    isUserCreated = true;
    
    return { cookie: sessionCookie };
    
  } catch (error) {
    console.error('Error creating test user authentication:', error);
    throw error;
  }
}

/**
 * Clean up test user and session
 * @param {string} baseUrl - The base URL of the application
 */
async function cleanupTestUser(baseUrl = 'http://localhost:8787') {
  if (!sessionCookie || !isUserCreated) {
    return;
  }

  const server = baseUrl;
  
  try {
    
    // Logout to destroy session
    await request(server)
      .post('/wtm/api/auth/logout')
      .set('Cookie', sessionCookie);
  } catch (error) {
    console.error('Error cleaning up test user:', error);
  } finally {
    sessionCookie = null;
    isUserCreated = false;
  }
}

/**
 * Get current authentication headers if available
 * @returns {Object|null} Authentication headers or null if not authenticated
 */
function getAuthHeaders() {
  if (!sessionCookie) {
    return null;
  }
  
  return { Cookie: sessionCookie };
}

/**
 * Create an authenticated request with supertest
 * @param {string} server - Server URL or supertest app
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @returns {supertest.Test} Authenticated supertest request
 */
function createAuthenticatedRequest(server, method, path) {
  const req = request(server)[method.toLowerCase()](path);
  
  if (sessionCookie) {
    req.set('Cookie', sessionCookie);
  }
  
  return req;
}

module.exports = {
  createTestUserAndAuth,
  cleanupTestUser,
  getAuthHeaders,
  createAuthenticatedRequest,
  TEST_USER_CREDENTIALS
};