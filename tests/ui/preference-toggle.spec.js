// @ts-check
const { test, expect, setupTest } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

// Helper to properly close popup with Firefox compatibility
async function closePopupRobust(page, closeButton) {
  try {
    await closeButton.click({ timeout: 2000 });
  } catch (e) {
    await closeButton.click({ force: true });
  }

  await page.waitForFunction(() => {
    const popup = document.querySelector('.modal-overlay');
    return !popup || window.getComputedStyle(popup).display === 'none' ||
      popup.style.display === 'none' || !popup.offsetParent;
  }, { timeout: 10000 });

  await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 5000 });
}

async function openProfileFromDrawer(page) {
  await page.click('.menu-icon');
  await page.waitForSelector('body.drawer-open', { timeout: 5000 });
  const profileButton = page.locator('.drawer-profile');
  await expect(profileButton).toBeVisible();
  await expect(profileButton).toBeEnabled();
  await profileButton.click();
  await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.modal-title')).toHaveText('User Profile');
}

/**
 * UI Tests - User Goal Visibility Preference (Story 2.10)
 */
test.describe('User Goal Visibility Preference', () => {
  test.setTimeout(30000);

  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
    await page.waitForSelector('header', { timeout: 10000 });
  });

  test.describe('Profile Modal Toggle', () => {
    test('should display preview milestones toggle in profile modal', async ({ page }) => {
      await openProfileFromDrawer(page);

      // Toggle switch container should be visible (the <input> itself is hidden by toggle-switch CSS)
      const toggleSwitch = page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-switch');
      await expect(toggleSwitch).toBeVisible();

      // Label should be present
      await expect(page.locator('label[for="preview-milestones-toggle"]')).toContainText('Preview all milestones');

      // Default should be checked (unlocked) — .toBeChecked() works on hidden inputs
      const toggle = page.locator('#preview-milestones-toggle');
      await expect(toggle).toBeChecked();
    });

    test('should toggle preference and persist via API', async ({ page }) => {
      await openProfileFromDrawer(page);

      const toggle = page.locator('#preview-milestones-toggle');
      await expect(toggle).toBeChecked();

      // Listen for API call
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );

      // Click the visible toggle slider to uncheck (the <input> is hidden by toggle-switch CSS)
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();

      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.showFutureGoalsUnlocked).toBe(false);

      // Toggle should now be unchecked after successful save
      await expect(toggle).not.toBeChecked({ timeout: 5000 });
    });

    test('should revert toggle on API failure',async ({ page }) => {
      await openProfileFromDrawer(page);

      const toggle = page.locator('#preview-milestones-toggle');
      await expect(toggle).toBeChecked();

      // Intercept API to simulate failure
      await page.route('**/api/user/preferences', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' }),
        });
      });

      // Click the visible toggle slider to uncheck
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();

      // Wait for error status
      const statusDiv = page.locator('#preference-status');
      await expect(statusDiv).toHaveClass(/error/, { timeout: 5000 });

      // Toggle should revert back to checked
      await expect(toggle).toBeChecked({ timeout: 5000 });

      // Clean up route
      await page.unroute('**/api/user/preferences');
    });

    test('should persist preference across page reload', async ({ page }) => {
      await openProfileFromDrawer(page);

      const toggle = page.locator('#preview-milestones-toggle');

      // Click the visible toggle slider to toggle OFF
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      await responsePromise;

      // Close modal
      await closePopupRobust(page, page.locator('#close-profile-modal'));

      // Reload page
      await page.reload();
      await page.waitForSelector('header', { timeout: 10000 });

      // Re-open profile modal
      await openProfileFromDrawer(page);

      // Toggle should still be unchecked
      const toggleAfterReload = page.locator('#preview-milestones-toggle');
      await expect(toggleAfterReload).not.toBeChecked({ timeout: 5000 });

      // Restore default (toggle back ON) for clean state
      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      await restorePromise;
    });

    test('should dispatch preferenceChanged event when toggled', async ({ page }) => {
      // Set up event listener before opening modal
      await page.evaluate(() => {
        window.__preferenceEventFired = false;
        window.__preferenceEventDetail = null;
        window.addEventListener('preferenceChanged', (e) => {
          window.__preferenceEventFired = true;
          window.__preferenceEventDetail = e.detail;
        });
      });

      await openProfileFromDrawer(page);

      const toggle = page.locator('#preview-milestones-toggle');

      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );
      // Click the visible toggle slider to uncheck
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      await responsePromise;

      // Check that the event was dispatched
      const eventFired = await page.evaluate(() => window.__preferenceEventFired);
      expect(eventFired).toBe(true);

      const eventDetail = await page.evaluate(() => window.__preferenceEventDetail);
      expect(eventDetail).toEqual({ showFutureGoalsUnlocked: false });

      // Restore default
      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      await restorePromise;
    });
  });

  test.describe('Goals List Integration', () => {
    test('next goal should always have goal-next-target styling', async ({ page }) => {
      // Wait for goals to load
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#goals-list')).toBeVisible({ timeout: 10000 });

      // Wait for upcoming goals to render (Preact hydration)
      await page.waitForFunction(() => {
        const nextGoalMount = document.getElementById('next-goal-mount');
        return nextGoalMount && nextGoalMount.children.length > 0;
      }, { timeout: 10000 });

      // Next goal should have goal-next-target class regardless of preference (default: ON)
      const nextGoalEl = page.locator('#next-goal-mount .goal-next-target');
      await expect(nextGoalEl).toBeVisible({ timeout: 5000 });
    });

    test('goals list should apply locked styling when preference OFF', async ({ page }) => {
      // First, toggle preference OFF via API directly
      const authToken = await page.evaluate(() => localStorage.getItem('sessionToken'));
      const setRes = await page.evaluate(async (token) => {
        const res = await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ showFutureGoalsUnlocked: false })
        });
        return res.status;
      }, authToken);
      expect(setRes).toBe(200);

      // Reload to apply preference
      await page.reload();
      await page.waitForSelector('header', { timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#goals-list')).toBeVisible({ timeout: 10000 });

      // Wait for upcoming goals to render
      await page.waitForFunction(() => {
        const list = document.getElementById('upcoming-goals-list');
        return list && list.children.length > 1; // next + at least one more
      }, { timeout: 10000 });

      // Future goals (not the next one) should have .goal-locked class
      const lockedGoals = page.locator('.goal-locked');
      const count = await lockedGoals.count();
      expect(count).toBeGreaterThan(0);

      // Restore default preference
      await page.evaluate(async (token) => {
        await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ showFutureGoalsUnlocked: true })
        });
      }, authToken);
    });

    test('goals list should NOT apply locked styling when preference ON', async ({ page }) => {
      // Ensure preference is ON (default)
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#goals-list')).toBeVisible({ timeout: 10000 });

      // Wait for upcoming goals to render
      await page.waitForFunction(() => {
        const list = document.getElementById('upcoming-goals-list');
        return list && list.children.length > 1;
      }, { timeout: 10000 });

      // No upcoming goals should have .goal-locked class when preference is ON
      const lockedGoals = page.locator('#upcoming-goals-list .goal-locked');
      const count = await lockedGoals.count();
      expect(count).toBe(0);
    });
  });

  test.describe('Session Loading', () => {
    test('session should include showFutureGoalsUnlocked field', async ({ page }) => {
      const authToken = await page.evaluate(() => localStorage.getItem('sessionToken'));
      const sessionData = await page.evaluate(async (token) => {
        const res = await fetch('/api/session', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return res.json();
      }, authToken);

      expect(typeof sessionData.showFutureGoalsUnlocked).toBe('boolean');
    });

    test('session should include defaultViewMap field', async ({ page }) => {
      const authToken = await page.evaluate(() => localStorage.getItem('sessionToken'));
      const sessionData = await page.evaluate(async (token) => {
        const res = await fetch('/api/session', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        return res.json();
      }, authToken);

      expect(typeof sessionData.defaultViewMap).toBe('boolean');
    });

    test('window.userPreferences should be initialized from session', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const prefs = await page.evaluate(() => window.userPreferences);
      expect(prefs).toBeDefined();
      expect(typeof prefs.showFutureGoalsUnlocked).toBe('boolean');
      expect(typeof prefs.defaultViewMap).toBe('boolean');
    });
  });

  test.describe('Default View Toggle', () => {
    test('should display default view toggle in profile modal', async ({ page }) => {
      await openProfileFromDrawer(page);

      // Toggle switch container should be visible
      const toggleSwitches = page.locator('.toggle-switch');
      const count = await toggleSwitches.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // Label should be present
      await expect(page.locator('label[for="default-view-toggle"]')).toContainText('Default to map view');

      // Default should be unchecked (journey view)
      const toggle = page.locator('#default-view-toggle');
      await expect(toggle).not.toBeChecked();
    });

    test('should toggle default view preference and persist via API', async ({ page }) => {
      await openProfileFromDrawer(page);

      const toggle = page.locator('#default-view-toggle');
      await expect(toggle).not.toBeChecked();

      // Listen for API call
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );

      // Click the toggle slider (second one in the modal)
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();

      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.defaultViewMap).toBe(true);

      // Toggle should now be checked after successful save
      await expect(toggle).toBeChecked({ timeout: 5000 });

      // Restore default (toggle back OFF) for clean state
      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await restorePromise;
    });

    test('should persist default view preference across navigation', async ({ page }) => {
      await openProfileFromDrawer(page);

      const toggle = page.locator('#default-view-toggle');

      // Toggle ON
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await responsePromise;

      // Close modal
      await closePopupRobust(page, page.locator('#close-profile-modal'));

      // Reload page (navigate to map since default view is now map)
      await page.goto(BASE_URL + '/map');
      await page.waitForSelector('header', { timeout: 10000 });

      // Open profile modal on map page
      await openProfileFromDrawer(page);

      // Toggle should still be checked
      const toggleAfterReload = page.locator('#default-view-toggle');
      await expect(toggleAfterReload).toBeChecked({ timeout: 5000 });

      // Restore default (toggle back OFF) for clean state
      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await restorePromise;
    });

    test('root should follow preference while /journey remains directly accessible', async ({ page }) => {
      await openProfileFromDrawer(page);

      const enablePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await enablePromise;

      await closePopupRobust(page, page.locator('#close-profile-modal'));

      // Root should apply default-map preference.
      await page.goto(BASE_URL + '/');
      await expect(page).toHaveURL(/\/map$/);
      await page.waitForLoadState('networkidle');

      // Journey route should remain accessible explicitly.
      // Firefox may NS_BINDING_ABORTED if service worker is still active from /map; retry once.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await page.goto(BASE_URL + '/journey');
          break;
        } catch (e) {
          if (attempt === 1 || !String(e).includes('NS_BINDING_ABORTED')) throw e;
        }
      }
      await page.waitForSelector('header', { timeout: 10000 });
      await expect(page).toHaveURL(/\/journey$/);

      await openProfileFromDrawer(page);
      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await restorePromise;
    });

    test('should revert default view toggle on API failure', async ({ page }) => {
      await openProfileFromDrawer(page);

      const toggle = page.locator('#default-view-toggle');
      await expect(toggle).not.toBeChecked();

      // Intercept API to simulate failure
      await page.route('**/api/user/preferences', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' }),
        });
      });

      // Click the toggle
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();

      // Wait for error status
      const statusDiv = page.locator('#preference-status');
      await expect(statusDiv).toHaveClass(/error/, { timeout: 5000 });

      // Toggle should revert back to unchecked
      await expect(toggle).not.toBeChecked({ timeout: 5000 });

      // Clean up route
      await page.unroute('**/api/user/preferences');
    });

    test('should dispatch preferenceChanged event with defaultViewMap when toggled', async ({ page }) => {
      // Set up event listener before opening modal
      await page.evaluate(() => {
        window.__preferenceEventFired = false;
        window.__preferenceEventDetail = null;
        window.addEventListener('preferenceChanged', (e) => {
          window.__preferenceEventFired = true;
          window.__preferenceEventDetail = e.detail;
        });
      });

      await openProfileFromDrawer(page);

      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await responsePromise;

      // Check that the event was dispatched
      const eventFired = await page.evaluate(() => window.__preferenceEventFired);
      expect(eventFired).toBe(true);

      const eventDetail = await page.evaluate(() => window.__preferenceEventDetail);
      expect(eventDetail).toEqual({ defaultViewMap: true });

      // Restore default
      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await restorePromise;
    });
  });
});
