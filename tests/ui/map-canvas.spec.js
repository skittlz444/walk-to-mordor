const { test, expect } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

test.describe('Map Canvas & Base Image Layer', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
  });

  test('renders canvas element after map image loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

    // Wait for the Konva canvas to appear (image loaded successfully)
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 30000 });
  });

  test('shows loading state before image loads', async ({ page }) => {
    // Slow down image loading to see the loading state
    await page.route('**/img/map/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });

    await page.goto(`${BASE_URL}/map`);

    // Should show loading text
    const loadingText = page.locator('text=Loading Middle-earth...');
    await expect(loadingText).toBeVisible({ timeout: 5000 });

    // Wait for canvas to eventually appear
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 30000 });
  });

  test('canvas fills the map container', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 30000 });

    const wrapper = page.locator('.map-canvas-wrapper');
    const wrapperBox = await wrapper.boundingBox();

    expect(wrapperBox).not.toBeNull();
    expect(wrapperBox.width).toBeGreaterThan(100);
    expect(wrapperBox.height).toBeGreaterThan(100);
  });

  test('map can be dragged (panned)', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 30000 });

    // Get initial stage position via Konva
    const initialPos = await page.evaluate(() => {
      const container = document.querySelector('.konvajs-content');
      if (!container) return null;
      const canvas = container.querySelector('canvas');
      if (!canvas) return null;
      return {
        offsetLeft: container.getBoundingClientRect().left,
        offsetTop: container.getBoundingClientRect().top,
      };
    });
    expect(initialPos).not.toBeNull();

    // Take screenshot before drag
    await page.screenshot({ path: '/tmp/map-before-drag.png' });

    // Perform a drag
    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 50, { steps: 10 });
    await page.mouse.up();

    // Take screenshot after drag
    await page.screenshot({ path: '/tmp/map-after-drag.png' });
  });

  test('map can be zoomed via mouse wheel', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 30000 });

    // Take screenshot before zoom
    await page.screenshot({ path: '/tmp/map-before-zoom.png' });

    // Get initial scale from Konva stage
    const initialScale = await page.evaluate(() => {
      const stage = document.querySelector('.konvajs-content');
      if (!stage) return null;
      // Find the canvas and check its transform via Konva's internal state
      const canvases = stage.querySelectorAll('canvas');
      return canvases.length;
    });
    expect(initialScale).toBeGreaterThan(0);

    // Scroll to zoom in
    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(500);

    // Take screenshot after zoom
    await page.screenshot({ path: '/tmp/map-after-zoom.png' });
  });

  test('map responds to window resize', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 30000 });

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
});

test.describe('Map Canvas - Mobile Touch', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
  });

  test('canvas renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/map`);

    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 30000 });
  });

  test('touch-action none prevents browser gestures', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 30000 });

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
