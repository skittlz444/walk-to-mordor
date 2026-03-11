/**
 * Map Walk Logging Integration Tests
 *
 * Tests for Story 2.8 - Map Walk Logging
 * Verifies the walk logging FAB, calendar sheet, and distance modal integration on the map page.
 */
const { test, expect } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

/**
 * Wait for the map page to be fully ready, including FAB hydration.
 * The loading overlay hiding does NOT guarantee the FAB is rendered,
 * so we wait for both conditions sequentially.
 */
async function waitForMapReady(page) {
  await page.waitForSelector('.map-loading-overlay', { state: 'hidden', timeout: 15000 });
  await page.waitForSelector('.map-walk-button', { state: 'visible', timeout: 15000 });
}

test.describe('Map Walk Logging (Story 2.8)', () => {
  test.beforeEach(async ({ page, authToken }) => {
    // Set up authentication
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
  });

  test.describe('Walk Logging FAB', () => {
    test('map page shows walk logging FAB button', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);

      await waitForMapReady(page);

      // FAB should be visible
      const fab = page.locator('.map-walk-button');
      await expect(fab).toBeVisible();
    });

    test('FAB has correct accessibility attributes', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      const fab = page.locator('.map-walk-button');
      await expect(fab).toHaveAttribute('aria-label', 'Log a walk');
      await expect(fab).toHaveAttribute('type', 'button');
    });

    test('FAB contains walking icon SVG', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      const svg = page.locator('.map-walk-button svg');
      await expect(svg).toBeVisible();
      await expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  test.describe('Calendar Sheet Integration', () => {
    test('clicking FAB opens calendar sheet', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      // Click the FAB
      const fab = page.locator('.map-walk-button');
      await fab.click();

      // Calendar sheet should appear
      const calendarSheet = page.locator('#map-calendar-sheet');
      await expect(calendarSheet).toBeVisible({ timeout: 5000 });
      await expect(calendarSheet).toHaveClass(/open/);
    });

    test('calendar sheet shows week or month view', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      await page.locator('.map-walk-button').click();
      await expect(page.locator('#map-calendar-sheet')).toBeVisible();

      // Should have calendar cells
      const cells = page.locator('#map-calendar-sheet .calendar-cell:not(.empty)');
      await expect(cells.first()).toBeVisible();
    });

    test('calendar sheet has close button', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      await page.locator('.map-walk-button').click();
      await expect(page.locator('#map-calendar-sheet')).toBeVisible();

      // Close button should be present
      await expect(page.locator('#sheet-close-btn')).toBeVisible();
    });

    test('calendar sheet is dismissible via close button', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      await page.locator('.map-walk-button').click();
      await expect(page.locator('#map-calendar-sheet')).toBeVisible();

      // Click close button
      await page.locator('#sheet-close-btn').click();
      await expect(page.locator('#map-calendar-sheet')).toBeHidden({ timeout: 2000 });
    });

    test('calendar sheet is dismissible via ESC key', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      await page.locator('.map-walk-button').click();
      await expect(page.locator('#map-calendar-sheet')).toBeVisible();

      // Focus inside the sheet first to ensure ESC is handled
      await page.locator('#sheet-close-btn').focus();
      await expect(page.locator('#sheet-close-btn')).toBeFocused();

      // Press ESC
      await page.keyboard.press('Escape');
      await expect(page.locator('#map-calendar-sheet')).toBeHidden({ timeout: 3000 });
    });

    test('calendar sheet has view toggle buttons', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      await page.locator('.map-walk-button').click();
      await expect(page.locator('#map-calendar-sheet')).toBeVisible();

      // View toggle labels should be visible (inputs are visually hidden)
      await expect(page.locator('label[for="sheet-week-view"]')).toBeVisible();
      await expect(page.locator('label[for="sheet-month-view"]')).toBeVisible();
    });
  });

  test.describe('Distance Modal Integration', () => {
    test('clicking calendar date opens distance modal', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      // Open calendar sheet
      await page.locator('.map-walk-button').click();
      await expect(page.locator('#map-calendar-sheet')).toBeVisible();

      // Click a calendar cell
      const cell = page.locator('#map-calendar-sheet .calendar-cell:not(.empty)').first();
      await cell.click();

      // Distance modal should appear
      const modal = page.locator('.modal-overlay');
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Should have distance input
      const distanceInput = page.locator('#distance-input');
      await expect(distanceInput).toBeVisible();
    });

    test('distance modal has quick entry buttons', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      // Open calendar and click a date
      await page.locator('.map-walk-button').click();
      await page.locator('#map-calendar-sheet .calendar-cell:not(.empty)').first().click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Quick entry buttons should be present
      await expect(page.locator('#quick-add-1')).toBeVisible();
      await expect(page.locator('#quick-add-5')).toBeVisible();
      await expect(page.locator('#quick-reset')).toBeVisible();
    });

    test('distance modal is dismissible via ESC', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      // Open calendar and click a date
      await page.locator('.map-walk-button').click();
      await page.locator('#map-calendar-sheet .calendar-cell:not(.empty)').first().click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Close with ESC
      await page.keyboard.press('Escape');
      await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 2000 });
    });

    test('can cancel modal with Cancel button', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      // Open calendar and click a date
      await page.locator('.map-walk-button').click();
      await page.locator('#map-calendar-sheet .calendar-cell:not(.empty)').first().click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Click Cancel
      await page.locator('#cancel-btn').click();
      await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 2000 });
    });
  });

  test.describe('Walk Entry Submission', () => {
    test('can enter distance and save', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      // Open calendar and click a date
      await page.locator('.map-walk-button').click();
      await page.locator('#map-calendar-sheet .calendar-cell:not(.empty)').first().click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Enter a distance
      const distanceInput = page.locator('#distance-input');
      await distanceInput.fill('5');

      // Save
      await page.locator('#save-btn').click();

      // Modal should close
      await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 5000 });
    });

    test('quick entry buttons update distance', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      // Open calendar and click a date
      await page.locator('.map-walk-button').click();
      await page.locator('#map-calendar-sheet .calendar-cell:not(.empty)').first().click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      const distanceInput = page.locator('#distance-input');

      // Click +1km button
      await page.locator('#quick-add-1').click();
      await expect(distanceInput).toHaveValue('1.00');

      // Click +5km button
      await page.locator('#quick-add-5').click();
      await expect(distanceInput).toHaveValue('6.00');

      // Reset
      await page.locator('#quick-reset').click();
      await expect(distanceInput).toHaveValue('0.00');

      // Cancel to close
      await page.locator('#cancel-btn').click();
    });
  });
});
