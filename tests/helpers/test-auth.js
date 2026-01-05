/**
 * Test helper for API tests with authentication
 */

const request = require('supertest');

let sessionToken = null;
let testUsername = null;

/**
 * Create a test user and authenticate
 * @param {string} baseUrl - The base URL of the application (default: http://localhost:8787)
 * @returns {Promise<void>}
 */
async function createTestUserAndAuth(baseUrl = 'http://localhost:8787') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  testUsername = `api_test_user_${timestamp}_${random}`;
  const email = `${testUsername}@example.com`;
  const password = 'TestUser123!';

  // Register
  const registerRes = await request(baseUrl)
    .post('/api/register')
    .send({ username: testUsername, email, password });

  if (registerRes.status !== 200 && registerRes.status !== 201) {
    console.error('Registration failed:', registerRes.body);
    throw new Error(`Failed to register test user: ${JSON.stringify(registerRes.body)}`);
  }

  // Login
  let loginRes = await request(baseUrl)
    .post('/api/login')
    .send({ username: testUsername, password });

  if (loginRes.status === 403) {
    // User needs approval. Since we are in a test environment, we can manually approve the user.
    // This assumes we are running locally with wrangler.
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    
    try {
      // We need to use the exact same database as the running worker.
      // Assuming local dev environment.
      console.log(`Approving user ${testUsername}...`);
      
      // Create a temporary SQL file for the parameterized query
      const tmpDir = path.join(__dirname, '../../.tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      const tmpFile = path.join(tmpDir, `approve_user_${Date.now()}.sql`);
      // Use parameterized query by writing to a file
      // Note: wrangler d1 execute doesn't support direct parameterization, 
      // but we sanitize the username to prevent SQL injection
      const sanitizedUsername = testUsername.replace(/'/g, "''"); // SQL escape single quotes
      fs.writeFileSync(tmpFile, `UPDATE users SET approved = 1 WHERE username = '${sanitizedUsername}';`);
      
      // Execute the SQL file
      execSync(`npx wrangler d1 execute DB --local --file="${tmpFile}"`);
      
      // Clean up temporary file
      fs.unlinkSync(tmpFile);
      
      // Try login again
      loginRes = await request(baseUrl)
        .post('/api/login')
        .send({ username: testUsername, password });
    } catch (e) {
      console.error('Failed to auto-approve test user:', e.message);
    }
  }

  if (loginRes.status === 200) {
    sessionToken = loginRes.body.sessionId;
  } else {
    console.error('Login failed:', loginRes.body);
    throw new Error('Failed to authenticate test user');
  }
}

/**
 * Cleanup test user (logout)
 * @param {string} baseUrl - The base URL of the application
 */
async function cleanupTestUser(baseUrl = 'http://localhost:8787') {
  if (sessionToken) {
    await request(baseUrl)
      .post('/api/logout')
      .send({ sessionId: sessionToken });
    sessionToken = null;
    testUsername = null;
  }
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