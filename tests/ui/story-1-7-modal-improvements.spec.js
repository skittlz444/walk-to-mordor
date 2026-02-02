// @ts-check
const { test, expect, setupTest, generateRandomTestDate, selectCalendarDate } = require('./helpers/common');

/**
 * Story 1.7: UX Polish - Modal & Input Improvements
 * Tests for new quick entry buttons and km suffix display
 */

test.describe('Story 1.7: Modal UX Improvements', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
  });

  test('Modal displays km suffix next to input', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Click on any calendar date to open the modal
    const testDateInfo = generateRandomTestDate();
    const cell = await selectCalendarDate(page, testDateInfo);
    await cell.click({ timeout: 10000 });
    
    // Wait for modal to appear
    await page.waitForSelector('#distance-input', { timeout: 5000 });
    
    // Verify km suffix is visible
    const kmSuffix = page.locator('.km-suffix');
    await expect(kmSuffix).toBeVisible();
    await expect(kmSuffix).toHaveText('km');
  });

  test('Quick entry +1 km button increments distance', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Open modal
    const testDateInfo = generateRandomTestDate();
    const cell = await selectCalendarDate(page, testDateInfo);
    await cell.click({ timeout: 10000 });
    
    // Wait for modal
    const distanceInput = page.locator('#distance-input');
    await distanceInput.waitFor({ state: 'visible', timeout: 5000 });
    
    // Click +1 km button
    const quickAdd1 = page.locator('#quick-add-1');
    await expect(quickAdd1).toBeVisible();
    await expect(quickAdd1).toHaveText('+1 km');
    await quickAdd1.click();
    
    // Verify input was incremented to 1.00
    await expect(distanceInput).toHaveValue('1.00');
    
    // Click again
    await quickAdd1.click();
    
    // Verify input is now 2.00
    await expect(distanceInput).toHaveValue('2.00');
  });

  test('Quick entry +5 km button increments distance', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Open modal
    const testDateInfo = generateRandomTestDate();
    const cell = await selectCalendarDate(page, testDateInfo);
    await cell.click({ timeout: 10000 });
    
    // Wait for modal
    const distanceInput = page.locator('#distance-input');
    await distanceInput.waitFor({ state: 'visible', timeout: 5000 });
    
    // Click +5 km button
    const quickAdd5 = page.locator('#quick-add-5');
    await expect(quickAdd5).toBeVisible();
    await expect(quickAdd5).toHaveText('+5 km');
    await quickAdd5.click();
    
    // Verify input was incremented to 5.00
    await expect(distanceInput).toHaveValue('5.00');
  });

  test('Quick entry buttons work with existing values', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Open modal
    const testDateInfo = generateRandomTestDate();
    const cell = await selectCalendarDate(page, testDateInfo);
    await cell.click({ timeout: 10000 });
    
    // Wait for modal
    const distanceInput = page.locator('#distance-input');
    await distanceInput.waitFor({ state: 'visible', timeout: 5000 });
    
    // Manually enter a value
    await distanceInput.fill('3.5');
    
    // Click +1 km
    await page.locator('#quick-add-1').click();
    await expect(distanceInput).toHaveValue('4.50');
    
    // Click +5 km
    await page.locator('#quick-add-5').click();
    await expect(distanceInput).toHaveValue('9.50');
  });

  test('Modal buttons have proper styling (auth-style buttons)', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Open modal
    const testDateInfo = generateRandomTestDate();
    const cell = await selectCalendarDate(page, testDateInfo);
    await cell.click({ timeout: 10000 });
    
    // Wait for modal
    await page.waitForSelector('#save-btn', { timeout: 5000 });
    
    // Verify primary button (Add/Save) has correct styling
    const saveBtn = page.locator('#save-btn');
    await expect(saveBtn).toHaveClass(/btn-primary/);
    
    // Check computed style for primary button color (should be #0f3460)
    const saveBtnBg = await saveBtn.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // rgb(15, 52, 96) is #0f3460
    expect(saveBtnBg).toBe('rgb(15, 52, 96)');
    
    // Verify secondary button (Cancel) has correct styling
    const cancelBtn = page.locator('#cancel-btn');
    await expect(cancelBtn).toHaveClass(/btn-secondary/);
  });

  test('Modal buttons meet touch target size requirements (44x44 min)', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Open modal
    const testDateInfo = generateRandomTestDate();
    const cell = await selectCalendarDate(page, testDateInfo);
    await cell.click({ timeout: 10000 });
    
    // Wait for modal
    await page.waitForSelector('#save-btn', { timeout: 5000 });
    
    // Check button sizes
    const buttons = [
      page.locator('#save-btn'),
      page.locator('#cancel-btn'),
      page.locator('#quick-add-1'),
      page.locator('#quick-add-5')
    ];
    
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });
});
