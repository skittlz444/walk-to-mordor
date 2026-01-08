// @ts-check
const { test, expect, setupTest } = require('./helpers/common');
const AxeBuilder = require('@axe-core/playwright').default;

test.describe('System & Network', () => {
    
    test('API endpoints are accessible', async ({ request, page, authToken }) => {
        // Authenticate first for context
        await setupTest({ page, authToken });
        
        // Check core API endpoints
        const progressResponse = await request.get('/api/calendar-progress?year=2024', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        expect(progressResponse.ok()).toBeTruthy();
        
        const goalsResponse = await request.get('/api/goals', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        expect(goalsResponse.ok()).toBeTruthy();
    });

    test('Page accessibility', async ({ page, authToken }) => {
        await setupTest({ page, authToken });
        
        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
        
        // Ensure no critical violations (basic check)
        // logging violations to console for debugging if any, rather than failing immediately if we want to be soft
        if (accessibilityScanResults.violations.length > 0) {
            console.warn('Accessibility violations found:', accessibilityScanResults.violations.length);
            // Optionally print details: 
            // console.log(JSON.stringify(accessibilityScanResults.violations, null, 2));
        }

        // For now, let's keep it loose as per original test which just checked truthy snapshot
        // But the intent is clearly to pass a11y. 
        // Let's assert no violations for a strict test.
        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('Error handling (404)', async ({ page, authToken }) => {
        await setupTest({ page, authToken });
        
        try {
            await page.goto('/non-existent-page');
        } catch (e) {
            // Firefox sometimes throws NS_BINDING_ABORTED on SPA history manipulation/redirects during load
            // preventing the test from failing if we actually landed on the page
            if (!e.message.includes('NS_BINDING_ABORTED')) {
                throw e;
            }
        }
        
        // SPA might handle this differently, but checking we don't crash
        // Firefox might abort navigation or redirect to root
        const url = page.url();
        expect(url).toMatch(/(\/non-existent-page)|(\/$)/);
        
        // Should show some reliable content even on 404 (e.g. navigation)
        await expect(page.locator('header')).toBeVisible();
    });
});
