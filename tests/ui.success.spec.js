const { test, expect } = require('@playwright/test');

test.describe('Walk to Mordor UI - Success Flows', () => {
  // Helper to get timestamp for first day of next week
  async function getNextWeekTimestamp(page) {
    return await page.evaluate(() => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const firstDayNextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 7);
      return firstDayNextWeek.setHours(0, 0, 0, 0);
    });
  }

  // Helper to select calendar cell for next week
  async function selectNextWeekCell(page) {
    await page.click('[aria-label="Next page"]');
    await page.waitForTimeout(300);
    const timestamp = await getNextWeekTimestamp(page);
    const cell = page.locator(`[aria-describedby="mbsc-calendar-day-desc-${timestamp}"]`).first();
    await expect(cell).toBeVisible();
    await expect(cell).toBeEnabled();
    return cell;
  }

  // Clean up any test events after each test
  test.afterEach(async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    
    // Clean up specific test values
    for (const value of ['999999 km', '888888 km', '777777 km']) {
      const eventLabel = page.locator('.mbsc-calendar-label-text', { hasText: value });
      while (await eventLabel.count() > 0) {
        await eventLabel.first().click();
        const deleteButton = page.locator('text=Delete');
        if (await deleteButton.count() > 0) {
          await deleteButton.click();
          await page.waitForTimeout(100);
        }
      }
    }
  });

  test('Application loads successfully', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    
    // Verify the page loads with basic content
    await expect(page).toHaveTitle(/Walk to Mordor/i);
    
    // Verify calendar component loads
    await expect(page.locator('.mbsc-calendar')).toBeVisible();
  });

  test('Calendar renders and is interactable', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#eventcalendar')).toBeVisible();
    await page.waitForTimeout(500);
    const cell = await selectNextWeekCell(page);
    await cell.click();
    await expect(page.locator('#popup')).toBeVisible();
  });

  test('Can add and delete a new event', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    const cell = await selectNextWeekCell(page);
    await cell.click();
    await page.fill('#distance-input', '999999');
    await page.click('text=Add');
    await page.waitForTimeout(100);
    const eventLabel = page.locator('.mbsc-calendar-label-text', { hasText: '999999 km' });
    await expect(eventLabel).toBeVisible();
    await cell.click();
    await page.click('text=Delete');
    await expect(eventLabel).not.toBeVisible();
  });

  test('Can edit and delete an event', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    const cell = await selectNextWeekCell(page);
    await cell.click();
    await page.fill('#distance-input', '888888');
    await page.click('text=Add');
    await page.waitForTimeout(100);
    let eventLabel = page.locator('.mbsc-calendar-label-text', { hasText: '888888 km' });
    await eventLabel.first().click();
    await page.fill('#distance-input', '777777');
    await page.click('text=Save');
    await page.waitForTimeout(100);
    eventLabel = page.locator('.mbsc-calendar-label-text', { hasText: '777777 km' });
    await expect(eventLabel).toBeVisible();
    await eventLabel.first().click();
    await page.click('text=Delete');
    await expect(eventLabel).not.toBeVisible();
  });

  test('Calendar navigation works', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    
    // Verify navigation buttons exist and work
    const nextButton = page.locator('[aria-label="Next page"]');
    const prevButton = page.locator('[aria-label="Previous page"]');
    
    await expect(nextButton).toBeVisible();
    await expect(prevButton).toBeVisible();
    
    // Test navigation
    await nextButton.click();
    await page.waitForTimeout(300);
    await prevButton.click();
    await page.waitForTimeout(300);
    
    // Calendar should still be visible after navigation
    await expect(page.locator('.mbsc-calendar')).toBeVisible();
  });

  test('Page is responsive on mobile', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.mbsc-calendar')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.mbsc-calendar')).toBeVisible();
  });

  test('API endpoints are accessible', async ({ page }) => {
    // Test that the API endpoints return valid responses
    const response = await page.request.get('http://localhost:8787/wtm/api/calendar-progress');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Goals API is accessible', async ({ page }) => {
    const response = await page.request.get('http://localhost:8787/wtm/api/goals');
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
