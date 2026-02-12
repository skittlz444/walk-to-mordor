const { test, expect } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

async function waitForMapReady(page) {
  const mapContainer = page.locator('.map-container');
  await expect(mapContainer).toHaveAttribute('data-map-ready', 'true');
  await expect(mapContainer.locator('canvas').first()).toBeVisible();
  return mapContainer;
}

function buildTouch(identifier, point) {
  return {
    identifier,
    clientX: point.x,
    clientY: point.y,
    screenX: point.x,
    screenY: point.y,
    pageX: point.x,
    pageY: point.y,
  };
}

async function dispatchTouchEvent(locator, type, touches) {
  await locator.dispatchEvent(type, {
    touches,
    targetTouches: touches,
    changedTouches: touches,
  });
}

test.describe('Map Canvas (Desktop)', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
  });

  test('renders, pans, and zooms the map canvas', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

    const mapContainer = await waitForMapReady(page);
    await expect(mapContainer).toHaveScreenshot('map-canvas-initial.png');

    const box = await mapContainer.boundingBox();
    expect(box).not.toBeNull();
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const initialX = Number(await mapContainer.getAttribute('data-map-x'));
    const initialY = Number(await mapContainer.getAttribute('data-map-y'));

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 160, start.y + 120);
    await page.mouse.up();

    const draggedX = Number(await mapContainer.getAttribute('data-map-x'));
    const draggedY = Number(await mapContainer.getAttribute('data-map-y'));
    expect(draggedX).not.toBe(initialX);
    expect(draggedY).not.toBe(initialY);
    await expect(mapContainer).toHaveScreenshot('map-canvas-after-drag.png');

    const initialScale = Number(await mapContainer.getAttribute('data-map-scale'));
    await page.mouse.wheel(0, -700);
    const zoomedScale = Number(await mapContainer.getAttribute('data-map-scale'));
    expect(zoomedScale).toBeGreaterThan(initialScale);
    await expect(mapContainer).toHaveScreenshot('map-canvas-after-zoom.png');
  });
});

test.describe('Map Canvas Touch (Phone)', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
  });

  test('supports pinch zoom and touch drag without navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const mapContainer = await waitForMapReady(page);

    const box = await mapContainer.boundingBox();
    expect(box).not.toBeNull();
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const startOffset = 40;
    const endOffset = 120;

    const initialScale = Number(await mapContainer.getAttribute('data-map-scale'));
    const startTouches = [
      buildTouch(0, { x: center.x - startOffset, y: center.y }),
      buildTouch(1, { x: center.x + startOffset, y: center.y }),
    ];
    const endTouches = [
      buildTouch(0, { x: center.x - endOffset, y: center.y }),
      buildTouch(1, { x: center.x + endOffset, y: center.y }),
    ];

    await dispatchTouchEvent(mapContainer, 'touchstart', startTouches);
    await dispatchTouchEvent(mapContainer, 'touchmove', endTouches);
    await dispatchTouchEvent(mapContainer, 'touchend', []);

    const zoomedScale = Number(await mapContainer.getAttribute('data-map-scale'));
    expect(zoomedScale).toBeGreaterThan(initialScale);
    await expect(mapContainer).toHaveScreenshot('map-canvas-phone-after-pinch.png');

    const initialX = Number(await mapContainer.getAttribute('data-map-x'));
    const initialY = Number(await mapContainer.getAttribute('data-map-y'));
    const dragStart = buildTouch(2, { x: center.x, y: center.y });
    const dragEnd = buildTouch(2, { x: center.x + 140, y: center.y + 90 });

    await dispatchTouchEvent(mapContainer, 'touchstart', [dragStart]);
    await dispatchTouchEvent(mapContainer, 'touchmove', [dragEnd]);
    await dispatchTouchEvent(mapContainer, 'touchend', []);

    const draggedX = Number(await mapContainer.getAttribute('data-map-x'));
    const draggedY = Number(await mapContainer.getAttribute('data-map-y'));
    expect(draggedX).not.toBe(initialX);
    expect(draggedY).not.toBe(initialY);
    await expect(page).toHaveURL(/\/map/);
  });
});

test.describe('Map Canvas Touch (Tablet)', () => {
  test.use({
    viewport: { width: 834, height: 1112 },
    hasTouch: true,
  });

  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
  });

  test('pinch zoom respects bounds on tablet viewport', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const mapContainer = await waitForMapReady(page);

    const box = await mapContainer.boundingBox();
    expect(box).not.toBeNull();
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    const initialScale = Number(await mapContainer.getAttribute('data-map-scale'));
    const startTouches = [
      buildTouch(0, { x: center.x - 50, y: center.y }),
      buildTouch(1, { x: center.x + 50, y: center.y }),
    ];
    const endTouches = [
      buildTouch(0, { x: center.x - 140, y: center.y }),
      buildTouch(1, { x: center.x + 140, y: center.y }),
    ];

    await dispatchTouchEvent(mapContainer, 'touchstart', startTouches);
    await dispatchTouchEvent(mapContainer, 'touchmove', endTouches);
    await dispatchTouchEvent(mapContainer, 'touchend', []);

    const zoomedScale = Number(await mapContainer.getAttribute('data-map-scale'));
    expect(zoomedScale).toBeGreaterThan(initialScale);
    await expect(mapContainer).toHaveScreenshot('map-canvas-tablet-after-pinch.png');
  });
});
