/**
 * Browser authentication helper for Playwright UI tests
 * Handles login flow and session management in the browser
 */

const { createTestUserAndAuth, TEST_USER_CREDENTIALS } = require('./test-auth');

/**
 * Authenticate a user in the browser by navigating through the login flow
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} baseUrl - Base URL (default: http://localhost:8787)
 * @returns {Promise<void>}
 */
async function authenticateUserInBrowser(page, baseUrl = 'http://localhost:8787') {
  try {
    // First, create the test user via API if not already created
    await createTestUserAndAuth(baseUrl);
    
    // Navigate to the application
    await page.goto(baseUrl + '/wtm/');
    
    // Check if we're already on the main page (authenticated)
    const isOnMainPage = await page.locator('#eventcalendar').isVisible({ timeout: 2000 }).catch(() => false);
    if (isOnMainPage) {
      return;
    }
    
    // We should be on the login page, fill in credentials
    
    // Wait for login form to be visible
    await page.waitForSelector('#login-form', { timeout: 10000 });
    
    // Fill in login credentials
    await page.fill('#login-username', TEST_USER_CREDENTIALS.username);
    await page.fill('#login-password', TEST_USER_CREDENTIALS.password);
    
    // Submit the login form
    await page.click('#login-form button[type="submit"]');
    
    // Wait for successful login (main page should load)
    await page.waitForSelector('#eventcalendar', { timeout: 10000 });
    
  } catch (error) {
    console.error('Error authenticating user in browser:', error);
    throw new Error(`Failed to authenticate user in browser: ${error.message}`);
  }
}

/**
 * Create authenticated context for Playwright API requests
 * @param {import('@playwright/test').APIRequestContext} request - Playwright request context
 * @param {string} baseUrl - Base URL (default: http://localhost:8787)
 * @returns {Promise<{Cookie: string}>} Authentication headers
 */
async function getAuthenticatedApiContext(request, baseUrl = 'http://localhost:8787') {
  try {
    // Create test user and get auth
    const auth = await createTestUserAndAuth(baseUrl);
    
    return {
      'Cookie': auth.cookie
    };
    
  } catch (error) {
    console.error('Error getting authenticated API context:', error);
    throw error;
  }
}

/**
 * Make an authenticated API request using Playwright's request context
 * @param {import('@playwright/test').APIRequestContext} request - Playwright request context
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {Object} options - Request options
 * @param {string} baseUrl - Base URL (default: http://localhost:8787)
 * @returns {Promise<import('@playwright/test').APIResponse>}
 */
async function makeAuthenticatedApiRequest(request, method, url, options = {}, baseUrl = 'http://localhost:8787') {
  const authHeaders = await getAuthenticatedApiContext(request, baseUrl);
  
  const requestOptions = {
    ...options,
    headers: {
      ...options.headers,
      ...authHeaders
    }
  };
  
  return await request[method.toLowerCase()](url, requestOptions);
}

/**
 * Check if user is authenticated by looking for main page elements
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>}
 */
async function isUserAuthenticated(page) {
  try {
    // Check for main application elements
    const hasCalendar = await page.locator('#eventcalendar').isVisible({ timeout: 2000 }).catch(() => false);
    const hasGoalsList = await page.locator('#goals-list').isVisible({ timeout: 2000 }).catch(() => false);
    
    return hasCalendar || hasGoalsList;
  } catch (error) {
    return false;
  }
}

/**
 * Logout user in the browser (if logout functionality exists)
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function logoutUserInBrowser(page) {
  try {
    // Look for logout button or link
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), [data-testid="logout"]');
    
    if (await logoutButton.isVisible({ timeout: 2000 })) {
      await logoutButton.click();
      // Wait for redirect to login page
      await page.waitForSelector('#login-form', { timeout: 5000 });
    }
  } catch (error) {
    // Logout might not be implemented or visible
  }
}

module.exports = {
  authenticateUserInBrowser,
  getAuthenticatedApiContext,
  makeAuthenticatedApiRequest,
  isUserAuthenticated,
  logoutUserInBrowser,
  TEST_USER_CREDENTIALS
};