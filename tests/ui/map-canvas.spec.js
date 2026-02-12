const { test, expect } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

// Small 10x10 red PNG for tile stubs
const SMALL_TILE_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0BFwMgwasChAwAMDAn/xe0DwQAAAABJRU5ErkJggg==',
  'base64',
);

// Minimal tile metadata for testing (small dimensions, few tiles)
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

function interceptTileRequests(page) {
  return page.route('**/img/map/tiles/**', async (route) => {
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
  });
}

test.describe('Map Canvas & Base Image Layer', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
    await interceptTileRequests(page);
  });

  test('renders Konva canvas after tile metadata loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    // Konva creates its own canvas inside the container
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });

  test('canvas fills the map shell area', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    const wrapper = page.locator('.map-canvas-wrapper');
    const wrapperBox = await wrapper.boundingBox();

    expect(wrapperBox).not.toBeNull();
    expect(wrapperBox.width).toBeGreaterThan(100);
    expect(wrapperBox.height).toBeGreaterThan(100);
  });

  test('map can be dragged (panned)', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 50, { steps: 10 });
    await page.mouse.up();

    await expect(canvas.first()).toBeVisible();
  });

  test('map can be zoomed via mouse wheel', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(500);

    await expect(canvas.first()).toBeVisible();
  });

  test('map responds to window resize', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    await page.setViewportSize({ width: 800, height: 400 });
    await page.waitForTimeout(300);

    await expect(canvas.first()).toBeVisible();
    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    expect(box.width).toBeGreaterThan(50);
    expect(box.height).toBeGreaterThan(50);
  });

  test('grab cursor style is applied', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    const cursor = await page.locator('.map-canvas-wrapper').evaluate(
      (el) => window.getComputedStyle(el).cursor,
    );
    expect(cursor).toBe('grab');
  });
});

test.describe('Map Canvas - Mobile Touch', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
    await interceptTileRequests(page);
  });

  test('canvas renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });

  test('touch-action none prevents browser gestures', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    const touchAction = await page.locator('.map-canvas-wrapper').evaluate(
      (el) => window.getComputedStyle(el).touchAction,
    );
    expect(touchAction).toBe('none');
  });
});

test.describe('Map Canvas (Unauthenticated)', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/map`);
    expect(response).not.toBeNull();
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(400);

    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });
});
