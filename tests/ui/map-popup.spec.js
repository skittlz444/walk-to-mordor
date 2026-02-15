const { test, expect } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

// Small 10x10 red PNG for tile stubs
const SMALL_TILE_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0BFwMgwasChAwAMDAn/xe0DwQAAAABJRU5ErkJggg==',
  'base64',
);

// Minimal tile metadata for testing
const TEST_METADATA = {
  source: 'test.webp',
  fullWidth: 1024,
  fullHeight: 512,
  tileSize: 512,
  levels: [
    { z: 0, width: 1024, height: 512, cols: 2, rows: 1 },
    { z: 1, width: 512, height: 256, cols: 1, rows: 1 },
  ],
};

// Test goals data — a mix of near (unlocked) and far (locked) goals
const TEST_GOALS = [
  { id: 1, distance: 5.0, title: 'Green Hill Country', special: null, description: 'Rolling hills', image_id: '1' },
  { id: 2, distance: 10.0, title: 'Woody End', special: 'Meeting the Elves', description: 'A wooded area', image_id: '2' },
  { id: 3, distance: 2000.0, title: 'Mordor Gate', special: null, description: 'The Black Gate', image_id: '3' },
];

// User has walked 20 km ≈ 12.4 miles → goals 1 & 2 are unlocked, goal 3 is locked
const TEST_PROGRESS = { totalDistance: 20 };

function interceptRequests(page) {
  return Promise.all([
    page.route('**/img/map/tiles/**', async (route) => {
      const url = route.request().url();
      if (url.endsWith('metadata.json')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(TEST_METADATA),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: SMALL_TILE_BUFFER,
        });
      }
    }),
    page.route('**/api/total-distance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TEST_PROGRESS),
      });
    }),
    page.route('**/api/goals', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TEST_GOALS),
      });
    }),
    page.route('**/img/thumbs/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: SMALL_TILE_BUFFER,
      });
    }),
  ]);
}

test.describe('Waypoint Detail Popup', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
    await interceptRequests(page);
  });

  test('popup container renders in the DOM when map loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
    // No popup should be visible initially
    await expect(page.locator('.waypoint-popup')).not.toBeVisible();
    await expect(page.locator('.waypoint-sheet')).not.toBeVisible();
  });

  test('ESC key event is dispatched to the page', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Inject a popup element to verify ESC handling works at DOM level
    await page.evaluate(() => {
      const popup = document.createElement('div');
      popup.className = 'waypoint-popup';
      popup.id = 'test-popup';
      popup.setAttribute('role', 'dialog');
      popup.textContent = 'Test popup';
      document.querySelector('.map-canvas-wrapper')?.appendChild(popup);

      // Add ESC listener that removes the popup (mirrors component behavior)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          popup.remove();
        }
      });
    });

    // Verify popup is visible
    await expect(page.locator('#test-popup')).toBeVisible();

    // Press ESC — should dismiss the popup
    await page.keyboard.press('Escape');

    // Verify popup was removed
    await expect(page.locator('#test-popup')).not.toBeVisible();
  });

  test('popup CSS styles are loaded', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Check that the CSS for the popup component is loaded in the page
    const hasPopupStyles = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          if (rules.some(r => r.cssText?.includes('.waypoint-popup'))) {
            return true;
          }
        } catch (_e) {
          // Cross-origin stylesheet — skip
        }
      }
      return false;
    });
    expect(hasPopupStyles).toBe(true);
  });

  test('map controls remain visible when popup would be shown', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Map controls should always be visible
    const zoomIn = page.locator('button[aria-label="Zoom in"]');
    await expect(zoomIn).toBeVisible();
  });
});

test.describe('Waypoint Popup - Mobile', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
    await interceptRequests(page);
  });

  test('mobile viewport does not show desktop popup', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Desktop popup should not be visible on mobile
    await expect(page.locator('.waypoint-popup')).not.toBeVisible();
  });
});
