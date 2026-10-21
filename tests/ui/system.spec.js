// @ts-check
const { test, expect, setupTest } = require('./helpers/common');
const AxeBuilder = require('@axe-core/playwright').default;

test.describe('System & Network', () => {

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

        // Unknown routes resolve either to the login redirect or to the
        // authenticated in-app shell — never an unstyled error/crash page
        const url = page.url();
        // Positive URL assertion: the SPA fallback keeps the original path,
        // and unauthenticated users are sent to /login — never elsewhere.
        expect(url.includes('/non-existent-page') || url.includes('/login')).toBe(true);
        if (url.includes('/login')) {
            await expect(page.locator('.auth-container')).toBeVisible();
        } else {
            // In-app fallback: the authenticated shell renders (auth class is set async)
            await page.waitForSelector('body.authenticated', { timeout: 10000 });
            await expect(page.locator('header')).toBeVisible();
        }
    });
});
