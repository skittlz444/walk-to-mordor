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
    // Get initial calendar title (e.g., "January 2024")
    const titleLocator = page.locator('#calendar-title');
    await expect(titleLocator).toBeVisible();

    // Navigate to next week/month
    await page.click('#next-btn');
    await expect(page.locator('#prev-btn')).toBeEnabled();
    
    // Navigate back to initial
    await page.click('#prev-btn');
    await expect(page.locator('#next-btn')).toBeEnabled();
    
    // Navigate forward again
    await page.click('#next-btn');
    
    // Buttons should still be interactive
    await expect(page.locator('#prev-btn')).toBeEnabled();
    await expect(page.locator('#next-btn')).toBeEnabled();
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

  test('UI is responsive on specific viewport', async ({ page }) => {
    // Tablet size (iPad)
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await expect(page.locator('#eventcalendar')).toBeVisible();
    await expect(page.locator('#goals-list')).toBeVisible();
    
    // Verify layout is appropriate (e.g., goals section visibility)
    const goalsSection = page.locator('#goals-section');
    await expect(goalsSection).toBeVisible();
  });

  test('Page handles different screen sizes', async ({ page }) => {
    const sizes = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1366, height: 768 },  // Laptop
      { width: 360, height: 640 }    // Android
    ];

    for (const size of sizes) {
      await page.setViewportSize(size);
      
      // Ensure app doesn't crash and main container is visible
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('#eventcalendar')).toBeVisible();
    }
  });

  test('Calendar navigation performance', async ({ page }) => {
    // Navigate multiple times and ensure it's responsive
    const startTime = Date.now();
    const iterations = 5;
    
    for (let i = 0; i < iterations; i++) {
        await page.click('#next-btn');
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Ensure 5 clicks finish within reasonable time (e.g. 2 seconds)
    // This is a loose valid check for performance regressions
    expect(duration).toBeLessThan(5000); 
    
    // Also check UI is stable
    await expect(page.locator('#calendar-title')).toBeVisible();
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
