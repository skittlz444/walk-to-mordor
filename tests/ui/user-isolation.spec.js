// @ts-check
/**
 * User Isolation E2E Tests
 * 
 * These tests verify that different users cannot see or modify each other's data
 * at the end-to-end level with real API and database interactions.
 */
const { test, expect, setupTest, createTestEvent, generateRealisticTestDistance } = require('./helpers/common');
const { cleanupAllTestData } = require('./helpers/cleanup');

test.describe('User Isolation - Multi-User Scenarios', () => {
    // Constants for day offsets to improve readability
    const TODAY = 0;
    const TOMORROW = 1;
    const ONE_WEEK = 7;
    
    test('Different users should see only their own progress entries', async ({ browser }) => {
        // Create two different browser contexts for two users
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();
        
        // Generate unique usernames for this test
        const timestamp = Date.now();
        const username1 = `isolation_test_user1_${timestamp}`;
        const username2 = `isolation_test_user2_${timestamp}`;
        
        const authToken1 = `TEST_MOCK_TOKEN_${username1}`;
        const authToken2 = `TEST_MOCK_TOKEN_${username2}`;
        
        try {
            // Setup both users and cleanup their data
            await setupTest({ page: page1, authToken: authToken1 });
            await setupTest({ page: page2, authToken: authToken2 });
            
            // User 1 creates a progress entry
            const user1Distance = generateRealisticTestDistance();
            await createTestEvent(page1, user1Distance);
            
            // User 2 creates a different progress entry for the same date
            const user2Distance = generateRealisticTestDistance();
            await createTestEvent(page2, user2Distance);
            
            // Verify User 1 sees their own distance but not User 2's
            await page1.reload();
            await page1.waitForLoadState('networkidle');
            
            // Check that User 1's distance is visible
            await expect(page1.locator('.event-label', { hasText: `${user1Distance} km` })).toBeVisible({ timeout: 5000 });
            
            // Check that User 2's distance is NOT visible to User 1
            await expect(page1.locator('.event-label', { hasText: `${user2Distance} km` })).not.toBeVisible({ timeout: 2000 });
            
            // Verify User 2 sees their own distance but not User 1's
            await page2.reload();
            await page2.waitForLoadState('networkidle');
            
            // Check that User 2's distance is visible
            await expect(page2.locator('.event-label', { hasText: `${user2Distance} km` })).toBeVisible({ timeout: 5000 });
            
            // Check that User 1's distance is NOT visible to User 2
            await expect(page2.locator('.event-label', { hasText: `${user1Distance} km` })).not.toBeVisible({ timeout: 2000 });
            
        } finally {
            // Cleanup both users' data
            await cleanupAllTestData('http://localhost:8787', authToken1);
            await cleanupAllTestData('http://localhost:8787', authToken2);
            
            await page1.close();
            await page2.close();
            await context1.close();
            await context2.close();
        }
    });
    
    test('Different users should have separate total distances', async ({ browser }) => {
        // Create two different browser contexts for two users
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();
        
        // Generate unique usernames for this test
        const timestamp = Date.now();
        const username1 = `isolation_totals_user1_${timestamp}`;
        const username2 = `isolation_totals_user2_${timestamp}`;
        
        const authToken1 = `TEST_MOCK_TOKEN_${username1}`;
        const authToken2 = `TEST_MOCK_TOKEN_${username2}`;
        
        try {
            // Setup both users and cleanup their data
            await setupTest({ page: page1, authToken: authToken1 });
            await setupTest({ page: page2, authToken: authToken2 });
            
            // User 1 adds multiple entries
            const user1Distance1 = 5.5;
            const user1Distance2 = 3.2;
            
            // Create date info for today
            const todayDate = new Date();
            todayDate.setDate(todayDate.getDate() + TODAY);
            const todayDateInfo = {
                date: todayDate.toISOString().split('T')[0],
                day: todayDate.getDate(),
                month: todayDate.getMonth(),
                year: todayDate.getFullYear()
            };
            
            // Create date info for tomorrow
            const tomorrowDate = new Date();
            tomorrowDate.setDate(tomorrowDate.getDate() + TOMORROW);
            const tomorrowDateInfo = {
                date: tomorrowDate.toISOString().split('T')[0],
                day: tomorrowDate.getDate(),
                month: tomorrowDate.getMonth(),
                year: tomorrowDate.getFullYear()
            };
            
            await createTestEvent(page1, user1Distance1, todayDateInfo);
            await page1.waitForLoadState('networkidle'); // Wait for first event to be saved
            await createTestEvent(page1, user1Distance2, tomorrowDateInfo);
            
            // User 2 adds a different set of entries
            const user2Distance1 = 10.0;
            const user2Distance2 = 7.5;
            await createTestEvent(page2, user2Distance1, todayDateInfo);
            await page2.waitForLoadState('networkidle'); // Wait for first event to be saved
            await createTestEvent(page2, user2Distance2, tomorrowDateInfo);
            
            // Reload and wait for totals to update
            await page1.reload();
            await page1.waitForLoadState('networkidle');
            await page1.locator('#total-distance-value').waitFor({ state: 'visible', timeout: 5000 });
            
            await page2.reload();
            await page2.waitForLoadState('networkidle');
            await page2.locator('#total-distance-value').waitFor({ state: 'visible', timeout: 5000 });
            
            // User 1's total should be 8.7 km (5.5 + 3.2)
            const user1Total = await page1.locator('#total-distance-value').textContent();
            expect(user1Total).toContain('8.7');
            
            // User 2's total should be 17.5 km (10.0 + 7.5)
            const user2Total = await page2.locator('#total-distance-value').textContent();
            expect(user2Total).toContain('17.5');
            
        } finally {
            // Cleanup both users' data
            await cleanupAllTestData('http://localhost:8787', authToken1);
            await cleanupAllTestData('http://localhost:8787', authToken2);
            
            await page1.close();
            await page2.close();
            await context1.close();
            await context2.close();
        }
    });
    
    test("Users cannot modify each other's progress entries", async ({ browser }) => {
        // Create two different browser contexts for two users
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();
        
        // Generate unique usernames for this test
        const timestamp = Date.now();
        const username1 = `isolation_modify_user1_${timestamp}`;
        const username2 = `isolation_modify_user2_${timestamp}`;
        
        const authToken1 = `TEST_MOCK_TOKEN_${username1}`;
        const authToken2 = `TEST_MOCK_TOKEN_${username2}`;
        
        try {
            // Setup both users and cleanup their data
            await setupTest({ page: page1, authToken: authToken1 });
            await setupTest({ page: page2, authToken: authToken2 });
            
            // User 1 creates a progress entry
            const originalDistance = 5.5;
            const testDate = new Date();
            testDate.setDate(testDate.getDate() + ONE_WEEK);
            const dateString = testDate.toISOString().split('T')[0];
            const nextWeekDateInfo = {
                date: dateString,
                day: testDate.getDate(),
                month: testDate.getMonth(),
                year: testDate.getFullYear()
            };
            
            await createTestEvent(page1, originalDistance, nextWeekDateInfo);
            await page1.waitForLoadState('networkidle');
            
            // User 2 attempts to modify User 1's entry via API
            // (Direct API call since UI doesn't show other users' data)
            const response = await context2.request.put('http://localhost:8787/api/calendar-progress', {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken2}`
                },
                data: JSON.stringify({
                    start: dateString,
                    title: '99.9'
                })
            });
            
            // Should return 404 (not found) because User 2 doesn't have an entry for that date
            expect(response.status()).toBe(404);
            
            // Verify User 1's entry is unchanged
            await page1.reload();
            await page1.waitForLoadState('networkidle');
            await expect(page1.locator('.event-label', { hasText: `${originalDistance} km` })).toBeVisible({ timeout: 5000 });
            
        } finally {
            // Cleanup both users' data
            await cleanupAllTestData('http://localhost:8787', authToken1);
            await cleanupAllTestData('http://localhost:8787', authToken2);
            
            await page1.close();
            await page2.close();
            await context1.close();
            await context2.close();
        }
    });
    
    test('Two users can have entries on the same date without conflicts', async ({ browser }) => {
        // Create two different browser contexts for two users
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();
        
        // Generate unique usernames for this test
        const timestamp = Date.now();
        const username1 = `isolation_samedate_user1_${timestamp}`;
        const username2 = `isolation_samedate_user2_${timestamp}`;
        
        const authToken1 = `TEST_MOCK_TOKEN_${username1}`;
        const authToken2 = `TEST_MOCK_TOKEN_${username2}`;
        
        try {
            // Setup both users and cleanup their data
            await setupTest({ page: page1, authToken: authToken1 });
            await setupTest({ page: page2, authToken: authToken2 });
            
            // Both users create entries for the same date (7 days from now)
            const user1Distance = 8.5;
            const user2Distance = 12.3;
            
            // Create a shared dateInfo object for a date ONE_WEEK days from now
            const nextWeekDate = new Date();
            nextWeekDate.setDate(nextWeekDate.getDate() + ONE_WEEK);
            const nextWeekDateInfo = {
                date: nextWeekDate.toISOString().split('T')[0],
                day: nextWeekDate.getDate(),
                month: nextWeekDate.getMonth(),
                year: nextWeekDate.getFullYear()
            };
            
            await createTestEvent(page1, user1Distance, nextWeekDateInfo);
            await page1.waitForLoadState('networkidle');
            
            await createTestEvent(page2, user2Distance, nextWeekDateInfo);
            await page2.waitForLoadState('networkidle');
            
            // Both should succeed without conflicts
            await page1.reload();
            await page1.waitForLoadState('networkidle');
            await expect(page1.locator('.event-label', { hasText: `${user1Distance} km` })).toBeVisible({ timeout: 5000 });
            
            await page2.reload();
            await page2.waitForLoadState('networkidle');
            await expect(page2.locator('.event-label', { hasText: `${user2Distance} km` })).toBeVisible({ timeout: 5000 });
            
        } finally {
            // Cleanup both users' data
            await cleanupAllTestData('http://localhost:8787', authToken1);
            await cleanupAllTestData('http://localhost:8787', authToken2);
            
            await page1.close();
            await page2.close();
            await context1.close();
            await context2.close();
        }
    });
});
