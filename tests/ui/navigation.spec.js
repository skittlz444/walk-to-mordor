const { test, expect, setupTest } = require('./helpers/common');

test.describe('Navigation & Responsiveness', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
  });

  test('Application loads and calendar is interactive', async ({ page }) => {
    // Verify application title
    await expect(page).toHaveTitle(/Walk to Mordor/i);
    
    // Check main sections are present
    await expect(page.locator('#eventcalendar')).toBeVisible();
    await expect(page.locator('#goals-section')).toBeVisible();

    // Verify calendar elements
    await expect(page.locator('.custom-calendar')).toBeVisible();
    await expect(page.locator('#calendar-title')).toBeVisible();
    await expect(page.locator('#prev-btn')).toBeVisible();
    await expect(page.locator('#next-btn')).toBeVisible();
  });

  test('Calendar navigation works correctly', async ({ page }) => {
    const titleLocator = page.locator('#calendar-title');
    await expect(titleLocator).toBeVisible();

    // In week view a single step can stay in the same month, so navigate in
    // month view where one step always changes the displayed month.
    // The radio input is display:none; the styled label toggles it.
    await page.click('label[for="month-view"]');
    const titleBefore = (await titleLocator.textContent()).trim();

    // Navigating forward actually changes the displayed month
    await page.click('#next-btn');
    await expect(titleLocator).not.toHaveText(titleBefore, { timeout: 5000 });
    const titleAfterNext = (await titleLocator.textContent()).trim();
    expect(titleAfterNext).not.toBe(titleBefore);

    // Navigating back restores the original month
    await page.click('#prev-btn');
    await expect(titleLocator).toHaveText(titleBefore, { timeout: 5000 });
  });

  test('Page is responsive on mobile viewport', async ({ page }) => {
    // Set viewport to mobile size (iPhone SE)
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that critical elements are still visible and layout adjusts
    await expect(page.locator('#eventcalendar')).toBeVisible();
    await expect(page.locator('.header-controls')).toBeVisible();
    
    // Check that elements don't overflow horizontally unexpectedly
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('Browser back/forward navigation', async ({ page }) => {
     // Since this is likely a SPA or simple page, we check that back/forward buttons 
     // do not break the application state or cause errors.
     
     // 1. Load page (already done in setup)
     await expect(page.locator('#eventcalendar')).toBeVisible();

     // 2. Refresh page
     await page.reload();
     await expect(page.locator('#eventcalendar')).toBeVisible();
     
     // 3. Navigate away and back
     await page.goto('about:blank');
     await page.goBack();
     await expect(page.locator('#eventcalendar')).toBeVisible();
     
     // Verify we are back on the main page
     await expect(page).toHaveTitle(/Walk to Mordor/i);
  });
});
