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

/**
 * Comprehensive cleanup function that removes all test data
 * @param {string} baseUrl - The base URL of the application (default: http://localhost:8787)
 */
async function cleanupAllTestData(baseUrl = 'http://localhost:8787') {
  try {
    const apiContext = await request.newContext();
    
    console.log('🧹 Starting comprehensive test data cleanup...');
    
    // Get all events
    const response = await apiContext.get(`${baseUrl}/wtm/api/calendar-progress`);
    if (!response.ok()) {
      throw new Error(`Failed to fetch events: ${response.status()}`);
    }
    
    const events = await response.json();
    console.log(`📊 Found ${events.length} total events`);
    
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
        
        // 6. Specific test dates from API tests
        const testDates = ['2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-06', '2099-12-31'];
        if (testDates.includes(dateStr)) isTestData = true;
      }
      
      // API returns distance as 'title' field, not 'distance'
      if (isTestData) {
        try {
          const deleteResponse = await apiContext.delete(`${baseUrl}/wtm/api/calendar-progress`, {
            data: { start: event.start }
          });
          
          if (deleteResponse.ok()) {
            console.log(`✅ Cleaned up test event: ${event.title} km on ${event.start}`);
            cleanedCount++;
          } else {
            console.log(`❌ Failed to delete event ${event.title}: ${deleteResponse.status()}`);
          }
        } catch (deleteError) {
          console.log(`❌ Error deleting event ${event.title}:`, deleteError.message);
        }
      }
    }
    
    await apiContext.dispose();
    
    if (cleanedCount > 0) {
      console.log(`✨ Cleanup complete! Removed ${cleanedCount} test events`);
    } else {
      console.log('✨ No test data found - database is clean!');
    }
    
    return cleanedCount;
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    throw error;
  }
}

// Export for use in test files
module.exports = {
  TEST_VALUES,
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
