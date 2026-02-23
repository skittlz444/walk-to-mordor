// @ts-check
const { test, expect, setupTest, generateRandomTestDate, selectCalendarDate } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

async function assertSharedDistanceModalUi(page) {
  await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
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
    await page.waitForLoadState('networkidle');

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
    await page.waitForSelector('.map-loading-overlay', { state: 'hidden', timeout: 15000 });

    await page.locator('.map-walk-button').click();
    await page.locator('#map-calendar-sheet .calendar-cell:not(.empty)').first().click();

    await assertSharedDistanceModalUi(page);
  });
});
