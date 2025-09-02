const { test, expect } = require('@playwright/test');

test.describe('Walk to Mordor UI', () => {
  // Clean up any test events after each test
  test.afterEach(async ({ page }) => {
    await page.goto('http://localhost:8787');
    for (const value of ['999999 km', '888888 km', '777777 km']) {
      const eventLabel = page.locator('.mbsc-calendar-label-text', { hasText: value });
      while (await eventLabel.count() > 0) {
        await eventLabel.first().click();
        await page.click('text=Delete');
        await expect(eventLabel).not.toBeVisible();
      }
    }
  });

  test('Calendar renders and is interactable', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await expect(page.locator('#eventcalendar')).toBeVisible();
    await page.waitForTimeout(500); // Wait for calendar to render
    // Go to next week
    await page.click('[aria-label="Next page"]');
    await page.waitForTimeout(300); // Wait for calendar to update
    // Dynamically select the first day of the next week
    const timestamp = await page.evaluate(() => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday
      const firstDayNextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 7);
      return firstDayNextWeek.setHours(0, 0, 0, 0);
    });
    const calendarDayCell = page.locator(`[aria-describedby="mbsc-calendar-day-desc-${timestamp}"]`).first();
    await expect(calendarDayCell).toBeVisible();
    await expect(calendarDayCell).toBeEnabled();
    await calendarDayCell.click();
    await expect(page.locator('#popup')).toBeVisible();
  });

  test('Can add and delete a new event', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForTimeout(500); // Wait for calendar to render
    await page.click('[aria-label="Next page"]');
    await page.waitForTimeout(300); // Wait for calendar to update
    const timestamp = await page.evaluate(() => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const firstDayNextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 7);
      return firstDayNextWeek.setHours(0, 0, 0, 0);
    });
    const calendarDayCell = page.locator(`[aria-describedby="mbsc-calendar-day-desc-${timestamp}"]`).first();
    await expect(calendarDayCell).toBeVisible();
    await expect(calendarDayCell).toBeEnabled();
    await calendarDayCell.click();
    await page.fill('#distance-input', '999999');
    await page.click('text=Add');
    await page.waitForTimeout(100);
    const eventLabel = page.locator('.mbsc-calendar-label-text', { hasText: '999999 km' });
    await expect(eventLabel).toBeVisible();
    // Delete the event just edited
    await expect(calendarDayCell).toBeVisible();
    await expect(calendarDayCell).toBeEnabled();
    await calendarDayCell.click();
    await page.click('text=Delete');
    await expect(eventLabel).not.toBeVisible();
  });

  test('Can edit and delete an event', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForTimeout(500); // Wait for calendar to render
    await page.click('[aria-label="Next page"]');
    await page.waitForTimeout(300); // Wait for calendar to update
    const timestamp = await page.evaluate(() => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const firstDayNextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 7);
      return firstDayNextWeek.setHours(0, 0, 0, 0);
    });
    const calendarDayCell = page.locator(`[aria-describedby="mbsc-calendar-day-desc-${timestamp}"]`).first();
    await expect(calendarDayCell).toBeVisible();
    await expect(calendarDayCell).toBeEnabled();
    await calendarDayCell.click();
    await page.fill('#distance-input', '888888');
    await page.click('text=Add');
    await page.waitForTimeout(100);
    // Edit the event just created
    var eventLabel = page.locator('.mbsc-calendar-label-text', { hasText: '888888 km' });
    await eventLabel.first().click();
    await page.fill('#distance-input', '777777');
    await page.click('text=Save');
    await page.waitForTimeout(100);
    eventLabel = page.locator('.mbsc-calendar-label-text', { hasText: '777777 km' });
    await expect(eventLabel).toContainText('777777 km');
    // Delete the event just edited
    await eventLabel.first().click();
    await page.click('text=Delete');
    await expect(eventLabel).not.toBeVisible();
  });

  test('Goals section renders and controls work', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await expect(page.locator('#goals-list')).toBeVisible();
    // Collapse/expand completed goals
    await page.click('#toggle-completed-visibility');
    await expect(page.locator('#completed-goals-wrapper')).toBeHidden();
    await page.click('#toggle-completed-visibility');
    await expect(page.locator('#completed-goals-wrapper')).toBeVisible();
    // Show all completed
    await page.click('#toggle-completed');
    await expect(page.locator('#all-completed-goals')).toBeVisible();
    await page.click('#toggle-completed');
    await expect(page.locator('#completed-goals')).toBeVisible();
  });

  test('UI is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone size
    await page.goto('http://localhost:8787');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('#eventcalendar')).toBeVisible();
    await expect(page.locator('#goals-list')).toBeVisible();
  });
});
