// @ts-check
/**
 * User Isolation E2E Tests
 * 
 * These tests verify that different users cannot see or modify each other's data
 * at the end-to-end level with real API and database interactions.
 */
const { test, expect, createTestEvent, generateRealisticTestDistance } = require('./helpers/common');
const { cleanupAllTestData } = require('./helpers/cleanup');

// Helper to create authenticated context with improved performance
async function createAuthenticatedContext(browser, username) {
    const authToken = `TEST_MOCK_TOKEN_${username}`;
    // Clean up data before creating context/page to ensure clean state
    await cleanupAllTestData('http://localhost:8787', authToken);
    
    const context = await browser.newContext({
         storageState: {
            cookies: [],
            origins: [{
                origin: 'http://localhost:8787',
                localStorage: [{ name: 'sessionToken', value: authToken }]
            }]
         }
    });
    const page = await context.newPage();
    await page.goto('http://localhost:8787/');
    
    // Close existing popups if any (similar to setupTest)
    try {
        const existingPopup = page.locator('.modal-overlay');
        if (await existingPopup.isVisible({ timeout: 1000 })) {
            const closeButton = page.locator('text=Close').last();
            if (await closeButton.isVisible({ timeout: 1000 })) {
                await closeButton.click();
            } else {
                await page.keyboard.press('Escape');
            }
            await expect(existingPopup).toBeHidden({ timeout: 2000 });
        }
    } catch (e) {}
    
    return { context, page, authToken };
}

test.describe('User Isolation - Multi-User Scenarios', () => {
    // Constants for day offsets to improve readability
    const TODAY = 0;
    const TOMORROW = 1;
    const ONE_WEEK = 7;
    
    test('Different users should see only their own progress entries', async ({ browser }) => {
        // Generate unique usernames for this test
        const timestamp = Date.now().toString().substring(6); // Use last 7 digits
        const username1 = `iso_u1_${timestamp}`; // ~14 chars
        const username2 = `iso_u2_${timestamp}`; // ~14 chars
        
        const { context: context1, page: page1, authToken: authToken1 } = await createAuthenticatedContext(browser, username1);
        const { context: context2, page: page2, authToken: authToken2 } = await createAuthenticatedContext(browser, username2);
        
        try {
            // User 1 creates a progress entry
            const user1Distance = 10;
            await createTestEvent(page1, user1Distance);
            
            // User 2 creates a different progress entry for the same date
            const user2Distance = 20;
            await createTestEvent(page2, user2Distance);
            
            // Verify User 1 sees their own distance but not User 2's
            await page1.reload();
            await page1.waitForLoadState('networkidle');
            
            // Navigate to next week to see the event created by createTestEvent
            await page1.click('#next-btn');

            // Check that User 1's distance is visible
            await expect(page1.locator('.event-label', { hasText: `${user1Distance} km` })).toBeVisible({ timeout: 5000 });
            
            // Check that User 2's distance is NOT visible to User 1
            await expect(page1.locator('.event-label', { hasText: `${user2Distance} km` })).not.toBeVisible({ timeout: 2000 });
            
            // Verify User 2 sees their own distance but not User 1's
            await page2.reload();
            await page2.waitForLoadState('networkidle');
            
            // Navigate to next week to see the event created by createTestEvent
            await page2.click('#next-btn');

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
        test.setTimeout(60000); // Increase timeout for multiple user creations
        
        // Generate unique usernames for this test
        const timestamp = Date.now().toString().substring(6);
        const username1 = `iso_tot_u1_${timestamp}`;
        const username2 = `iso_tot_u2_${timestamp}`;
        
        const { context: context1, page: page1, authToken: authToken1 } = await createAuthenticatedContext(browser, username1);
        const { context: context2, page: page2, authToken: authToken2 } = await createAuthenticatedContext(browser, username2);
        
        try {
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
            
            // User 1 adds multiple entries
            const p1Promise1 = page1.waitForResponse(response => response.url().includes('/api/calendar-progress') && response.status() === 200);
            await createTestEvent(page1, user1Distance1, todayDateInfo);
            await p1Promise1;
            
            const p1Promise2 = page1.waitForResponse(response => response.url().includes('/api/calendar-progress') && response.status() === 200);
            await createTestEvent(page1, user1Distance2, tomorrowDateInfo);
            await p1Promise2;
            
            // User 2 adds a different set of entries
            const user2Distance1 = 10.0;
            const user2Distance2 = 7.5;
            
            const p2Promise1 = page2.waitForResponse(response => response.url().includes('/api/calendar-progress') && response.status() === 200);
            await createTestEvent(page2, user2Distance1, todayDateInfo);
            await p2Promise1;
            
            const p2Promise2 = page2.waitForResponse(response => response.url().includes('/api/calendar-progress') && response.status() === 200);
            await createTestEvent(page2, user2Distance2, tomorrowDateInfo);
            await p2Promise2;
            
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
        // Generate unique usernames for this test
        const timestamp = Date.now().toString().substring(6);
        const username1 = `iso_mod_u1_${timestamp}`;
        const username2 = `iso_mod_u2_${timestamp}`;
        
        const { context: context1, page: page1, authToken: authToken1 } = await createAuthenticatedContext(browser, username1);
        const { context: context2, page: page2, authToken: authToken2 } = await createAuthenticatedContext(browser, username2);
        
        try {
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
            
            // Navigate to the week where the event is
            await page1.click('#next-btn');
            
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
        // Generate unique usernames for this test
        const timestamp = Date.now().toString().substring(6);
        const username1 = `iso_sam_u1_${timestamp}`;
        const username2 = `iso_sam_u2_${timestamp}`;
        
        const { context: context1, page: page1, authToken: authToken1 } = await createAuthenticatedContext(browser, username1);
        const { context: context2, page: page2, authToken: authToken2 } = await createAuthenticatedContext(browser, username2);
        
        try {
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
            
            // Navigate to next week
            await page1.click('#next-btn');

            await expect(page1.locator('.event-label', { hasText: `${user1Distance} km` })).toBeVisible({ timeout: 5000 });
            
            await page2.reload();
            await page2.waitForLoadState('networkidle');

            // Navigate to next week
            await page2.click('#next-btn');
            
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
