const { test: base, expect } = require('@playwright/test');
const { cleanupAllTestData } = require('./cleanup');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

// Extend test with unique auth token fixture
const test = base.extend({
  authToken: async ({ }, use) => {
    const uniqueId = Math.random().toString(36).substring(7);
    const username = `testuser_${uniqueId}`;
    const token = `TEST_MOCK_TOKEN_${username}`;
    await use(token);
    // Cleanup after test
    await cleanupAllTestData(BASE_URL, token);
  },
});

async function setupTest({ page, authToken }) {
    // Ensure clean state for this user
    await cleanupAllTestData(BASE_URL, authToken);

    await page.goto(`${BASE_URL}/journey`);
    
    // Set mock session token for auth
    await page.evaluate((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
    
    // Navigate back to root to apply auth state
    await page.goto(`${BASE_URL}/journey`);
    
    // Wait for the calendar to be initialized (proof of successful login and app load)
    // This helps avoid race conditions where tests try to interact with elements before the app is ready
    try {
      await page.waitForSelector('#next-btn', { state: 'visible', timeout: 10000 });
    } catch (e) {
      console.log('Setup wait warning: Calendar next button did not appear', e.message);
    }
    
    try {
      // Close any existing popups that might interfere with the next test
      const existingPopup = page.locator('.modal-overlay');
      if (await existingPopup.isVisible({ timeout: 1000 })) {
        const closeButton = page.locator('text=Close').last();
        if (await closeButton.isVisible({ timeout: 1000 })) {
          await closeButton.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await expect(existingPopup).toBeHidden({ timeout: 2000 });
      }
    } catch (e) {
      console.log('Popup cleanup note:', e.message);
    }
}

function generateRealisticTestDistance() {
  return Math.floor(Math.random() * 50) + 1;
}

function generateLargeTestDistance() {
  return Math.floor(Math.random() * 900) + 100;
}

function generateRandomTestDate() {
  const now = new Date();
  const daysToAdd = 7 + Math.floor(Math.random() * 7); // Next week
  const testDate = new Date(now);
  testDate.setDate(testDate.getDate() + daysToAdd);
  
  return {
    date: testDate.toISOString().split('T')[0],
    day: testDate.getDate(),
    month: testDate.getMonth(),
    year: testDate.getFullYear()
  };
}

async function selectCalendarDate(page, dateInfo) {
    // Attempt to find cell by specific date attribute first if provided
    if (dateInfo && typeof dateInfo === 'object' && dateInfo.date) {
        const dateSelector = `[data-date="${dateInfo.date}"]`;
        if (await page.locator(dateSelector).count() > 0 && await page.locator(dateSelector).isVisible()) {
            return page.locator(dateSelector).first();
        }
    }

    try {
      await page.click('#next-btn', { timeout: 2000 });
      await page.waitForTimeout(300);
      
      // If we have a specific date object, try finding it again after navigation
      if (dateInfo && typeof dateInfo === 'object' && dateInfo.date) {
         const dateSelector = `[data-date="${dateInfo.date}"]`;
         if (await page.locator(dateSelector).count() > 0 && await page.locator(dateSelector).isVisible()) {
             return page.locator(dateSelector).first();
         }
      }
      
      const timestamp = await page.evaluate(() => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const firstDayNextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 7);
        return firstDayNextWeek.setHours(0, 0, 0, 0);
      });
      
      const cell = page.locator(`[data-timestamp="${timestamp}"]`).first();
      await expect(cell).toBeVisible({ timeout: 5000 });
      await expect(cell).toBeEnabled({ timeout: 5000 });
      
      return cell;
    } catch (error) {
      const availableCells = page.locator('.calendar-cell');
      const cellCount = await availableCells.count();
      if (cellCount > 0) {
        const randomCell = availableCells.nth(Math.floor(Math.random() * cellCount));
        if (await randomCell.isVisible({ timeout: 2000 })) return randomCell;
      }
      throw new Error(`Could not select any calendar date`);
    }
}

async function createTestEvent(page, distance, dateInfo) {
    const testDistance = distance || generateRealisticTestDistance();
    const testDateInfo = dateInfo || generateRandomTestDate();
    
    try {
      const overlay = page.locator('.mbsc-popup-overlay');
      if (await overlay.isVisible({ timeout: 500 })) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    } catch (error) {}
    
    const cell = await selectCalendarDate(page, testDateInfo);
    
    // Get the actual date from the selected cell (may differ from testDateInfo if fallback was used)
    const actualDate = await cell.getAttribute('data-date');
    const actualDateInfo = actualDate ? {
      date: actualDate,
      day: parseInt(actualDate.split('-')[2], 10),
      month: parseInt(actualDate.split('-')[1], 10),
      year: parseInt(actualDate.split('-')[0], 10)
    } : testDateInfo;
    
    try {
      await cell.click({ force: true, timeout: 10000 });
    } catch (error) {
        try { await cell.click({ timeout: 10000 }); } 
        catch (e) { await cell.focus(); await page.keyboard.press('Enter'); }
    }
    
    const distanceInput = page.locator('#distance-input');
    await distanceInput.fill(testDistance.toString());
    
    // Submit form
    const addButton = page.locator('text=Add');
    try {
      await addButton.waitFor({ state: 'visible', timeout: 5000 });
      await addButton.click({ timeout: 10000 });
    } catch (error) {
       // Try alternative selectors
       const alternativeButtons = ['button:has-text("Add")', 'input[type="submit"]', '[type="submit"]', '.submit-btn'];
       let clicked = false;
        for (const s of alternativeButtons) {
            const btn = page.locator(s).first();
            if (await btn.isVisible()) { await btn.click(); clicked=true; break; }
        }
       if (!clicked) await page.keyboard.press('Enter');
    }
    
    // Wait for modal to close (use detached to ensure it's gone)
    try {
        await page.waitForSelector('.modal-overlay', { state: 'detached', timeout: 5000 });
    } catch (e) {
        // Fallback or ignore if already gone
    }
    
    return { distance: testDistance, dateInfo: actualDateInfo };
}

module.exports = {
    test,
    expect,
    setupTest,
    generateRealisticTestDistance,
    generateLargeTestDistance,
    generateRandomTestDate,
    selectCalendarDate,
    createTestEvent
};