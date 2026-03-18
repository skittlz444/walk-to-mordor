// @ts-check
const { test, expect, setupTest, waitForAuthenticated } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

async function navigateToProfile(page) {
  await page.goto(BASE_URL + '/profile');
  await waitForAuthenticated(page);
  await page.waitForSelector('[data-island="ProfileIsland"][data-hydrated="true"]', { timeout: 10000 });
  // Wait for loading state to complete (toggle switches render after API data loads)
  await page.waitForSelector('.profile-page', { timeout: 10000 });
}

/**
 * UI Tests - User Goal Visibility Preference (Story 2.10)
 */
test.describe('User Goal Visibility Preference', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
    await waitForAuthenticated(page);
  });

  test.describe('Profile Page Toggle', () => {
    test('should display preview milestones toggle on profile page', async ({ page }) => {
      await navigateToProfile(page);

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
      await navigateToProfile(page);

      const toggle = page.locator('#preview-milestones-toggle');
      await expect(toggle).toBeChecked();

      // Listen for API call
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );

      // Click the visible toggle slider to uncheck (the <input> is hidden by toggle-switch CSS)
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();

      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.showFutureGoalsUnlocked).toBe(false);

      // Toggle should now be unchecked after successful save
      await expect(toggle).not.toBeChecked();
    });

    test('should revert toggle on API failure',async ({ page }) => {
      await navigateToProfile(page);

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
      await expect(toggle).toBeChecked();

      // Clean up route
      await page.unroute('**/api/user/preferences');
    });

    test('should persist preference across page reload', async ({ page }) => {
      await navigateToProfile(page);

      const toggle = page.locator('#preview-milestones-toggle');

      // Click the visible toggle slider to toggle OFF
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      await responsePromise;

      // Reload profile page
      await page.reload();
      await waitForAuthenticated(page);
      await page.waitForSelector('[data-island="ProfileIsland"][data-hydrated="true"]', { timeout: 10000 });

      // Toggle should still be unchecked
      const toggleAfterReload = page.locator('#preview-milestones-toggle');
      await expect(toggleAfterReload).not.toBeChecked();

      // Restore default (toggle back ON) for clean state
      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      await restorePromise;
    });

    test('should dispatch preferenceChanged event when toggled', async ({ page }) => {
      // Navigate to profile page, then set up event listener
      await navigateToProfile(page);

      await page.evaluate(() => {
        window.__preferenceEventFired = false;
        window.__preferenceEventDetail = null;
        window.addEventListener('preferenceChanged', (e) => {
          window.__preferenceEventFired = true;
          window.__preferenceEventDetail = e.detail;
        });
      });

      const toggle = page.locator('#preview-milestones-toggle');

      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
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
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      await restorePromise;
    });
  });

  test.describe('Goals List Integration', () => {
    test('next goal should always have goal-next-target styling', async ({ page }) => {
      // Wait for goals to load
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#goals-list')).toBeVisible();

      // Wait for upcoming goals to render (Preact hydration)
      await page.waitForFunction(() => {
        const nextGoalMount = document.getElementById('next-goal-mount');
        return nextGoalMount && nextGoalMount.children.length > 0;
      });

      // Next goal should have goal-next-target class regardless of preference (default: ON)
      const nextGoalEl = page.locator('#next-goal-mount .goal-next-target');
      await expect(nextGoalEl).toBeVisible();
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
      await waitForAuthenticated(page);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#goals-list')).toBeVisible();

      // Wait for upcoming goals to render
      await page.waitForFunction(() => {
        const list = document.getElementById('upcoming-goals-list');
        return list && list.children.length > 1; // next + at least one more
      });

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
      await expect(page.locator('#goals-list')).toBeVisible();

      // Wait for upcoming goals to render
      await page.waitForFunction(() => {
        const list = document.getElementById('upcoming-goals-list');
        return list && list.children.length > 1;
      });

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
      await waitForAuthenticated(page);

      const prefs = await page.evaluate(() => window.userPreferences);
      expect(prefs).toBeDefined();
      expect(typeof prefs.showFutureGoalsUnlocked).toBe('boolean');
      expect(typeof prefs.defaultViewMap).toBe('boolean');
    });
  });

  test.describe('Default View Toggle', () => {
    test('should display default view toggle on profile page', async ({ page }) => {
      await navigateToProfile(page);

      // Toggle switch container should be visible (use auto-retrying assertion)
      const toggleSwitches = page.locator('.toggle-switch');
      await expect(toggleSwitches).toHaveCount(2, { timeout: 10000 });

      // Label should be present
      await expect(page.locator('label[for="default-view-toggle"]')).toContainText('Default to map view');

      // Default should be unchecked (journey view)
      const toggle = page.locator('#default-view-toggle');
      await expect(toggle).not.toBeChecked();
    });

    test('should toggle default view preference and persist via API', async ({ page }) => {
      await navigateToProfile(page);

      const toggle = page.locator('#default-view-toggle');
      await expect(toggle).not.toBeChecked();

      // Listen for API call
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );

      // Click the toggle slider
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();

      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.defaultViewMap).toBe(true);

      // Toggle should now be checked after successful save
      await expect(toggle).toBeChecked();

      // Restore default (toggle back OFF) for clean state
      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await restorePromise;
    });

    test('should persist default view preference across navigation', async ({ page }) => {
      await navigateToProfile(page);

      const toggle = page.locator('#default-view-toggle');

      // Toggle ON
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await responsePromise;

      // Navigate to map page
      await page.goto(BASE_URL + '/map');
      await waitForAuthenticated(page);
      await page.waitForSelector('[data-island="MapIsland"][data-hydrated="true"]');

      // Navigate back to profile page
      await navigateToProfile(page);

      // Toggle should still be checked
      const toggleAfterNav = page.locator('#default-view-toggle');
      await expect(toggleAfterNav).toBeChecked();

      // Restore default (toggle back OFF) for clean state
      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await restorePromise;
    });

    test('root should follow preference while /journey remains directly accessible', async ({ page }) => {
      await navigateToProfile(page);

      const enablePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await enablePromise;

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
      await waitForAuthenticated(page);
      await expect(page).toHaveURL(/\/journey$/);

      await navigateToProfile(page);
      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await restorePromise;
    });

    test('should revert default view toggle on API failure', async ({ page }) => {
      await navigateToProfile(page);

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
      await expect(toggle).not.toBeChecked();

      // Clean up route
      await page.unroute('**/api/user/preferences');
    });

    test('should dispatch preferenceChanged event with defaultViewMap when toggled', async ({ page }) => {
      // Navigate to profile page, then set up event listener for toggle action
      await navigateToProfile(page);

      await page.evaluate(() => {
        window.__preferenceEventFired = false;
        window.__preferenceEventDetail = null;
        window.addEventListener('preferenceChanged', (e) => {
          window.__preferenceEventFired = true;
          window.__preferenceEventDetail = e.detail;
        });
      });

      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
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
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#default-view-toggle) .toggle-slider').click();
      await restorePromise;
    });
  });
});
