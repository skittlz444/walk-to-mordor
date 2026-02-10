/**
 * Comprehensive test data cleanup utility
 * This can be run independently to clean up any leftover test data
 */

const { request } = require('@playwright/test');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetriableNetworkError(error) {
  const message = (error && error.message) ? error.message : String(error);
  return (
    message.includes('socket hang up') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ECONNREFUSED')
  );
}

/**
 * Retry helper with exponential backoff for network operations.
 * @param {import('@playwright/test').APIRequestContext} apiContext - The API context
 * @param {string} url - The URL to request
 * @param {Object} options - Request options
 * @param {number} retries - Number of retry attempts (default: 3)
 * @returns {Promise<import('@playwright/test').APIResponse>} The API response
 * @throws {Error} Throws the last error if all retries fail
 */
async function getWithRetry(apiContext, url, options = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await apiContext.get(url, options);
    } catch (error) {
      if (!isRetriableNetworkError(error) || attempt === retries) {
        throw error;
      }
      await sleep(250 * attempt);
    }
  }
}

/**
 * Clear ALL distance data from the database before/after tests
 * This ensures a clean state for each test run without worrying about data interference
 * @param {string} baseUrl - The base URL of the application (default: http://localhost:8787)
 */
async function cleanupAllTestData(baseUrl = 'http://127.0.0.1:8787', token = 'TEST_MOCK_TOKEN') {
  /** @type {import('@playwright/test').APIRequestContext | undefined} */
  let apiContext;
  try {
    // Use mock auth token
    apiContext = await request.newContext({
      extraHTTPHeaders: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Get all events
    const response = await getWithRetry(apiContext, `${baseUrl}/api/calendar-progress`);
    if (!response.ok()) {
      return 0;
    }
    
    let events = [];
    try {
      events = await response.json();
    } catch(e) {
      // Ignore JSON parse errors (empty body, etc)
      return 0;
    }
    
    let cleanedCount = 0;
    
    // Delete ALL events - we start with a completely clean slate
    for (const event of events) {
      try {
        const deleteResponse = await apiContext.delete(`${baseUrl}/api/calendar-progress`, {
          data: { start: event.start }
        });
        
        if (deleteResponse.ok()) {
          cleanedCount++;
        }
      } catch (deleteError) {
        // Silently continue with cleanup even if individual deletions fail
        console.warn(`Failed to delete event for ${event.start}:`, deleteError.message);
      }
    }
    
    return cleanedCount;
    
  } catch (error) {
    // Only log errors when running standalone
    if (require.main === module) {
      console.error('❌ Cleanup failed:', error.message);
    }
    throw error;
  } finally {
    if (apiContext) {
      try {
        await apiContext.dispose();
      } catch (e) {
        // Ignore dispose errors in tests.
      }
    }
  }
}

// Export for use in test files
module.exports = {
  cleanupAllTestData
};

// Allow running this script directly
if (require.main === module) {
  cleanupAllTestData()
    .then((count) => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}
