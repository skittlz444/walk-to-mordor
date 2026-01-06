/**
 * Test helper for API tests with authentication
 */

const request = require('supertest');

let sessionToken = null;
let testUsername = null;

/**
 * Create a test user and authenticate using mock auth tokens
 * @param {string} baseUrl - The base URL of the application (default: http://localhost:8787)
 * @returns {Promise<void>}
 */
async function createTestUserAndAuth(baseUrl = 'http://localhost:8787') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  testUsername = `api_test_user_${timestamp}_${random}`;

  // Use mock authentication token for testing
  // This bypasses registration and approval since ALLOW_TEST_AUTH=true in test environment
  sessionToken = `TEST_MOCK_TOKEN_${testUsername}`;
  
  // Verify the mock token works by calling the session endpoint
  const sessionRes = await request(baseUrl)
    .get('/api/session')
    .set('Authorization', `Bearer ${sessionToken}`);
  
  if (sessionRes.status !== 200) {
    console.error('Mock auth session validation failed:', sessionRes.body);
    throw new Error(`Failed to create test user with mock auth: ${JSON.stringify(sessionRes.body)}`);
  }
}

/**
 * Cleanup test user
 * Note: Mock auth tokens are stateless and don't require explicit cleanup
 * @param {string} baseUrl - The base URL of the application
 */
async function cleanupTestUser(baseUrl = 'http://localhost:8787') {
  // Mock auth tokens don't need explicit logout since they're not stored in sessions table
  // Just clear the local state
  sessionToken = null;
  testUsername = null;
}

/**
 * Get auth headers
 * @returns {Object|null} 
 */
function getAuthHeaders() {
  if (sessionToken) {
    return { 'Authorization': `Bearer ${sessionToken}` };
  }
  return null;
}

/**
 * Create a request with supertest and add auth header
 * @param {string} server - Server URL or supertest app
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @returns {supertest.Test} Supertest request
 */
function createAuthenticatedRequest(server, method, path) {
  const req = request(server)[method.toLowerCase()](path);
  if (sessionToken) {
    req.set('Authorization', `Bearer ${sessionToken}`);
  }
  return req;
}

module.exports = {
  createTestUserAndAuth,
  cleanupTestUser,
  getAuthHeaders,
  createAuthenticatedRequest
};