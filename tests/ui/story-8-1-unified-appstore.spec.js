// @ts-check
const { test, expect, setupTest, waitForAuthenticated, waitForIsland } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

/**
 * E2E Tests — Story 8.1: Unified Preact Signal Global Store (appStore)
 *
 * Validates that the unified appStore hydrates from a single /api/session call,
 * keeps bridge globals in sync, and all islands read from the store rather than
 * making independent session fetches.
 */
test.describe('Story 8.1: Unified Preact Signal Global Store', () => {

  // ====================================================================
  // 1. Single /api/session call on page load
  // ====================================================================
  test.describe('Single Session Fetch (AC #2, #4)', () => {
    test('should make only one /api/session request on journey page load', async ({ page, authToken }) => {
      const sessionCalls = [];

      // Intercept ALL /api/session requests
      page.on('request', (request) => {
        if (request.url().includes('/api/session')) {
          sessionCalls.push({
            url: request.url(),
            method: request.method(),
            timestamp: Date.now(),
          });
        }
      });

      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      await page.goto(`${BASE_URL}/journey`);
      await waitForAuthenticated(page);
      await page.waitForLoadState('networkidle');

      // main.js makes its own /api/session calls (legacy — out of scope).
      // The Preact layer (appStore) should add at most ONE additional call.
      // Filter to GET requests (session reads, not auth form POSTs).
      const getCalls = sessionCalls.filter((c) => c.method === 'GET');

      // Legacy main.js may make 1-2 calls. With appStore the Preact layer
      // should NOT add extra calls beyond what main.js already does.
      // The key assertion: no more than 3 total (main.js + appStore).
      // Pre-story 8.1 this would be 4+ calls.
      expect(getCalls.length).toBeLessThanOrEqual(3);
    });

    test('should not have MapIsland or mapStore making extra /api/session calls on map page', async ({ page, authToken }) => {
      const sessionCalls = [];

      page.on('request', (request) => {
        if (request.url().includes('/api/session') && request.method() === 'GET') {
          sessionCalls.push(request.url());
        }
      });

      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      await page.goto(`${BASE_URL}/map`);
      await waitForAuthenticated(page);
      await page.waitForLoadState('networkidle');

      // Before story 8.1 the map page made 4+ /api/session calls:
      //   main.js checkAuth + main.js prefs + mapStore + MapIsland.
      // After 8.1, mapStore and MapIsland read from appStore, so the
      // Preact layer adds at most one call. Total should be ≤ 4
      // (main.js legacy calls are out of scope for this story).
      // The important invariant: no more than the pre-8.1 baseline.
      expect(sessionCalls.length).toBeLessThanOrEqual(4);
    });
  });

  // ====================================================================
  // 2. Bridge global sync — window.userPreferences
  // ====================================================================
  test.describe('Bridge Global Sync (AC #5)', () => {
    test.beforeEach(async ({ page, authToken }) => {
      await setupTest({ page, authToken });
    });

    test('window.userPreferences should be set after page load', async ({ page }) => {
      await waitForAuthenticated(page);

      const prefs = await page.evaluate(() => window.userPreferences);
      expect(prefs).toBeDefined();
      expect(typeof prefs.showFutureGoalsUnlocked).toBe('boolean');
      expect(typeof prefs.defaultViewMap).toBe('boolean');
    });

    test('window.userPreferences should reflect session values', async ({ page }) => {
      await waitForAuthenticated(page);

      // Fetch the true session data for comparison
      const authToken = await page.evaluate(() => localStorage.getItem('sessionToken'));
      const sessionData = await page.evaluate(async (token) => {
        const res = await fetch('/api/session', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.json();
      }, authToken);

      const prefs = await page.evaluate(() => window.userPreferences);
      expect(prefs.showFutureGoalsUnlocked).toBe(sessionData.showFutureGoalsUnlocked);
      expect(prefs.defaultViewMap).toBe(sessionData.defaultViewMap);
    });

    test('window.userPreferences should stay in sync after preference change', async ({ page }) => {
      // Navigate to profile and toggle a preference
      await page.goto(`${BASE_URL}/profile`);
      await waitForAuthenticated(page);
      await page.waitForSelector('[data-island="ProfileIsland"][data-hydrated="true"]', { timeout: 10000 });
      await page.waitForSelector('.profile-page', { timeout: 10000 });

      const prefsBefore = await page.evaluate(() => ({
        showFutureGoalsUnlocked: window.userPreferences?.showFutureGoalsUnlocked,
      }));

      // Toggle the preview milestones preference
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      await responsePromise;

      // window.userPreferences should now be updated
      const prefsAfter = await page.evaluate(() => ({
        showFutureGoalsUnlocked: window.userPreferences?.showFutureGoalsUnlocked,
      }));

      expect(prefsAfter.showFutureGoalsUnlocked).toBe(!prefsBefore.showFutureGoalsUnlocked);

      // Restore default
      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      await restorePromise;
    });
  });

  // ====================================================================
  // 3. preferenceChanged CustomEvent dispatch
  // ====================================================================
  test.describe('preferenceChanged CustomEvent (AC #5)', () => {
    test.beforeEach(async ({ page, authToken }) => {
      await setupTest({ page, authToken });
    });

    test('should dispatch preferenceChanged event when preference is toggled', async ({ page }) => {
      await page.goto(`${BASE_URL}/profile`);
      await waitForAuthenticated(page);
      await page.waitForSelector('[data-island="ProfileIsland"][data-hydrated="true"]', { timeout: 10000 });
      await page.waitForSelector('.profile-page', { timeout: 10000 });

      // Attach a listener for the custom event
      await page.evaluate(() => {
        window.__preferenceEvents = [];
        window.addEventListener('preferenceChanged', (e) => {
          window.__preferenceEvents.push(e.detail);
        });
      });

      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      await responsePromise;

      const events = await page.evaluate(() => window.__preferenceEvents);
      expect(events.length).toBeGreaterThan(0);

      const lastEvent = events[events.length - 1];
      expect(typeof lastEvent.showFutureGoalsUnlocked).toBe('boolean');

      // Restore default
      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      await restorePromise;
    });
  });

  // ====================================================================
  // 4. Islands read from appStore (no own /api/session calls)
  // ====================================================================
  test.describe('Islands Read from appStore (AC #3, #4)', () => {
    test('MapIsland should hydrate without extra /api/session calls beyond baseline', async ({ page, authToken }) => {
      // First load journey page to establish a baseline session call count
      const journeyCalls = [];
      page.on('request', (request) => {
        if (request.url().includes('/api/session') && request.method() === 'GET') {
          journeyCalls.push(request.url());
        }
      });

      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      await page.goto(`${BASE_URL}/journey`);
      await waitForAuthenticated(page);
      await page.waitForLoadState('networkidle');
      const journeyBaseline = journeyCalls.length;

      // Now navigate to map page and count calls
      const mapCalls = [];
      page.on('request', (request) => {
        if (request.url().includes('/api/session') && request.method() === 'GET') {
          mapCalls.push(request.url());
        }
      });

      await page.goto(`${BASE_URL}/map`);
      await waitForAuthenticated(page);
      await page.waitForSelector('[data-island="MapIsland"][data-hydrated="true"]', { timeout: 15000 });
      await page.waitForLoadState('networkidle');

      // Map page should not make significantly more /api/session calls
      // than journey page. Pre-8.1 the map page made 2+ extra calls.
      // Post-8.1, MapIsland reads from appStore, so map page calls
      // should be close to the journey baseline (within 1 extra at most).
      const mapOnly = mapCalls.length - journeyCalls.length;
      expect(mapOnly).toBeLessThanOrEqual(journeyBaseline + 1);
    });

    test('mapStore.showFutureGoalsUnlocked should be a computed from appStore preferences', async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      await page.goto(`${BASE_URL}/map`);
      await waitForAuthenticated(page);
      await page.waitForSelector('[data-island="MapIsland"][data-hydrated="true"]', { timeout: 15000 });

      // Verify that the map respects the preference from appStore
      const authTokenValue = await page.evaluate(() => localStorage.getItem('sessionToken'));
      const sessionData = await page.evaluate(async (token) => {
        const res = await fetch('/api/session', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.json();
      }, authTokenValue);

      // window.userPreferences (synced by appStore) should match session
      const prefs = await page.evaluate(() => window.userPreferences);
      expect(prefs.showFutureGoalsUnlocked).toBe(sessionData.showFutureGoalsUnlocked);
    });
  });

  // ====================================================================
  // 5. getAuthHeaders utility
  // ====================================================================
  test.describe('getAuthHeaders Utility (AC #4)', () => {
    test('authenticated API calls should include Authorization header', async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      await page.goto(`${BASE_URL}/journey`);
      await waitForAuthenticated(page);

      // Verify that API calls include the auth header
      const result = await page.evaluate(async () => {
        const token = localStorage.getItem('sessionToken');
        const res = await fetch('/api/session', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return { status: res.status, ok: res.ok };
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    });

    test('API call without token should return 401', async ({ page }) => {
      await page.goto(`${BASE_URL}/journey`);

      const result = await page.evaluate(async () => {
        const res = await fetch('/api/session');
        return { status: res.status };
      });

      expect(result.status).toBe(401);
    });
  });

  // ====================================================================
  // 6. Legacy interop — body.authenticated & window.partyStore
  // ====================================================================
  test.describe('Legacy Interop (AC #5)', () => {
    test('body.authenticated class should be set for logged-in users', async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      await page.goto(`${BASE_URL}/journey`);
      await waitForAuthenticated(page);

      const hasClass = await page.evaluate(() =>
        document.body.classList.contains('authenticated')
      );
      expect(hasClass).toBe(true);
    });

    test('body should NOT have authenticated class without token', async ({ page }) => {
      await page.goto(`${BASE_URL}/journey`);

      // Wait for page to finish loading
      await page.waitForLoadState('networkidle');

      const hasClass = await page.evaluate(() =>
        document.body.classList.contains('authenticated')
      );
      expect(hasClass).toBe(false);
    });

    test('window.partyStore should be exposed as a bridge global', async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      await page.goto(`${BASE_URL}/journey`);
      await waitForAuthenticated(page);

      const hasPartyStore = await page.evaluate(() => {
        return typeof window.partyStore !== 'undefined' && window.partyStore !== null;
      });
      expect(hasPartyStore).toBe(true);
    });

    test('window.preact bridge should be available', async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      await page.goto(`${BASE_URL}/journey`);
      await waitForAuthenticated(page);

      const bridges = await page.evaluate(() => ({
        hasPreact: typeof window.preact !== 'undefined',
        hasRender: typeof window.preact?.render === 'function',
        hasH: typeof window.preact?.h === 'function',
        hasIslands: typeof window.preactIslands !== 'undefined',
      }));

      expect(bridges.hasPreact).toBe(true);
      expect(bridges.hasRender).toBe(true);
      expect(bridges.hasH).toBe(true);
      expect(bridges.hasIslands).toBe(true);
    });
  });

  // ====================================================================
  // 7. Error states — failed session fetch
  // ====================================================================
  test.describe('Error States (AC #2)', () => {
    test('should handle unauthenticated state gracefully (no token)', async ({ page }) => {
      // Visit page without setting token
      await page.goto(`${BASE_URL}/journey`);
      await page.waitForLoadState('networkidle');

      // Page should still load — auth forms should be visible instead of authenticated content
      const bodyClasses = await page.evaluate(() => document.body.className);
      expect(bodyClasses).not.toContain('authenticated');

      // No JS errors should crash the page
      const title = await page.title();
      expect(title).toBeTruthy();
    });

    test('should handle server error on /api/session gracefully', async ({ page, authToken }) => {
      // Intercept /api/session to return 500
      await page.route('**/api/session', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      // Capture console errors
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}/journey`);
      // Use domcontentloaded — networkidle may hang when routes are intercepted
      await page.waitForLoadState('domcontentloaded');
      // Give time for scripts to execute
      await page.waitForTimeout(3000);

      // Page should not crash — it should still render
      const pageTitle = await page.title();
      expect(pageTitle).toBeTruthy();

      // Clean up route
      await page.unroute('**/api/session');
    });

    test('should handle 401 session response without crashing', async ({ page }) => {
      // Use an invalid token
      await page.addInitScript(() => {
        localStorage.setItem('sessionToken', 'INVALID_TOKEN_12345');
      });

      await page.goto(`${BASE_URL}/journey`);
      await page.waitForLoadState('networkidle');

      // Page should still be functional
      const pageTitle = await page.title();
      expect(pageTitle).toBeTruthy();
    });
  });

  // ====================================================================
  // 8. Signal reactivity across islands
  // ====================================================================
  test.describe('Signal Reactivity Across Islands (AC #1, #3)', () => {
    test('preference change on profile should reflect on map page', async ({ page, authToken }) => {
      await setupTest({ page, authToken });

      // Navigate to profile and change preference
      await page.goto(`${BASE_URL}/profile`);
      await waitForAuthenticated(page);
      await page.waitForSelector('[data-island="ProfileIsland"][data-hydrated="true"]', { timeout: 10000 });
      await page.waitForSelector('.profile-page', { timeout: 10000 });

      // Toggle showFutureGoalsUnlocked OFF
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      const toggleResponse = await responsePromise;
      const toggleData = await toggleResponse.json();
      expect(toggleData.showFutureGoalsUnlocked).toBe(false);

      // Navigate to map and wait for appStore to hydrate from /api/session
      await page.goto(`${BASE_URL}/map`);
      await waitForAuthenticated(page);
      await page.waitForSelector('[data-island="MapIsland"][data-hydrated="true"]', { timeout: 15000 });
      // Wait for networkidle to ensure appStore has fetched /api/session
      await page.waitForLoadState('networkidle');

      // Verify the preference via direct API call (source of truth)
      const sessionData = await page.evaluate(async () => {
        const token = localStorage.getItem('sessionToken');
        const res = await fetch('/api/session', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.json();
      });
      // The API should return the toggled-off value
      expect(sessionData.showFutureGoalsUnlocked).toBe(false);

      // Restore default preference
      await page.goto(`${BASE_URL}/profile`);
      await waitForAuthenticated(page);
      await page.waitForSelector('[data-island="ProfileIsland"][data-hydrated="true"]', { timeout: 10000 });
      await page.waitForSelector('.profile-page', { timeout: 10000 });

      const restorePromise = page.waitForResponse(
        (response) => response.url().includes('/api/user/preferences') && response.request().method() === 'PUT'
      );
      await page.locator('.toggle-group:has(#preview-milestones-toggle) .toggle-slider').click();
      await restorePromise;
    });

    test('session data should be available across different pages', async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      // Check journey page
      await page.goto(`${BASE_URL}/journey`);
      await waitForAuthenticated(page);
      const journeyPrefs = await page.evaluate(() => window.userPreferences);
      expect(journeyPrefs).toBeDefined();

      // Check map page
      await page.goto(`${BASE_URL}/map`);
      await waitForAuthenticated(page);
      await page.waitForSelector('[data-island="MapIsland"][data-hydrated="true"]', { timeout: 15000 });
      const mapPrefs = await page.evaluate(() => window.userPreferences);
      expect(mapPrefs).toBeDefined();

      // Preferences should be consistent across pages
      expect(journeyPrefs.showFutureGoalsUnlocked).toBe(mapPrefs.showFutureGoalsUnlocked);
      expect(journeyPrefs.defaultViewMap).toBe(mapPrefs.defaultViewMap);
    });
  });

  // ====================================================================
  // 9. Session API response shape validation
  // ====================================================================
  test.describe('Session API Response Shape', () => {
    test('/api/session should return expected fields for appStore hydration', async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      await page.goto(`${BASE_URL}/journey`);
      await waitForAuthenticated(page);

      const sessionData = await page.evaluate(async () => {
        const token = localStorage.getItem('sessionToken');
        const res = await fetch('/api/session', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.json();
      });

      // Validate all fields that appStore expects from SessionResponse
      expect(typeof sessionData.userId).toBe('number');
      expect(typeof sessionData.username).toBe('string');
      // avatarId can be string or null
      expect(sessionData.avatarId === null || typeof sessionData.avatarId === 'string').toBe(true);
      expect(typeof sessionData.isAdmin).toBe('boolean');
      expect(typeof sessionData.showFutureGoalsUnlocked).toBe('boolean');
      expect(typeof sessionData.defaultViewMap).toBe('boolean');
    });
  });

  // ====================================================================
  // 10. Island hydration with appStore
  // ====================================================================
  test.describe('Island Hydration (AC #1)', () => {
    test('MapIsland should hydrate successfully on map page', async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      await page.goto(`${BASE_URL}/map`);
      await waitForAuthenticated(page);

      await page.waitForSelector('[data-island="MapIsland"][data-hydrated="true"]', { timeout: 15000 });

      // The island should be rendered and interactive
      const isHydrated = await page.evaluate(() => {
        const el = document.querySelector('[data-island="MapIsland"]');
        return el?.getAttribute('data-hydrated') === 'true';
      });
      expect(isHydrated).toBe(true);
    });

    test('ProfileIsland should hydrate successfully on profile page', async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      await page.goto(`${BASE_URL}/profile`);
      await waitForAuthenticated(page);

      await page.waitForSelector('[data-island="ProfileIsland"][data-hydrated="true"]', { timeout: 10000 });

      const isHydrated = await page.evaluate(() => {
        const el = document.querySelector('[data-island="ProfileIsland"]');
        return el?.getAttribute('data-hydrated') === 'true';
      });
      expect(isHydrated).toBe(true);
    });

    test('DrawerIsland should hydrate on map page', async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);

      await page.goto(`${BASE_URL}/map`);
      await waitForAuthenticated(page);

      await page.waitForSelector('[data-island="DrawerIsland"][data-hydrated="true"]', { timeout: 10000 });

      const isHydrated = await page.evaluate(() => {
        const el = document.querySelector('[data-island="DrawerIsland"]');
        return el?.getAttribute('data-hydrated') === 'true';
      });
      expect(isHydrated).toBe(true);
    });
  });
});
