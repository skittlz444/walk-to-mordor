const {
  test,
  expect,
  setupTest,
  createTestEvent,
  generateRandomTestDate,
  dismissBadgeAwardModal,
} = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

/**
 * UI edit/delete coverage for walking events, restored after
 * tests/ui/progress.spec.js was removed in the test cleanup.
 *
 * Flow: click an event label (.event-label) on the calendar -> the distance
 * modal opens in edit mode (isEdit=true) with #distance-input prefilled and
 * both #save-btn and #delete-btn present -> actions go through
 * handleSaveDistance / handleDeleteDistance in public/js/progress.js.
 */
test.describe('Walk Edit & Delete', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
  });

  async function getProgressEntries(request, authToken) {
    const res = await request.get(`${BASE_URL}/api/calendar-progress`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.ok(), `calendar-progress fetch failed: ${res.status()} ${await res.text()}`).toBeTruthy();
    return res.json();
  }

  /**
   * Logging a walk from the UI earns a badge, so the award modal opens in place
   * over the calendar; a goal congratulations modal can follow ~500 ms later and
   * render on top. Close the goal modal first (it would intercept every click)
   * and the award modal last, so the edit/delete controls stay clickable.
   *
   * The goal click is spelled out rather than delegating to closeVisibleModal,
   * which waits for every overlay to disappear - the award modal keeps it
   * pending until it is dismissed separately.
   */
  async function dismissSaveCelebrations(page) {
    const award = page.locator('.badge-award-overlay');
    const goal = page.locator('.modal-overlay:not(.badge-award-overlay)').last();

    // The award modal opens a moment after the save.
    await award.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    // A goal congratulations modal can follow shortly after and sit on top.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await goal.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
      if (!await goal.isVisible()) break;
      await goal.locator('#close-goal-btn').click();
      await goal.waitFor({ state: 'detached', timeout: 5000 });
    }

    // Closing the goal modal can release a deferred award modal.
    await dismissBadgeAwardModal(page);
  }

  test('delete removes the event for that date', async ({ page, authToken }) => {
    const distance = 7.5;
    const { dateInfo } = await createTestEvent(page, distance);
    await dismissSaveCelebrations(page);

    // The event must exist before we delete it.
    const before = await getProgressEntries(page.request, authToken);
    const created = before.find((e) => e.start === dateInfo.date);
    expect(created, `event for ${dateInfo.date} not found after create: ${JSON.stringify(before)}`).toBeTruthy();

    // Click the event label for that date (calendar cell click handler opens
    // the distance modal in edit mode).
    const cell = page.locator(`.calendar-cell[data-date="${dateInfo.date}"]`).first();
    await expect(cell).toBeVisible({ timeout: 10000 });
    await cell.locator('.event-label').first().click();

    // Edit modal opens with the distance prefilled.
    await page.waitForSelector('#distance-input', { timeout: 10000 });
    await expect(page.locator('#distance-input')).toHaveValue(String(distance));

    await page.locator('#delete-btn').click();

    // The modal closes and the entry is gone via the API.
    await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 10000 });
    await expect
      .poll(async () => {
        const entries = await getProgressEntries(page.request, authToken);
        return entries.filter((e) => e.start === dateInfo.date).length;
      }, { timeout: 10000, message: `event for ${dateInfo.date} should be deleted` })
      .toBe(0);

    // And the event label is gone from the calendar too.
    await expect(page.locator(`.calendar-cell[data-date="${dateInfo.date}"] .event-label`)).toHaveCount(0);
  });

  test('edit saves the new distance for that date', async ({ page, authToken }) => {
    const initialDistance = 7.5;
    const newDistance = 9.25;
    const { dateInfo } = await createTestEvent(page, initialDistance);
    await dismissSaveCelebrations(page);

    // Open the event for that date in edit mode.
    const cell = page.locator(`.calendar-cell[data-date="${dateInfo.date}"]`).first();
    await expect(cell).toBeVisible({ timeout: 10000 });
    await cell.locator('.event-label').first().click();

    await page.waitForSelector('#distance-input', { timeout: 10000 });
    await expect(page.locator('#distance-input')).toHaveValue(String(initialDistance));

    // Change the distance and save.
    await page.locator('#distance-input').fill(String(newDistance));
    await page.locator('#save-btn').click();

    // The edit is another successful save, so the award modal may re-open;
    // close it before asserting that no dialog is left behind.
    await dismissSaveCelebrations(page);

    // The modal closes and the API reflects the new distance.
    await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 10000 });
    await expect
      .poll(async () => {
        const entries = await getProgressEntries(page.request, authToken);
        return entries.filter((e) => e.start === dateInfo.date).map((e) => String(e.title));
      }, { timeout: 10000, message: `event for ${dateInfo.date} should have the edited distance` })
      .toContain(String(newDistance));
  });
});
