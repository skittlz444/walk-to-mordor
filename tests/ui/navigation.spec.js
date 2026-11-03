const {
  test,
  expect,
  setupTest,
  waitForJourneyReady,
  closeVisibleModal,
  WEEKDAY_LABELS,
  expectWeekdayAlignedCells,
  expectOutOfMonthCellsMarked,
} = require('./helpers/common');

test.describe('Navigation & Responsiveness', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
  });

  test('Application loads and calendar is interactive', async ({ page }) => {
    // Verify application title
    await expect(page).toHaveTitle(/Walk to Mordor/i);
    
    // Check main sections are present
    await expect(page.locator('#eventcalendar')).toBeVisible();
    await expect(page.locator('#goals-section')).toBeVisible();

    // Verify calendar elements
    await expect(page.locator('.custom-calendar')).toBeVisible();
    await expect(page.locator('#calendar-title')).toBeVisible();
    await expect(page.locator('#prev-btn')).toBeVisible();
    await expect(page.locator('#next-btn')).toBeVisible();
  });

  test('Calendar navigation works correctly', async ({ page }) => {
    const titleLocator = page.locator('#calendar-title');
    await expect(titleLocator).toBeVisible();

    // In week view a single step can stay in the same month, so navigate in
    // month view where one step always changes the displayed month.
    // The radio input is display:none; the styled label toggles it.
    await page.click('label[for="month-view"]');
    const titleBefore = (await titleLocator.textContent()).trim();

    // Navigating forward actually changes the displayed month
    await page.click('#next-btn');
    await expect(titleLocator).not.toHaveText(titleBefore, { timeout: 5000 });
    const titleAfterNext = (await titleLocator.textContent()).trim();
    expect(titleAfterNext).not.toBe(titleBefore);

    // Navigating back restores the original month
    await page.click('#prev-btn');
    await expect(titleLocator).toHaveText(titleBefore, { timeout: 5000 });
  });

  test('Calendar weeks are Monday-first in week and month view', async ({ page }) => {
    // Pin the clock so the month-grid shape is deterministic: November 2026 starts on Sunday.
    await page.clock.setFixedTime(new Date('2026-11-03T12:00:00'));
    await page.reload();
    await waitForJourneyReady(page);
    await closeVisibleModal(page);

    // Week view is the default view: headers and cells run Monday through Sunday
    await expect(page.locator('.week-view')).toBeVisible();
    const weekHeaders = page.locator('.week-view .day-header');
    await expect(weekHeaders).toHaveCount(7);
    expect(await weekHeaders.allTextContents()).toEqual(WEEKDAY_LABELS);

    const weekCells = page.locator('.week-view .week-row .calendar-cell[data-date]');
    await expect(weekCells).toHaveCount(7);
    await expectWeekdayAlignedCells(weekCells);

    // Week navigation advances exactly seven days and stays Monday-first
    const firstWeekCell = weekCells.first();
    const dateBefore = await firstWeekCell.getAttribute('data-date');
    expect(dateBefore).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await page.click('#next-btn');
    await expect(firstWeekCell).not.toHaveAttribute('data-date', dateBefore);
    const dateAfter = await firstWeekCell.getAttribute('data-date');
    expect((Date.parse(dateAfter) - Date.parse(dateBefore)) / 86400000).toBe(7);
    await expectWeekdayAlignedCells(weekCells);

    // Going back one week restores the original Monday
    await page.click('#prev-btn');
    await expect(firstWeekCell).toHaveAttribute('data-date', dateBefore);
    await expectWeekdayAlignedCells(weekCells);

    // Month view uses the same headers and places every date under its weekday
    await page.click('label[for="month-view"]');
    await expect(page.locator('.month-view')).toBeVisible();

    const monthHeaders = page.locator('.month-view .day-header');
    await expect(monthHeaders).toHaveCount(7);
    expect(await monthHeaders.allTextContents()).toEqual(WEEKDAY_LABELS);

    const monthCells = page.locator('.month-view .calendar-cell[data-date]');
    await expectWeekdayAlignedCells(monthCells);

    // Neighbouring-month dates stay de-emphasized
    const monthLayout = await expectOutOfMonthCellsMarked(monthCells);
    if ((await monthCells.count()) > 28) {
      expect(monthLayout.outOfMonth).toBeGreaterThan(0);
    }

    // November 2026 starts on Sunday: the grid must be padded from Monday 26 October
    const monthShape = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('.month-view .calendar-cell[data-date]'));
      const inMonth = cells.filter((cell) => !cell.classList.contains('other-month'));
      const [year, month] = inMonth[0].getAttribute('data-date').split('-').map(Number);
      const firstGridDate = new Date(`${cells[0].getAttribute('data-date')}T00:00:00`);
      const firstOfMonth = new Date(year, month - 1, 1);
      return {
        displayedMonth: inMonth[0].getAttribute('data-date').slice(0, 7),
        firstOfMonthWeekday: firstOfMonth.getDay(),
        firstGridWeekday: firstGridDate.getDay(),
        leadingDays: Math.round((firstOfMonth - firstGridDate) / 86400000),
      };
    });
    expect(monthShape.displayedMonth).toBe('2026-11');
    expect(monthShape.firstOfMonthWeekday).toBe(0);
    expect(monthShape.firstGridWeekday).toBe(1);
    expect(monthShape.leadingDays).toBe(6);
  });

  test('Page is responsive on mobile viewport', async ({ page }) => {
    // Set viewport to mobile size (iPhone SE)
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that critical elements are still visible and layout adjusts
    await expect(page.locator('#eventcalendar')).toBeVisible();
    await expect(page.locator('.header-controls')).toBeVisible();
    
    // Check that elements don't overflow horizontally unexpectedly
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('Browser back/forward navigation', async ({ page }) => {
     // Since this is likely a SPA or simple page, we check that back/forward buttons 
     // do not break the application state or cause errors.
     
     // 1. Load page (already done in setup)
     await expect(page.locator('#eventcalendar')).toBeVisible();

     // 2. Refresh page
     await page.reload();
     await expect(page.locator('#eventcalendar')).toBeVisible();
     
     // 3. Navigate away and back
     await page.goto('about:blank');
     await page.goBack();
     await expect(page.locator('#eventcalendar')).toBeVisible();
     
     // Verify we are back on the main page
     await expect(page).toHaveTitle(/Walk to Mordor/i);
  });
});
