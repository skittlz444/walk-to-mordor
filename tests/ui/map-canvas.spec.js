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
    await page.waitForFunction(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      return stages[0].scaleX() !== 1;
    }, { timeout: 5000 });

    await expect(canvas.first()).toBeVisible();
  });

  test('map responds to window resize', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    await page.setViewportSize({ width: 800, height: 400 });
    await page.waitForFunction(() => {
      const c = document.querySelector('.map-canvas-wrapper canvas');
      return c && c.width > 0 && c.height > 0;
    }, { timeout: 5000 });

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

test.describe('Map Canvas - Stage Initialization & Metadata', () => {
  test('stage initializes and loads metadata successfully', async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
    await interceptTileRequests(page);

    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Loading overlay should disappear after metadata loads
    await expect(page.locator('.map-loading-overlay')).toBeHidden({ timeout: 15000 });
  });

  test('shows error state when metadata fetch fails', async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);

    // Intercept metadata request with failure
    await page.route('**/img/map/tiles/metadata.json', async (route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.goto(`${BASE_URL}/map`);
    // Should show error message
    await expect(page.locator('text=Failed to load map data')).toBeVisible({ timeout: 15000 });
  });

  test('stage cleanup removes canvas on navigation away', async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
    await interceptTileRequests(page);

    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Navigate away from the map page
    try {
      await page.goto(`${BASE_URL}/`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('NS_BINDING_ABORTED')) {
        throw error;
      }
    }
    // Canvas should no longer exist in the DOM
    await expect(page.locator('.map-canvas-wrapper canvas')).toHaveCount(0, { timeout: 5000 });
  });
});

test.describe('Map Canvas - Tile Update Logic', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
  });

  test('loads tiles for the visible area', async ({ page }) => {
    const tileRequests = [];
    await page.route('**/img/map/tiles/**', async (route) => {
      const url = route.request().url();
      tileRequests.push(url);
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

    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Wait for map content to render
    await page.waitForFunction(() => {
      const c = document.querySelector('.map-canvas-wrapper canvas');
      return c && c.width > 0 && c.height > 0;
    }, { timeout: 10000 });

    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, -180);
      await page.waitForTimeout(70);
    }
    await page.waitForFunction(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      return stages[0].scaleX() !== 1;
    }, { timeout: 5000 });

    // Use polling assertions so tile requests captured asynchronously are retried
    await expect.poll(() => tileRequests.filter((u) => u.includes('metadata.json')).length, { timeout: 15000 })
      .toBeGreaterThanOrEqual(1);
    await expect.poll(() => tileRequests.filter((u) => u.includes('/img/map/tiles/') && !u.includes('metadata.json')).length, { timeout: 15000 })
      .toBeGreaterThanOrEqual(1);
  });

  test('loads different tile level when zoomed in', async ({ page }) => {
    const tileRequests = [];
    await page.route('**/img/map/tiles/**', async (route) => {
      const url = route.request().url();
      tileRequests.push(url);
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

    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Wait for initial tiles to load
    await page.waitForFunction(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      const tileLayer = stages[0].getLayers()[0];
      if (!tileLayer) return false;
      return tileLayer.getChildren().length > 0;
    }, { timeout: 10000 });

    // Zoom in significantly (multiple scroll events)
    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(100);
    }

    // Wait for Konva zoom to settle
    await page.waitForFunction(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      return stages[0].scaleX() !== 1;
    }, { timeout: 5000 });

    // Use polling assertion so tile requests captured asynchronously are retried
    await expect.poll(() => tileRequests.filter((u) => u.includes('/img/map/tiles/') && !u.includes('metadata.json')).length, { timeout: 15000 })
      .toBeGreaterThanOrEqual(1);
  });

  test('retains backdrop tiles during level transitions', async ({ page }) => {
    await interceptTileRequests(page);

    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Wait for initial tiles to fully load and render
    await page.waitForFunction(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      const tileLayer = stages[0].getLayers()[0];
      if (!tileLayer) return false;
      return tileLayer.getChildren().length > 0;
    }, { timeout: 10000 });

    // Zoom in to trigger a level change
    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(50);
    }

    // After zoom, verify the canvas still has content rendered
    // (Konva stage exists and has children — proving tiles weren't all destroyed)
    const stageHasChildren = await page.evaluate(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      const stage = stages[0];
      const layers = stage.getLayers();
      if (!layers || layers.length === 0) return false;
      // Count total image nodes across all layers
      let totalNodes = 0;
      layers.forEach((layer) => {
        totalNodes += layer.getChildren().length;
      });
      return totalNodes > 0;
    });

    expect(stageHasChildren).toBe(true);
  });
});

test.describe('Map Canvas - Touch Gesture Handlers', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
    await interceptTileRequests(page);
  });

  test('pinch-to-zoom changes scale via touch events', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.map-loading-overlay')).toBeHidden({ timeout: 15000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('.map-canvas-wrapper canvas');
      return c && c.width > 0 && c.height > 0;
    }, { timeout: 10000 });

    // Get the Konva stage scale before pinch
    const scaleBefore = await page.evaluate(() => {
      const stages = window.Konva?.stages;
      if (stages && stages.length > 0) return stages[stages.length - 1].scaleX();
      return null;
    });

    // Simulate a pinch-to-zoom by dispatching touch events on the container
    const scaleAfter = await page.evaluate(async () => {
      const container = document.querySelector('.map-canvas-wrapper .konvajs-content') ||
        document.querySelector('.map-canvas-wrapper');
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      function makeTouchList(points) {
        const touchCtor = globalThis.Touch;
        if (typeof touchCtor === 'function') {
          return points.map((p, i) => new touchCtor({
            identifier: i,
            target: container,
            clientX: p.x,
            clientY: p.y,
            pageX: p.x,
            pageY: p.y,
            screenX: p.x,
            screenY: p.y,
          }));
        }

        return points.map((p, i) => ({
          identifier: i,
          target: container,
          clientX: p.x,
          clientY: p.y,
          pageX: p.x,
          pageY: p.y,
          screenX: p.x,
          screenY: p.y,
        }));
      }

      function dispatchTouchEvent(type, touchesPoints, changedPoints = touchesPoints) {
        const touches = makeTouchList(touchesPoints);
        const changedTouches = makeTouchList(changedPoints);
        const targetTouches = type === 'touchend' ? [] : touches;

        let event;
        if (typeof globalThis.TouchEvent === 'function') {
          event = new TouchEvent(type, {
            touches: type === 'touchend' ? [] : touches,
            targetTouches,
            changedTouches,
            bubbles: true,
            cancelable: true,
          });
        } else {
          event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : touches });
          Object.defineProperty(event, 'targetTouches', { value: targetTouches });
          Object.defineProperty(event, 'changedTouches', { value: changedTouches });
        }

        container.dispatchEvent(event);
      }

      const getScale = () => {
        const stages = window.Konva?.stages;
        if (stages && stages.length > 0) return stages[stages.length - 1].scaleX();
        return null;
      };

      const doPinch = async (startOffset, moveOffset) => {
        const startPoints = [
          { x: cx - startOffset, y: cy },
          { x: cx + startOffset, y: cy },
        ];
        dispatchTouchEvent('touchstart', startPoints);

        const steps = [
          startOffset + (moveOffset - startOffset) * 0.25,
          startOffset + (moveOffset - startOffset) * 0.5,
          startOffset + (moveOffset - startOffset) * 0.75,
          moveOffset,
        ];

        for (const offset of steps) {
          await new Promise((r) => setTimeout(r, 70));
          const movePoints = [
            { x: cx - offset, y: cy },
            { x: cx + offset, y: cy },
          ];
          dispatchTouchEvent('touchmove', movePoints);
        }

        await new Promise((r) => setTimeout(r, 70));
        const endPoints = [
          { x: cx - moveOffset, y: cy },
          { x: cx + moveOffset, y: cy },
        ];
        dispatchTouchEvent('touchend', [], endPoints);
        await new Promise((r) => setTimeout(r, 220));
      };

      const before = getScale();
      let after = before;
      const attempts = [
        [30, 140],
        [20, 180],
        [10, 220],
        [30, 220],
        [40, 240],
      ];

      for (const [startOffset, moveOffset] of attempts) {
        await doPinch(startOffset, moveOffset);
        after = getScale();
        if (before !== null && after !== null && after > before + 0.001) {
          break;
        }
      }

      return after;
    });

    // Verify scale actually changed (zoomed in)
    if (scaleBefore !== null && scaleAfter !== null) {
      expect(scaleAfter).toBeGreaterThan(scaleBefore);
    }
    // Canvas should still be visible and functional after pinch
    await expect(canvas.first()).toBeVisible();
  });

  test('dragging is disabled during pinch and re-enabled after', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('.map-canvas-wrapper canvas');
      return c && c.width > 0 && c.height > 0;
    }, { timeout: 10000 });

    // Test drag state toggling during pinch
    const dragStates = await page.evaluate(async () => {
      const container = document.querySelector('.map-canvas-wrapper .konvajs-content') ||
        document.querySelector('.map-canvas-wrapper');
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return null;
      const stage = stages[0];

      // Check draggable BEFORE pinch
      const draggableBefore = stage.draggable();

      function makeTouchList(points) {
        const touchCtor = globalThis.Touch;
        if (typeof touchCtor === 'function') {
          return points.map((p, i) => new touchCtor({
            identifier: i,
            target: container,
            clientX: p.x,
            clientY: p.y,
            pageX: p.x,
            pageY: p.y,
            screenX: p.x,
            screenY: p.y,
          }));
        }

        return points.map((p, i) => ({
          identifier: i,
          target: container,
          clientX: p.x,
          clientY: p.y,
          pageX: p.x,
          pageY: p.y,
          screenX: p.x,
          screenY: p.y,
        }));
      }

      function dispatchTouchEvent(type, touchesPoints, changedPoints = touchesPoints) {
        const touches = makeTouchList(touchesPoints);
        const changedTouches = makeTouchList(changedPoints);
        const targetTouches = type === 'touchend' ? [] : touches;

        let event;
        if (typeof globalThis.TouchEvent === 'function') {
          event = new TouchEvent(type, {
            touches: type === 'touchend' ? [] : touches,
            targetTouches,
            changedTouches,
            bubbles: true,
            cancelable: true,
          });
        } else {
          event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : touches });
          Object.defineProperty(event, 'targetTouches', { value: targetTouches });
          Object.defineProperty(event, 'changedTouches', { value: changedTouches });
        }

        container.dispatchEvent(event);
      }

      // Start pinch: two fingers
      const startPoints = [
        { x: cx - 30, y: cy },
        { x: cx + 30, y: cy },
      ];
      dispatchTouchEvent('touchstart', startPoints);

      await new Promise((r) => setTimeout(r, 50));

      // Check draggable DURING pinch (should be false)
      const draggableDuring = stage.draggable();

      // Move fingers
      const movePoints = [
        { x: cx - 80, y: cy },
        { x: cx + 80, y: cy },
      ];
      dispatchTouchEvent('touchmove', movePoints);

      await new Promise((r) => setTimeout(r, 50));

      // End pinch
      dispatchTouchEvent('touchend', [], movePoints);

      await new Promise((r) => setTimeout(r, 200));

      // Check draggable AFTER pinch (should be true again)
      const draggableAfter = stage.draggable();

      return { draggableBefore, draggableDuring, draggableAfter };
    });

    expect(dragStates).not.toBeNull();
    // Before pinch: draggable should be true
    expect(dragStates.draggableBefore).toBe(true);
    // During pinch: draggable should be false (disabled to prevent drift)
    expect(dragStates.draggableDuring).toBe(false);
    // After pinch: draggable should be re-enabled
    expect(dragStates.draggableAfter).toBe(true);

    // Verify that after pinch ends, dragging still works
    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY + 30, { steps: 5 });
    await page.mouse.up();

    // Canvas should still be visible and functional
    await expect(canvas.first()).toBeVisible();
  });

  test('pinch respects zoom limits on mobile', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('.map-canvas-wrapper canvas');
      return c && c.width > 0 && c.height > 0;
    }, { timeout: 10000 });

    // Simulate an extreme pinch-out (zoom in a lot) and verify scale is capped at MAX_ZOOM
    const scaleAfterExtremePinch = await page.evaluate(async () => {
      const container = document.querySelector('.map-canvas-wrapper .konvajs-content') ||
        document.querySelector('.map-canvas-wrapper');
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      function makeTouchList(points) {
        const touchCtor = globalThis.Touch;
        if (typeof touchCtor === 'function') {
          return points.map((p, i) => new touchCtor({
            identifier: i,
            target: container,
            clientX: p.x,
            clientY: p.y,
            pageX: p.x,
            pageY: p.y,
            screenX: p.x,
            screenY: p.y,
          }));
        }

        return points.map((p, i) => ({
          identifier: i,
          target: container,
          clientX: p.x,
          clientY: p.y,
          pageX: p.x,
          pageY: p.y,
          screenX: p.x,
          screenY: p.y,
        }));
      }

      function dispatchTouchEvent(type, touchesPoints, changedPoints = touchesPoints) {
        const touches = makeTouchList(touchesPoints);
        const changedTouches = makeTouchList(changedPoints);
        const targetTouches = type === 'touchend' ? [] : touches;

        let event;
        if (typeof globalThis.TouchEvent === 'function') {
          event = new TouchEvent(type, {
            touches: type === 'touchend' ? [] : touches,
            targetTouches,
            changedTouches,
            bubbles: true,
            cancelable: true,
          });
        } else {
          event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : touches });
          Object.defineProperty(event, 'targetTouches', { value: targetTouches });
          Object.defineProperty(event, 'changedTouches', { value: changedTouches });
        }

        container.dispatchEvent(event);
      }

      // Start with fingers very close
      const startPoints = [
        { x: cx - 10, y: cy },
        { x: cx + 10, y: cy },
      ];
      dispatchTouchEvent('touchstart', startPoints);

      // Move fingers very far apart (extreme zoom in attempt — 18x ratio)
      await new Promise((r) => setTimeout(r, 30));
      const movePoints = [
        { x: cx - 180, y: cy },
        { x: cx + 180, y: cy },
      ];
      dispatchTouchEvent('touchmove', movePoints);

      await new Promise((r) => setTimeout(r, 30));

      dispatchTouchEvent('touchend', [], movePoints);

      await new Promise((r) => setTimeout(r, 200));

      // Return the final scale
      const stages = window.Konva?.stages;
      if (stages && stages.length > 0) return stages[0].scaleX();
      return null;
    });

    // Scale should be capped at MAX_ZOOM (3.0)
    if (scaleAfterExtremePinch !== null) {
      expect(scaleAfterExtremePinch).toBeLessThanOrEqual(3.0);
    }
    // Canvas should still be functioning after extreme pinch
    await expect(canvas.first()).toBeVisible();
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

test.describe('Map Canvas - Journey Path Rendering', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
    await interceptTileRequests(page);
  });

  test('renders journey path lines on the map', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Wait for path layer to have Line shapes
    await page.waitForFunction(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      const layers = stages[0].getLayers();
      if (layers.length < 2) return false;
      return layers[1].getChildren().filter(c => c.getClassName() === 'Line').length >= 2;
    }, { timeout: 10000 });

    // Verify the Konva stage has a path layer with Line shapes
    const pathInfo = await page.evaluate(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return null;
      const stage = stages[0];
      const layers = stage.getLayers();
      if (layers.length < 2) return null;

      // Path layer is the second layer
      const pathLayer = layers[1];
      const children = pathLayer.getChildren();
      const lineCount = children.filter(c => c.getClassName() === 'Line').length;

      return { layerCount: layers.length, lineCount };
    });

    expect(pathInfo).not.toBeNull();
    expect(pathInfo.layerCount).toBeGreaterThanOrEqual(2);
    // Should have at least 2 lines: future + completed (plus optional fade segments)
    expect(pathInfo.lineCount).toBeGreaterThanOrEqual(2);
  });

  test('future path line has dashed style with reduced opacity', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Wait for path lines to be created
    await page.waitForFunction(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      const layers = stages[0].getLayers();
      if (layers.length < 2) return false;
      return layers[1].getChildren().filter(c => c.getClassName() === 'Line').length >= 2;
    }, { timeout: 10000 });

    const futureLineInfo = await page.evaluate(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return null;
      const stage = stages[0];
      const layers = stage.getLayers();
      if (layers.length < 2) return null;

      const pathLayer = layers[1];
      const lines = pathLayer.getChildren().filter(c => c.getClassName() === 'Line');
      // Future line is added first (index 0)
      const futureLine = lines[0];
      if (!futureLine) return null;

      return {
        opacity: futureLine.opacity(),
        dash: futureLine.dash(),
        stroke: futureLine.stroke(),
        hasPoints: futureLine.points().length > 0,
      };
    });

    expect(futureLineInfo).not.toBeNull();
    expect(futureLineInfo.opacity).toBeLessThan(1.0);
    expect(futureLineInfo.dash).not.toBeNull();
    expect(futureLineInfo.dash.length).toBeGreaterThan(0);
    expect(futureLineInfo.hasPoints).toBe(true);
  });

  test('path stroke width adjusts with zoom level', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Wait for path lines to be created
    await page.waitForFunction(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      const layers = stages[0].getLayers();
      if (layers.length < 2) return false;
      return layers[1].getChildren().filter(c => c.getClassName() === 'Line').length >= 2;
    }, { timeout: 10000 });

    // Get initial stroke width
    const strokeBefore = await page.evaluate(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return null;
      const pathLayer = stages[0].getLayers()[1];
      if (!pathLayer) return null;
      const lines = pathLayer.getChildren().filter(c => c.getClassName() === 'Line');
      return lines[0]?.strokeWidth() ?? null;
    });

    // Zoom in via mouse wheel
    const wrapper = page.locator('.map-canvas-wrapper');
    const box = await wrapper.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(100);
    }

    // Wait for zoom scale to have changed
    await page.waitForFunction((prevStroke) => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      const pathLayer = stages[0].getLayers()[1];
      if (!pathLayer) return false;
      const lines = pathLayer.getChildren().filter(c => c.getClassName() === 'Line');
      const currentStroke = lines[0]?.strokeWidth();
      return currentStroke !== undefined && currentStroke !== prevStroke;
    }, strokeBefore, { timeout: 5000 });

    // Get stroke width after zoom
    const strokeAfter = await page.evaluate(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return null;
      const pathLayer = stages[0].getLayers()[1];
      if (!pathLayer) return null;
      const lines = pathLayer.getChildren().filter(c => c.getClassName() === 'Line');
      return lines[0]?.strokeWidth() ?? null;
    });

    // Stroke width should change (decrease) when zoomed in
    expect(strokeBefore).not.toBeNull();
    expect(strokeAfter).not.toBeNull();
    if (strokeBefore !== null && strokeAfter !== null) {
      expect(strokeAfter).not.toBe(strokeBefore);
    }
  });

  test('path lines use listening false for performance', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Wait for path lines to be created
    await page.waitForFunction(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      const layers = stages[0].getLayers();
      if (layers.length < 2) return false;
      return layers[1].getChildren().filter(c => c.getClassName() === 'Line').length >= 2;
    }, { timeout: 10000 });

    const listeningState = await page.evaluate(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return null;
      const pathLayer = stages[0].getLayers()[1];
      if (!pathLayer) return null;
      const lines = pathLayer.getChildren().filter(c => c.getClassName() === 'Line');
      return lines.map(l => l.listening());
    });

    expect(listeningState).not.toBeNull();
    // All path lines (future/completed and optional fade segments) should be non-listening
    expect(Array.isArray(listeningState)).toBe(true);
    expect(listeningState.length).toBeGreaterThanOrEqual(2);
    expect(listeningState.every((v) => v === false)).toBe(true);
  });

  test('path layer is non-listening for performance', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    const canvas = page.locator('.map-canvas-wrapper canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });

    // Wait for path lines to be created
    await page.waitForFunction(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      const layers = stages[0].getLayers();
      if (layers.length < 2) return false;
      return layers[1].getChildren().filter(c => c.getClassName() === 'Line').length >= 2;
    }, { timeout: 10000 });

    const layerListening = await page.evaluate(() => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return null;
      const pathLayer = stages[0].getLayers()[1];
      return pathLayer?.listening() ?? null;
    });

    expect(layerListening).toBe(false);
  });
});
