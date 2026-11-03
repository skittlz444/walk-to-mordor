/**
 * Map Walk Logging Integration Tests
 *
 * Tests for Story 2.8 - Map Walk Logging
 * Verifies the walk logging FAB, calendar sheet, and distance modal integration on the map page.
 */
const {
  test,
  expect,
  WEEKDAY_LABELS,
  expectWeekdayAlignedCells,
  expectOutOfMonthCellsMarked,
} = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

/**
 * Wait for the map page to be fully ready, including FAB hydration.
 * The loading overlay hiding does NOT guarantee the FAB is rendered,
 * so we wait for both conditions sequentially.
 */
async function waitForMapReady(page) {
  await page.waitForSelector('[data-island="MapIsland"][data-hydrated="true"]');
  await page.waitForSelector('.map-walk-button', { state: 'visible' });
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
      await expect(calendarSheet).toBeVisible();
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

    test('calendar sheet is dismissible via close button', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      await page.locator('.map-walk-button').click();
      await expect(page.locator('#map-calendar-sheet')).toBeVisible();

      // Click close button
      await page.locator('#sheet-close-btn').click();
      await expect(page.locator('#map-calendar-sheet')).toBeHidden();
    });

    test('calendar sheet is dismissible via ESC key',async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      await page.locator('.map-walk-button').click();
      await expect(page.locator('#map-calendar-sheet')).toBeVisible();

      // Focus inside the sheet first to ensure ESC is handled
      await page.locator('#sheet-close-btn').focus();
      await expect(page.locator('#sheet-close-btn')).toBeFocused();

      // Press ESC
      await page.keyboard.press('Escape');
      await expect(page.locator('#map-calendar-sheet')).toBeHidden();
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

    test('month view renders as a grid with week rows, not a vertical list', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      await page.locator('.map-walk-button').click();
      await expect(page.locator('#map-calendar-sheet')).toBeVisible();

      // Switch to month view via the visible label so Playwright uses actionability checks
      await page.locator('label[for="sheet-month-view"]').click();
      await expect(page.locator('#map-calendar-sheet')).toBeVisible();

      // Month view should use week-row divs for grid layout
      const weekRows = page.locator('#map-calendar-sheet .week-row');
      await expect(weekRows.first()).toBeVisible();
      const rowCount = await weekRows.count();
      expect(rowCount).toBeGreaterThanOrEqual(4);

      // Close button should be within the viewport (not pushed off-screen)
      const closeButton = page.locator('#sheet-close-btn');
      await expect(closeButton).toBeInViewport();

      // Calendar sheet should be closeable
      await closeButton.click();
      await expect(page.locator('#map-calendar-sheet')).toBeHidden();
    });

    test('calendar sheet weeks are Monday-first in week and month view', async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      await page.locator('.map-walk-button').click();
      const sheet = page.locator('#map-calendar-sheet');
      await expect(sheet).toBeVisible();

      // Week view headers run Monday through Sunday and every date sits in its weekday column
      const weekHeaders = sheet.locator('.week-view .day-header');
      await expect(weekHeaders).toHaveCount(7);
      expect(await weekHeaders.allTextContents()).toEqual(WEEKDAY_LABELS);

      const weekCells = sheet.locator('.week-view .week-row .calendar-cell[data-date]');
      await expect(weekCells).toHaveCount(7);
      await expectWeekdayAlignedCells(weekCells);

      // Sheet week navigation also advances exactly seven days
      const firstSheetCell = weekCells.first();
      const dateBefore = await firstSheetCell.getAttribute('data-date');
      expect(dateBefore).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      await page.locator('#sheet-next-btn').click();
      await expect(firstSheetCell).not.toHaveAttribute('data-date', dateBefore);
      const dateAfter = await firstSheetCell.getAttribute('data-date');
      expect((Date.parse(dateAfter) - Date.parse(dateBefore)) / 86400000).toBe(7);
      await expectWeekdayAlignedCells(weekCells);

      // Going back one week restores the original Monday
      await page.locator('#sheet-prev-btn').click();
      await expect(firstSheetCell).toHaveAttribute('data-date', dateBefore);
      await expectWeekdayAlignedCells(weekCells);

      // Month view uses the same headers, alignment, and neighbouring-month styling
      await page.locator('label[for="sheet-month-view"]').click();
      await expect(sheet.locator('.month-view')).toBeVisible();

      const monthHeaders = sheet.locator('.month-view .day-header');
      await expect(monthHeaders).toHaveCount(7);
      expect(await monthHeaders.allTextContents()).toEqual(WEEKDAY_LABELS);

      const monthCells = sheet.locator('.month-view .calendar-cell[data-date]');
      await expectWeekdayAlignedCells(monthCells);

      const monthLayout = await expectOutOfMonthCellsMarked(monthCells);
      if ((await monthCells.count()) > 28) {
        expect(monthLayout.outOfMonth).toBeGreaterThan(0);
      }
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
      await expect(modal).toBeVisible();

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
      await expect(page.locator('.modal-overlay')).toBeHidden();
    });

    test('can cancel modal with Cancel button',async ({ page }) => {
      await page.goto(`${BASE_URL}/map`);
      await waitForMapReady(page);

      // Open calendar and click a date
      await page.locator('.map-walk-button').click();
      await page.locator('#map-calendar-sheet .calendar-cell:not(.empty)').first().click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Click Cancel
      await page.locator('#cancel-btn').click();
      await expect(page.locator('.modal-overlay')).toBeHidden();
    });
  });

  test.describe('Walk Entry Submission',() => {
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
      await expect(page.locator('.modal-overlay')).toBeHidden();
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
