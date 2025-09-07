/**
 * Comprehensive test data cleanup utility
 * This can be run independently to clean up any leftover test data
 */

const { request } = require('@playwright/test');

// Test values used across all UI tests
const TEST_VALUES = [
  '9876543', // Test value 1: clearly unrealistic distance
  '8765432', // Test value 2: decreasing pattern  
  '7654321', // Test value 3: decreasing pattern
  '6543210', // Test value 4: for additional tests
  '5432109'  // Test value 5: for additional tests
];

// Test date patterns used in API and UI tests
const TEST_DATES = [
  '2024-01-02', // API test date
  '2024-01-03', // API test date  
  '2024-01-04', // API test date
  '2024-01-05', // API test date
  '2024-01-06', // API test date
  '2025-09-14', // UI test date (far future)
  '2099-12-31'  // Edge case test date
];

/**
 * Comprehensive cleanup function that removes all test data
 * @param {string} baseUrl - The base URL of the application (default: http://localhost:8787)
 */
async function cleanupAllTestData(baseUrl = 'http://localhost:8787') {
  try {
    const apiContext = await request.newContext();
    
    // Get all events
    const response = await apiContext.get(`${baseUrl}/wtm/api/calendar-progress`);
    if (!response.ok()) {
      throw new Error(`Failed to fetch events: ${response.status()}`);
    }
    
    const events = await response.json();
    
    let cleanedCount = 0;
    
    // Delete any events with test distances - check multiple patterns
    for (const event of events) {
      let isTestData = false;
      
      // Check if this is test data using multiple criteria
      if (event.title) {
        const distance = parseFloat(event.title);
        const dateStr = event.start;
        
        // 1. Our main UI test values (unrealistic large numbers)
        if (TEST_VALUES.includes(event.title.toString())) isTestData = true;
        
        // 2. API test patterns (repeated digits like 999999, 888888, etc.)
        if (/^(\d)\1{5,}$/.test(event.title)) isTestData = true;
        
        // 3. Zero values (used in tests)
        if (distance === 0) isTestData = true;
        
        // 4. Decimal test values (like 15.5)
        if (distance === 15.5) isTestData = true;
        
        // 5. Very large distances (over 1 million - clearly test data)
        if (distance >= 1000000) isTestData = true;
        
        // 6. Specific test dates from API and UI tests
        if (TEST_DATES.includes(dateStr)) isTestData = true;
      }
      
      // API returns distance as 'title' field, not 'distance'
      if (isTestData) {
        try {
          const deleteResponse = await apiContext.delete(`${baseUrl}/wtm/api/calendar-progress`, {
            data: { start: event.start }
          });
          
          if (deleteResponse.ok()) {
            cleanedCount++;
          }
        } catch (deleteError) {
          // Silently continue with cleanup even if individual deletions fail
        }
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
  TEST_VALUES,
  TEST_DATES,
  cleanupAllTestData
};

// Allow running this script directly
if (require.main === module) {
  cleanupAllTestData()
    .then((count) => {
      console.log(`✨ Cleanup complete! Removed ${count} test events`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}
