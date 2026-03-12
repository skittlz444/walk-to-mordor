// @ts-check
const { test, expect, setupTest, generateRandomTestDate, selectCalendarDate } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

async function assertSharedDistanceModalUi(page) {
  await expect(page.locator('.modal-overlay')).toBeVisible();
  await expect(page.locator('#distance-input')).toBeVisible();
  await expect(page.locator('.km-suffix')).toHaveText('km');
  await expect(page.locator('#quick-add-1')).toHaveText('+1 km');
  await expect(page.locator('#quick-add-5')).toHaveText('+5 km');
  await expect(page.locator('#quick-reset')).toHaveText('Reset');
  await expect(page.locator('#save-btn')).toHaveText('Add');
  await expect(page.locator('#cancel-btn')).toHaveText('Cancel');
}

test.describe('Shared Distance Modal UI', () => {
  test('journey view uses shared distance modal controls', async ({ page, authToken }) => {
    await setupTest({ page, authToken });

    const testDateInfo = generateRandomTestDate();
    const cell = await selectCalendarDate(page, testDateInfo);
    await cell.click({ timeout: 10000 });

    await assertSharedDistanceModalUi(page);
  });

  test('map view uses shared distance modal controls', async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);

    await page.goto(`${BASE_URL}/map`);
    await page.waitForSelector('body.authenticated', { timeout: 15000 });
    await page.waitForSelector('[data-island="MapIsland"][data-hydrated="true"]');

    // Wait for FAB to be hydrated and visible before clicking
    const fab = page.locator('.map-walk-button');
    await expect(fab).toBeVisible();
    await fab.click();

    // Wait for calendar sheet to open and cells to render
    await expect(page.locator('#map-calendar-sheet')).toBeVisible();
    const cell = page.locator('#map-calendar-sheet .calendar-cell:not(.empty)').first();
    await expect(cell).toBeVisible();
    await cell.click();

    await assertSharedDistanceModalUi(page);
  });
});
