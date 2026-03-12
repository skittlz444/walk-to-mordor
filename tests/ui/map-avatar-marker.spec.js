/**
 * Map User Avatar Marker E2E Tests
 *
 * Verifies that the Konva user position marker on the map renders the avatar
 * thumbnail when the user has an avatar set in their session, and falls back
 * to the ring marker when no avatar is set or the thumbnail fails to load.
 *
 * Story: Map View Uses Avatar Thumbnail for Player Marker
 * ACs: 1 (avatar thumbnail requested), 2 (no avatar = ring fallback),
 *      3 (failed load = ring fallback), 4 (interactivity preserved)
 *
 * Implementation note: The avatar preference is pre-configured via the real
 * API (PUT /api/user/preferences) before page navigation, so that the actual
 * session response includes the intended avatarId.  This avoids intercepting
 * the session route, which would conflict with the authentication flow.
 */

// @ts-check
const { test, expect } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

/**
 * Wait for MapIsland to fully hydrate.
 * Uses the deterministic data-hydrated signal set by the Preact component.
 */
async function waitForMapReady(page) {
  await page.waitForSelector('[data-island="MapIsland"][data-hydrated="true"]', {
    timeout: 20000,
  });
}

/**
 * Ensure the test user exists in the DB, then set their avatarId via the
 * preferences API so the real /api/session response will include it.
 *
 * @param {import('@playwright/test').APIRequestContext} request Playwright request context
 * @param {string} authToken  Mock auth token for the test user
 * @param {string} avatarSlug Valid avatar slug to set (e.g. 'frodo')
 */
async function setUserAvatar(request, authToken, avatarSlug) {
  // 1. Bootstrap the user in the DB (mock auth auto-creates on first call).
  await request.get(`${BASE_URL}/api/session`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  // 2. Set the avatar via the preferences endpoint.
  await request.put(`${BASE_URL}/api/user/preferences`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({ avatarId: avatarSlug }),
  });
}

test.describe('Map User Avatar Marker', () => {
  test.beforeEach(async ({ page, authToken }) => {
    // Inject the auth token into localStorage before any page loads.
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
  });

  // ── AC 2 ──────────────────────────────────────────────────────────────────
  test('ring marker shown and no thumbnail requested when user has no avatar', async ({
    page,
    authToken,
    request,
  }) => {
    // Bootstrap the user without setting an avatar (avatar_id defaults to NULL).
    await request.get(`${BASE_URL}/api/session`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const thumbRequests = [];
    page.on('request', (req) => {
      if (req.url().includes('/img/avatars/thumbs/')) {
        thumbRequests.push(req.url());
      }
    });

    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    // Allow a brief window for any late async image requests to arrive.
    await page.waitForTimeout(500);

    // No avatar thumbnail should have been requested.
    // Fresh test users have no friends, so there are also no friend-marker
    // thumbnail requests to confound this assertion.
    expect(thumbRequests).toHaveLength(0);

    // Map canvas must still render correctly with the ring fallback.
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible();
  });

  // ── AC 1 ──────────────────────────────────────────────────────────────────
  test('avatar thumbnail requested when user has an avatar set', async ({
    page,
    authToken,
    request,
  }) => {
    // Pre-configure the avatar so the session returns avatarId: 'frodo'.
    await setUserAvatar(request, authToken, 'frodo');

    // Register a promise that resolves once the browser requests the frodo
    // thumbnail.  Must be registered before navigation.
    const avatarRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/img/avatars/thumbs/frodo.webp'),
      { timeout: 15000 },
    );

    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    // The UserMarker code should have requested the frodo avatar thumbnail.
    await avatarRequestPromise;

    // Map canvas must still render correctly.
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible();
  });

  // ── AC 3 ──────────────────────────────────────────────────────────────────
  test('ring fallback maintained when avatar thumbnail responds with 404', async ({
    page,
    authToken,
    request,
  }) => {
    // Pre-configure the avatar so the session returns avatarId: 'aragorn'.
    await setUserAvatar(request, authToken, 'aragorn');

    // Simulate a missing thumbnail (e.g., the image file was not served).
    await page.route('**/img/avatars/thumbs/aragorn.webp', (route) => {
      route.fulfill({ status: 404 });
    });

    // Capture console errors to verify no unhandled JS error surfaces.
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    // Map canvas must remain visible — the ring fallback keeps the marker alive.
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible();

    // No UserMarker-related JS errors should have been thrown.
    const markerErrors = consoleErrors.filter(
      (e) =>
        e.toLowerCase().includes('usermarker') ||
        (e.toLowerCase().includes('avatar') && !e.includes('favicon')),
    );
    expect(markerErrors).toHaveLength(0);
  });

  // ── AC 4 ──────────────────────────────────────────────────────────────────
  test('map interactivity (drag) preserved after avatar thumbnail loads', async ({
    page,
    authToken,
    request,
  }) => {
    // Use gandalf-grey whose thumbnail exists as a checked-in placeholder asset.
    await setUserAvatar(request, authToken, 'gandalf-grey');

    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible();

    // Give the avatar image a brief window to finish loading.
    await page.waitForTimeout(300);

    // The map canvas must still be draggable after the avatar has loaded.
    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY + 30, { steps: 6 });
    await page.mouse.up();

    // Canvas should still be visible and layout intact post-drag.
    await expect(canvas.first()).toBeVisible();
  });

  // ── Thumbnail path contract ────────────────────────────────────────────────
  test('thumbnail request uses the exact slug from the session avatarId', async ({
    page,
    authToken,
    request,
  }) => {
    const slug = 'samwise';
    await setUserAvatar(request, authToken, slug);

    // Use waitForRequest so we don't race with async image loading timing.
    const thumbnailRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/img/avatars/thumbs/'),
      { timeout: 15000 },
    );

    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    // The URL of the first thumbnail request must contain the exact slug.
    const thumbnailRequest = await thumbnailRequestPromise;
    expect(thumbnailRequest.url()).toContain(`/img/avatars/thumbs/${slug}.webp`);
  });
});
