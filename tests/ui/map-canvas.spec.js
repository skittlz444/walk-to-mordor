const { test, expect } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

test.describe('Map canvas - desktop interactions', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
    await page.goto(`${BASE_URL}/map`);
    await page.waitForSelector('.map-container canvas', { timeout: 10000 });
    await page.waitForFunction(() => Boolean(window.__mapDebug), undefined, {
      timeout: 10000,
    });
  });

  test('renders map, allows pan and zoom', async ({ page }) => {
    const container = page.locator('.map-container');
    const canvas = page.locator('.map-container canvas').first();
    const initialState = await page.evaluate(() => window.__mapDebug?.getState());

    await expect(container).toBeVisible();
    const initialScreenshot = await container.screenshot();
    expect(initialScreenshot.byteLength).toBeGreaterThan(0);

    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error('Canvas bounding box unavailable');
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 140, startY - 90, { steps: 8 });
    await page.mouse.up();

    const afterPan = await page.evaluate(() => window.__mapDebug?.getState());
    expect(afterPan.position.x).toBeLessThan(initialState.position.x);
    expect(afterPan.position.y).toBeLessThan(initialState.position.y);

    const panScreenshot = await container.screenshot();
    expect(panScreenshot.byteLength).toBeGreaterThan(0);

    await page.mouse.move(startX, startY);
    await page.mouse.wheel(0, -600);

    const afterZoom = await page.evaluate(() => window.__mapDebug?.getState());
    expect(afterZoom.scale).toBeGreaterThan(afterPan.scale);
    expect(afterZoom.scale).toBeLessThanOrEqual(3);

    const zoomScreenshot = await container.screenshot();
    expect(zoomScreenshot.byteLength).toBeGreaterThan(0);
  });
});

test.describe('Map canvas - touch interactions', () => {
  test.use({
    viewport: { width: 430, height: 932 },
    hasTouch: true,
  });

  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
    await page.goto(`${BASE_URL}/map`);
    await page.waitForSelector('.map-container canvas', { timeout: 10000 });
    await page.waitForFunction(() => Boolean(window.__mapDebug), undefined, {
      timeout: 10000,
    });
  });

  test('supports touch pan and pinch zoom', async ({ page }) => {
    const canvas = page.locator('.map-container canvas').first();
    const container = page.locator('.map-container');
    const initialState = await page.evaluate(() => window.__mapDebug?.getState());
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error('Canvas bounding box unavailable');
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const dragEndX = startX - 120;
    const dragEndY = startY - 80;

    await canvas.evaluate(
      (node, { startX, startY, endX, endY }) => {
        const target = node;
        const startTouch = new Touch({
          identifier: 1,
          target,
          clientX: startX,
          clientY: startY,
          pageX: startX,
          pageY: startY,
          screenX: startX,
          screenY: startY,
        });
        const moveTouch = new Touch({
          identifier: 1,
          target,
          clientX: endX,
          clientY: endY,
          pageX: endX,
          pageY: endY,
          screenX: endX,
          screenY: endY,
        });

        target.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            cancelable: true,
            touches: [startTouch],
            targetTouches: [startTouch],
            changedTouches: [startTouch],
          }),
        );
        target.dispatchEvent(
          new TouchEvent('touchmove', {
            bubbles: true,
            cancelable: true,
            touches: [moveTouch],
            targetTouches: [moveTouch],
            changedTouches: [moveTouch],
          }),
        );
        target.dispatchEvent(
          new TouchEvent('touchend', {
            bubbles: true,
            cancelable: true,
            touches: [],
            targetTouches: [],
            changedTouches: [moveTouch],
          }),
        );
      },
      { startX, startY, endX: dragEndX, endY: dragEndY },
    );

    const afterTouchPan = await page.evaluate(() => window.__mapDebug?.getState());
    expect(afterTouchPan.position.x).toBeLessThanOrEqual(initialState.position.x);
    expect(afterTouchPan.position.y).toBeLessThanOrEqual(initialState.position.y);

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await canvas.evaluate(
      (node, { centerX, centerY }) => {
        const target = node;
        const makeTouch = (id, dx, dy) =>
          new Touch({
            identifier: id,
            target,
            clientX: centerX + dx,
            clientY: centerY + dy,
            pageX: centerX + dx,
            pageY: centerY + dy,
            screenX: centerX + dx,
            screenY: centerY + dy,
          });

        const startOne = makeTouch(1, -30, -30);
        const startTwo = makeTouch(2, 30, 30);
        const moveOne = makeTouch(1, -80, -80);
        const moveTwo = makeTouch(2, 80, 80);

        target.dispatchEvent(
          new TouchEvent('touchstart', {
            bubbles: true,
            cancelable: true,
            touches: [startOne, startTwo],
            targetTouches: [startOne, startTwo],
            changedTouches: [startOne, startTwo],
          }),
        );
        target.dispatchEvent(
          new TouchEvent('touchmove', {
            bubbles: true,
            cancelable: true,
            touches: [moveOne, moveTwo],
            targetTouches: [moveOne, moveTwo],
            changedTouches: [moveOne, moveTwo],
          }),
        );
        target.dispatchEvent(
          new TouchEvent('touchend', {
            bubbles: true,
            cancelable: true,
            touches: [],
            targetTouches: [],
            changedTouches: [moveOne, moveTwo],
          }),
        );
      },
      { centerX, centerY },
    );

    const afterPinch = await page.evaluate(() => window.__mapDebug?.getState());
    expect(afterPinch.scale).toBeGreaterThan(afterTouchPan.scale);
    expect(afterPinch.scale).toBeLessThanOrEqual(3);

    const pinchScreenshot = await container.screenshot();
    expect(pinchScreenshot.byteLength).toBeGreaterThan(0);
  });
});
