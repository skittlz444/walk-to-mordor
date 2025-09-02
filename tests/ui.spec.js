const { test, expect } = require('@playwright/test');

test.describe('Walk to Mordor UI', () => {
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
    await page.waitForTimeout(500);
    const cell = await selectNextWeekCell(page);
    await cell.click();
    await expect(page.locator('#popup')).toBeVisible();
  });

  test('Can add and delete a new event', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForTimeout(500);
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
    await page.waitForTimeout(500);
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

  test('Goals section renders and controls work', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await expect(page.locator('#goals-list')).toBeVisible();
    await page.click('#toggle-completed-visibility');
    await expect(page.locator('#completed-goals-wrapper')).toBeHidden();
    await page.click('#toggle-completed-visibility');
    await expect(page.locator('#completed-goals-wrapper')).toBeVisible();
    await page.click('#toggle-completed');
    await expect(page.locator('#all-completed-goals')).toBeVisible();
    await page.click('#toggle-completed');
    await expect(page.locator('#completed-goals')).toBeVisible();
  });

  test('UI is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:8787');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('#eventcalendar')).toBeVisible();
    await expect(page.locator('#goals-list')).toBeVisible();
  });
});
