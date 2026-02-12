const { test, expect } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

// Create a small test image as a data URL (1x1 red pixel PNG)
const SMALL_TEST_IMAGE_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0BFwMgwasChAwAMDAn/xe0DwQAAAABJRU5ErkJggg==';

function interceptMapImage(page) {
  return page.route('**/img/map/**', async (route) => {
    // Respond with a small 10x10 PNG to avoid canvas memory issues in CI
    const response = await fetch(SMALL_TEST_IMAGE_BASE64);
    const buffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0BFwMgwasChAwAMDAn/xe0DwQAAAABJRU5ErkJggg==',
      'base64',
    );
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: buffer,
    });
  });
}

test.describe('Map Canvas & Base Image Layer', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
    // Intercept map images to use small test images (avoids canvas memory issues in CI)
    await interceptMapImage(page);
  });

  test('renders canvas element after map image loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

    // Wait for the Konva canvas to appear (image loaded successfully)
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });

  test('shows loading state before image loads', async ({ page }) => {
    // Override the fast intercept with a slow one
    await page.unrouteAll();
    await page.route('**/img/map/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0BFwMgwasChAwAMDAn/xe0DwQAAAABJRU5ErkJggg==',
        'base64',
      );
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: buffer,
      });
    });

    await page.goto(`${BASE_URL}/map`);

    // Should show loading text
    const loadingText = page.locator('text=Loading Middle-earth...');
    await expect(loadingText).toBeVisible({ timeout: 5000 });

    // Wait for canvas to eventually appear
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });

  test('canvas fills the map container', async ({ page }) => {
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

    // Perform a drag on the canvas
    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 50, { steps: 10 });
    await page.mouse.up();

    // Verify the canvas still exists (drag didn't break anything)
    await expect(canvas.first()).toBeVisible();
  });

  test('map can be zoomed via mouse wheel', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Scroll to zoom in
    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(500);

    // Verify the canvas still exists after zoom
    await expect(canvas.first()).toBeVisible();
  });

  test('map responds to window resize', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Resize the viewport
    await page.setViewportSize({ width: 800, height: 400 });
    await page.waitForTimeout(300);

    // Canvas should still be visible and filled
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
    await interceptMapImage(page);
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

    // Verify touch-action: none is set on wrapper
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
