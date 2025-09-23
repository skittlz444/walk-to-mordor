/**
 * Comprehensive test data cleanup utility
 * This can be run independently to clean up any leftover test data
 */

const { request } = require('@playwright/test');
const { getAuthHeaders, createTestUserAndAuth } = require('./test-auth');

/**
 * Clear ALL distance data from the database before/after tests
 * This ensures a clean state for each test run without worrying about data interference
 * @param {string} baseUrl - The base URL of the application (default: http://localhost:8787)
 */
async function cleanupAllTestData(baseUrl = 'http://localhost:8787') {
  try {
    // Ensure we have authentication
    let authHeaders = getAuthHeaders();
    if (!authHeaders) {
      await createTestUserAndAuth(baseUrl);
      authHeaders = getAuthHeaders();
    }
    
    const apiContext = await request.newContext({
      extraHTTPHeaders: authHeaders || {}
    });
    
    // Get all events
    const response = await apiContext.get(`${baseUrl}/wtm/api/calendar-progress`);
    if (!response.ok()) {
      await apiContext.dispose();
      return 0;
    }
    
    const events = await response.json();
    
    let cleanedCount = 0;
    
    // Delete ALL events - we start with a completely clean slate
    for (const event of events) {
      try {
        const deleteResponse = await apiContext.delete(`${baseUrl}/wtm/api/calendar-progress`, {
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
    
    await apiContext.dispose();
    
    return cleanedCount;
    
  } catch (error) {
    // Only log errors when running standalone
    if (require.main === module) {
      console.error('❌ Cleanup failed:', error.message);
    }
    throw error;
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
