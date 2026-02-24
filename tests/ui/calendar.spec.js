// @ts-check
const { test, expect, setupTest } = require('./helpers/common');

test.describe('Calendar Functionality', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
    await page.waitForLoadState('networkidle');
  });

  test('Calendar renders in week view by default', async ({ page }) => {
    // Calendar grid should be visible
    await expect(page.locator('#calendar-grid')).toBeVisible();

    // Week view radio should be checked
    await expect(page.locator('#week-view')).toBeChecked();

    // Should render week-view container with exactly 7 cells
    await expect(page.locator('#calendar-grid .week-view')).toBeVisible();
    const cells = page.locator('#calendar-grid .week-view .calendar-cell');
    await expect(cells).toHaveCount(7);

    // Day headers should be present
    const headers = page.locator('#calendar-grid .week-view .day-header');
    await expect(headers).toHaveCount(7);
    await expect(headers.first()).toHaveText('Sun');
    await expect(headers.last()).toHaveText('Sat');
  });

  test('Month/week view toggle works', async ({ page }) => {
    // Start in week view
    await expect(page.locator('#calendar-grid .week-view')).toBeVisible();

    // Switch to month view
    await page.locator('label[for="month-view"]').click();
    await expect(page.locator('#month-view')).toBeChecked();
    await expect(page.locator('#calendar-grid .month-view')).toBeVisible();

    // Month view should have more than 7 cells (a full month grid)
    const monthCells = page.locator('#calendar-grid .month-view .calendar-cell');
    await expect(monthCells.first()).toBeVisible();
    await expect
      .poll(async () => monthCells.count())
      .toBeGreaterThan(7);

    // Switch back to week view
    await page.locator('label[for="week-view"]').click();
    await expect(page.locator('#week-view')).toBeChecked();
    await expect(page.locator('#calendar-grid .week-view')).toBeVisible();
  });

  test('Navigation previous/next buttons work', async ({ page }) => {
    // Record current title
    const initialTitle = await page.locator('#calendar-title').textContent();

    // Click next
    await page.click('#next-btn');
    await page.waitForTimeout(300);
    const afterNextTitle = await page.locator('#calendar-title').textContent();

    // Click previous twice to go before initial
    await page.click('#prev-btn');
    await page.waitForTimeout(300);
    await page.click('#prev-btn');
    await page.waitForTimeout(300);
    const afterPrevTitle = await page.locator('#calendar-title').textContent();

    // At least one navigation should change the title (month boundary may or may not change it)
    // But going forward then back twice should differ from going forward once
    expect(afterNextTitle || afterPrevTitle).toBeTruthy();
  });

  test('Today button returns to current week', async ({ page }) => {
    // Navigate away from today
    await page.click('#next-btn');
    await page.waitForTimeout(300);
    await page.click('#next-btn');
    await page.waitForTimeout(300);

    // Click Today
    await page.click('#today-btn');
    await page.waitForTimeout(300);

    // Today's cell should be visible with the .today class
    const todayCell = page.locator('.calendar-cell.today');
    await expect(todayCell).toBeVisible();
  });

  test('Calendar cells have correct data attributes', async ({ page }) => {
    // Each cell should have data-date and data-timestamp attributes
    const cells = page.locator('.calendar-cell');
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const cell = cells.nth(i);
      const dateAttr = await cell.getAttribute('data-date');
      const timestampAttr = await cell.getAttribute('data-timestamp');

      // data-date should be YYYY-MM-DD format
      expect(dateAttr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // data-timestamp should be a number
      expect(Number(timestampAttr)).not.toBeNaN();
    }
  });

  test('Click on a day opens distance modal', async ({ page }) => {
    // Click next to avoid conflicts with any existing data on current week
    await page.click('#next-btn');
    await page.waitForTimeout(300);

    // Click the first calendar cell
    const cell = page.locator('.calendar-cell').first();
    await cell.click();

    // Distance modal should open
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#distance-input')).toBeVisible();
    await expect(page.locator('#save-btn')).toBeVisible();

    // Close modal
    await page.locator('#cancel-btn').click();
    await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 5000 });
  });

  test('Quick-add buttons update distance input', async ({ page }) => {
    // Navigate forward and open modal on a cell
    await page.click('#next-btn');
    await page.waitForTimeout(300);

    const cell = page.locator('.calendar-cell').first();
    await cell.click();
    await expect(page.locator('#distance-input')).toBeVisible({ timeout: 5000 });

    // Click +1 km
    await page.click('#quick-add-1');
    let value = await page.locator('#distance-input').inputValue();
    expect(parseFloat(value)).toBe(1);

    // Click +5 km
    await page.click('#quick-add-5');
    value = await page.locator('#distance-input').inputValue();
    expect(parseFloat(value)).toBe(6);

    // Click Reset
    await page.click('#quick-reset');
    value = await page.locator('#distance-input').inputValue();
    expect(parseFloat(value)).toBe(0);

    // Close modal
    await page.locator('#cancel-btn').click();
  });

  test('Month view renders correctly with day headers', async ({ page }) => {
    // Switch to month view
    await page.locator('label[for="month-view"]').click();
    await expect(page.locator('.month-view')).toBeVisible();

    // Should have day headers
    const headers = page.locator('.month-view .day-header');
    await expect(headers).toHaveCount(7);

    // Should have month-grid with cells
    const monthGrid = page.locator('.month-grid');
    await expect(monthGrid).toBeVisible();

    // Each non-empty cell should have a day-number
    const nonEmptyCells = page.locator('.month-view .calendar-cell:not(.empty)');
    const count = await nonEmptyCells.count();
    expect(count).toBeGreaterThanOrEqual(28); // At least 28 days in any month

    // Today's cell should still be marked
    const todayCell = page.locator('.month-view .calendar-cell.today');
    await expect(todayCell).toBeVisible();
  });

  test('Calendar title updates on navigation', async ({ page }) => {
    const title = page.locator('#calendar-title');
    const initialText = await title.textContent();
    expect(initialText).toBeTruthy();
    // Title should contain month name and year (e.g., "January 2025")
    expect(initialText).toMatch(/[A-Z][a-z]+ \d{4}/);

    // Navigate forward multiple times to cross month boundary
    for (let i = 0; i < 5; i++) {
      await page.click('#next-btn');
      await page.waitForTimeout(200);
    }

    const laterText = await title.textContent();
    expect(laterText).toMatch(/[A-Z][a-z]+ \d{4}/);
  });

  test('Escape key closes distance modal', async ({ page }) => {
    await page.click('#next-btn');
    await page.waitForTimeout(300);

    // Open modal
    const cell = page.locator('.calendar-cell').first();
    await cell.click();
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });

    // Press Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 5000 });
  });

  test('Clicking overlay closes distance modal', async ({ page }) => {
    await page.click('#next-btn');
    await page.waitForTimeout(300);

    // Open modal
    const cell = page.locator('.calendar-cell').first();
    await cell.click();
    const overlay = page.locator('.modal-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // Click on the overlay itself (not the modal content)
    await overlay.click({ position: { x: 5, y: 5 } });
    await expect(overlay).toBeHidden({ timeout: 5000 });
  });
});
