/**
 * Test helper for API tests (authentication removed)
 */

const request = require('supertest');

/**
 * No-op function for backward compatibility
 * @param {string} baseUrl - The base URL of the application (default: http://localhost:8787)
 * @returns {Promise<void>}
 */
async function createTestUserAndAuth(baseUrl = 'http://localhost:8787') {
  // No authentication needed anymore
  return;
}

/**
 * No-op function for backward compatibility
 * @param {string} baseUrl - The base URL of the application
 */
async function cleanupTestUser(baseUrl = 'http://localhost:8787') {
  // No cleanup needed anymore
  return;
}

/**
 * No-op function for backward compatibility
 * @returns {Object|null} 
 */
function getAuthHeaders() {
  return null;
}

/**
 * Create a request with supertest (no authentication needed)
 * @param {string} server - Server URL or supertest app
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @returns {supertest.Test} Supertest request
 */
function createAuthenticatedRequest(server, method, path) {
  return request(server)[method.toLowerCase()](path);
}

module.exports = {
  createTestUserAndAuth,
  cleanupTestUser,
  getAuthHeaders,
  createAuthenticatedRequest
};