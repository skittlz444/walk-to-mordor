// @ts-check
/**
 * User Isolation E2E Tests
 * 
 * These tests verify that different users cannot see or modify each other's data
 * at the end-to-end level with real API and database interactions.
 */
const { test, expect, createTestEvent, generateRealisticTestDistance } = require('./helpers/common');
const { cleanupAllTestData } = require('./helpers/cleanup');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

async function getCalendarProgress(context, authToken) {
    const response = await context.request.get(`${BASE_URL}/api/calendar-progress`, {
        headers: {
            Authorization: `Bearer ${authToken}`
        }
    });

    expect(response.status()).toBe(200);
    return response.json();
}

// Helper to create authenticated context with improved performance
async function createAuthenticatedContext(browser, username) {
    const authToken = `TEST_MOCK_TOKEN_${username}`;
    // Clean up data before creating context/page to ensure clean state
    await cleanupAllTestData(BASE_URL, authToken);
    
    const context = await browser.newContext({
         storageState: {
            cookies: [],
            origins: [{
                origin: BASE_URL,
                localStorage: [{ name: 'sessionToken', value: authToken }]
            }]
         }
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/`);
    
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
            const user1Event = await createTestEvent(page1, user1Distance);
            
            // User 2 creates a different progress entry for the same date
            const user2Distance = 20;
            const user2Event = await createTestEvent(page2, user2Distance);
            
            // Verify User 1 sees their own distance but not User 2's
            await page1.reload();
            await page1.waitForLoadState('networkidle');
            
            await expect(page1.locator('#total-distance-value')).toContainText(`${user1Distance}`);

            const user1Progress = await getCalendarProgress(context1, authToken1);
            const user1Titles = user1Progress.map((entry) => Number(entry.title));
            expect(user1Titles).toContain(user1Distance);
            expect(user1Titles).not.toContain(user2Distance);
            expect(user1Progress.some((entry) => entry.start === user1Event.dateInfo.date)).toBe(true);
            
            // Verify User 2 sees their own distance but not User 1's
            await page2.reload();
            await page2.waitForLoadState('networkidle');
            
            await expect(page2.locator('#total-distance-value')).toContainText(`${user2Distance}`);

            const user2Progress = await getCalendarProgress(context2, authToken2);
            const user2Titles = user2Progress.map((entry) => Number(entry.title));
            expect(user2Titles).toContain(user2Distance);
            expect(user2Titles).not.toContain(user1Distance);
            expect(user2Progress.some((entry) => entry.start === user2Event.dateInfo.date)).toBe(true);
            
        } finally {
            // Cleanup both users' data
            await cleanupAllTestData(BASE_URL, authToken1);
            await cleanupAllTestData(BASE_URL, authToken2);
            
            await page1.close();
            await page2.close();
            await context1.close();
            await context2.close();
        }
    });
    
    test('Different users should have separate total distances', async ({ browser }) => {
        test.setTimeout(120000);
        
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
            
            const createProgress = async (context, authToken, date, distance) => {
                const response = await context.request.post(`${BASE_URL}/api/calendar-progress`, {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authToken}`
                    },
                    data: JSON.stringify({
                        start: date,
                        title: String(distance)
                    })
                });

                expect(response.status()).toBeGreaterThanOrEqual(200);
                expect(response.status()).toBeLessThan(400);
            };

            await createProgress(context1, authToken1, todayDateInfo.date, user1Distance1);
            await createProgress(context1, authToken1, tomorrowDateInfo.date, user1Distance2);
            
            // User 2 adds a different set of entries
            const user2Distance1 = 10.0;
            const user2Distance2 = 7.5;
            
            await createProgress(context2, authToken2, todayDateInfo.date, user2Distance1);
            await createProgress(context2, authToken2, tomorrowDateInfo.date, user2Distance2);
            
            // Reload and wait for totals to update
            await page1.reload();
            await page1.waitForLoadState('networkidle');
            await page1.locator('#total-distance-value').waitFor({ state: 'visible', timeout: 5000 });
            await expect(page1.locator('#total-distance-value')).not.toHaveText('Loading...');
            
            await page2.reload();
            await page2.waitForLoadState('networkidle');
            await page2.locator('#total-distance-value').waitFor({ state: 'visible', timeout: 5000 });
            await expect(page2.locator('#total-distance-value')).not.toHaveText('Loading...');
            
            // User 1's total should be 8.7 km (5.5 + 3.2)
            const user1Total = await page1.locator('#total-distance-value').textContent();
            expect(user1Total).toContain('8.7');
            
            // User 2's total should be 17.5 km (10.0 + 7.5)
            const user2Total = await page2.locator('#total-distance-value').textContent();
            expect(user2Total).toContain('17.5');
            
        } finally {
            // Cleanup both users' data
            await cleanupAllTestData(BASE_URL, authToken1);
            await cleanupAllTestData(BASE_URL, authToken2);
            
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

            await expect(page1.locator('#total-distance-value')).toContainText(`${originalDistance}`);

            const user1Progress = await getCalendarProgress(context1, authToken1);
            const entryForDate = user1Progress.find((entry) => entry.start === dateString);
            expect(entryForDate).toBeTruthy();
            expect(Number(entryForDate.title)).toBe(originalDistance);

            const user2Progress = await getCalendarProgress(context2, authToken2);
            expect(user2Progress.some((entry) => entry.start === dateString)).toBe(false);
            
        } finally {
            // Cleanup both users' data
            await cleanupAllTestData(BASE_URL, authToken1);
            await cleanupAllTestData(BASE_URL, authToken2);
            
            await page1.close();
            await page2.close();
            await context1.close();
            await context2.close();
        }
    });
    
    test('Two users can have entries on the same date without conflicts', async ({ browser }) => {
        test.setTimeout(60000);

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
            await expect(page1.locator('#total-distance-value')).toContainText(`${user1Distance}`);

            const user1Progress = await getCalendarProgress(context1, authToken1);
            const user1Entry = user1Progress.find((entry) => entry.start === nextWeekDateInfo.date);
            expect(user1Entry).toBeTruthy();
            expect(Number(user1Entry.title)).toBe(user1Distance);
            
            await page2.reload();
            await page2.waitForLoadState('networkidle');
            await expect(page2.locator('#total-distance-value')).toContainText(`${user2Distance}`);

            const user2Progress = await getCalendarProgress(context2, authToken2);
            const user2Entry = user2Progress.find((entry) => entry.start === nextWeekDateInfo.date);
            expect(user2Entry).toBeTruthy();
            expect(Number(user2Entry.title)).toBe(user2Distance);
            
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
