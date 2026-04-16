const { test: base, expect } = require('@playwright/test');
const { cleanupAllTestData } = require('./cleanup');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const PWA_DISMISS_KEY = 'wtm_pwa_install_dismissed';

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

/**
 * Wait for the app to be fully authenticated and ready.
 * Uses the deterministic `body.authenticated` class set by main.js after session validation.
 */
async function waitForAuthenticated(page) {
  await page.waitForSelector('body.authenticated', { timeout: 15000 });
}

async function seedAuthenticatedSession(page, authToken) {
  const dismissedAt = Date.now();

  await page.addInitScript(({ token, dismissKey, dismissedAtTs }) => {
    try {
      localStorage.setItem('sessionToken', token);
      localStorage.setItem(dismissKey, String(dismissedAtTs));
    } catch (_error) {
      // Ignore storage write failures in unsupported contexts.
    }
  }, {
    token: authToken,
    dismissKey: PWA_DISMISS_KEY,
    dismissedAtTs: dismissedAt,
  });
}

async function syncAuthenticatedSession(page, authToken) {
  const dismissedAt = Date.now();

  await page.evaluate(({ token, dismissKey, dismissedAtTs }) => {
    localStorage.setItem('sessionToken', token);
    localStorage.setItem(dismissKey, String(dismissedAtTs));
  }, {
    token: authToken,
    dismissKey: PWA_DISMISS_KEY,
    dismissedAtTs: dismissedAt,
  });
}

async function navigateAuthenticated(page, authToken, path = '/journey') {
  await seedAuthenticatedSession(page, authToken);
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });

  const currentPath = new URL(page.url()).pathname;
  if (currentPath === '/login') {
    await syncAuthenticatedSession(page, authToken);
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  }

  await waitForAuthenticated(page);
}

async function waitForTotalDistanceLoaded(page) {
  const totalDistance = page.locator('#total-distance-value');
  await totalDistance.waitFor({ state: 'visible', timeout: 10000 });
  await expect(totalDistance).not.toHaveText('Loading...', { timeout: 10000 });
}

async function waitForGoalsLoaded(page) {
  const goalsList = page.locator('#goals-list');
  await goalsList.waitFor({ state: 'attached', timeout: 10000 });

  const loadedState = await page.waitForFunction(() => {
    const goalsList = document.querySelector('#goals-list');
    if (!goalsList) {
      return null;
    }

    const hasGoalCards = goalsList.querySelector(
      '.upcoming-goal, .completed-goal, .all-completed-goal, .goal-header-main, .goal-header-special'
    );
    if (hasGoalCards) {
      return 'loaded';
    }

    const textContent = goalsList.textContent || '';
    const hasErrorState = /Unable to load goals|Goals unavailable|Retry/i.test(textContent);
    if (hasErrorState) {
      return 'error';
    }

    return null;
  }, { timeout: 10000 });

  const state = await loadedState.jsonValue();
  if (state === 'error') {
    console.warn('waitForGoalsLoaded: goals list resolved with an error state instead of goal cards');
  }

  await expect(goalsList).toBeVisible({ timeout: 10000 });
}

async function dismissPwaInstallBanner(page) {
  const dismissButton = page.locator('.pwa-install-banner__dismiss').last();
  const banner = page.locator('.pwa-install-banner').last();

  if (await dismissButton.isVisible({ timeout: 500 }).catch(() => false)) {
    await dismissButton.click({ force: true });
    await expect(banner).toBeHidden({ timeout: 5000 }).catch(() => {});
  }
}

async function closeVisibleModal(page) {
  const modal = page.locator('.modal-overlay').last();
  if (!await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }

  const closeButton = page.locator('#close-goal-btn, #close-modal, #cancel-btn, text=Close').last();
  if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeButton.click({ force: true });
  } else {
    await page.keyboard.press('Escape');
  }

  await page.waitForFunction(() => {
    const overlays = document.querySelectorAll('.modal-overlay');
    return overlays.length === 0 || Array.from(overlays).every((overlay) => {
      const style = window.getComputedStyle(overlay);
      return style.display === 'none' || overlay.style.display === 'none' || !overlay.offsetParent;
    });
  }, { timeout: 5000 }).catch(() => {});
}

async function waitForJourneyReady(page) {
  await waitForAuthenticated(page);
  await page.locator('#eventcalendar').waitFor({ state: 'visible', timeout: 10000 });
  await waitForTotalDistanceLoaded(page);
  await waitForGoalsLoaded(page);
  await dismissPwaInstallBanner(page);
}

/**
 * Wait for a specific Preact island to be hydrated.
 * Islands get `data-hydrated="true"` after Preact renders them.
 */
async function waitForIsland(page, islandName) {
  await page.waitForSelector(`[data-island="${islandName}"][data-hydrated="true"]`);
}

async function setupTest({ page, authToken }) {
    // Ensure clean state for this user
    await cleanupAllTestData(BASE_URL, authToken);

    await navigateAuthenticated(page, authToken, '/journey');
    await waitForJourneyReady(page);
    await closeVisibleModal(page);
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
    // Wait for calendar to be ready
    await page.waitForSelector('.calendar-cell, [data-date], [data-timestamp]').catch(() => {});
    
    // Attempt to find cell by specific date attribute first if provided
    if (dateInfo && typeof dateInfo === 'object' && dateInfo.date) {
        const dateSelector = `[data-date="${dateInfo.date}"]`;
        if (await page.locator(dateSelector).count() > 0 && await page.locator(dateSelector).isVisible()) {
            return page.locator(dateSelector).first();
        }
    }

    try {
      await page.click('#next-btn', { timeout: 2000 });
      
      // Wait for calendar to update after navigation
      await page.waitForSelector('.calendar-cell', { timeout: 5000 });
      
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
        if (await randomCell.isVisible({ timeout: 5000 })) return randomCell;
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
        await overlay.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
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
  seedAuthenticatedSession,
  navigateAuthenticated,
    waitForAuthenticated,
  waitForTotalDistanceLoaded,
  waitForGoalsLoaded,
  waitForJourneyReady,
  dismissPwaInstallBanner,
  closeVisibleModal,
    waitForIsland,
    generateRealisticTestDistance,
    generateLargeTestDistance,
    generateRandomTestDate,
    selectCalendarDate,
    createTestEvent
};