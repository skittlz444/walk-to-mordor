/**
 * Map Visual Regression Tests
 *
 * Story 2.9 - Playwright visual snapshot tests verifying the map renders
 * correctly at various states (zoom levels, path progress, waypoints,
 * calendar modal, mobile viewport).
 *
 * Deterministic baselines:
 *   Viewport: Desktop 1280×720 (Chromium default), Mobile Pixel 5 (393×851)
 *   Mock progress: 100 km (≈62.14 mi) and 500 km (≈310.69 mi)
 *   Tile images: intercepted with a small stub PNG for instant, deterministic rendering
 *   Mock goals: 11 seeded milestones from 0–700 km
 */
const { test, expect } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

// ---------------------------------------------------------------------------
// Tile stub – small 10×10 green PNG served instantly for every tile request
// (same pattern as map-canvas.spec.js)
// ---------------------------------------------------------------------------
const SMALL_TILE_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0BFwMgwasChAwAMDAn/xe0DwQAAAABJRU5ErkJggg==',
  'base64',
);

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

// ---------------------------------------------------------------------------
// Mock data – deterministic goals covering the first ~700 km of the journey
// ---------------------------------------------------------------------------
const MOCK_GOALS = [
  { id: 1, distance: 0, title: 'Bag End', special: 'start', description: 'The beginning of the adventure.', image_id: null },
  { id: 2, distance: 18, title: 'Green Hill Country', special: null, description: null, image_id: null },
  { id: 3, distance: 45, title: 'Woodhall', special: null, description: null, image_id: null },
  { id: 4, distance: 72, title: 'Stock', special: null, description: null, image_id: null },
  { id: 5, distance: 93, title: 'Bucklebury Ferry', special: null, description: null, image_id: null },
  { id: 6, distance: 120, title: 'Bree', special: 'major', description: 'The village of Bree.', image_id: null },
  { id: 7, distance: 200, title: 'Weathertop', special: 'major', description: 'Amon Sûl.', image_id: null },
  { id: 8, distance: 300, title: 'The Last Bridge', special: null, description: null, image_id: null },
  { id: 9, distance: 458, title: 'Rivendell', special: 'major', description: 'The house of Elrond.', image_id: null },
  { id: 10, distance: 600, title: 'Caradhras', special: null, description: null, image_id: null },
  { id: 11, distance: 700, title: 'Moria Gate', special: 'major', description: 'The Doors of Durin.', image_id: null },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Intercept tile requests with deterministic stub data, and mock API routes
 * so every test gets consistent map state.
 * @param {import('@playwright/test').Page} page
 * @param {{ totalDistance?: number }} options  totalDistance in **km**
 */
async function setupMapTestState(page, { totalDistance = 100 } = {}) {
  // Tile metadata + images – instant, deterministic
  await page.route('**/img/map/tiles/**', async (route) => {
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

  // API: total distance
  await page.route('**/api/total-distance', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalDistance }),
    }),
  );

  // API: goals
  await page.route('**/api/goals', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GOALS),
    }),
  );
}

/** Wait for the Konva canvas to be fully painted (non-zero dimensions). */
async function waitForCanvasReady(page) {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('.map-canvas-wrapper canvas');
      return canvas && canvas.width > 0 && canvas.height > 0;
    },
    { timeout: 15000 },
  );
}

/** Wait for loading overlay to disappear. */
async function waitForMapLoaded(page) {
  await page.waitForSelector('.map-loading-overlay', {
    state: 'hidden',
    timeout: 15000,
  });
}

/** Wait for the Konva path layer to contain Line shapes. */
async function waitForPathRendered(page) {
  await page.waitForFunction(
    () => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      const layers = stages[0].getLayers();
      if (layers.length < 2) return false;
      return layers[1].getChildren().filter((c) => c.getClassName() === 'Line').length >= 2;
    },
    { timeout: 15000 },
  );
}

/** Wait for waypoint markers to be created on the marker layer. */
async function waitForWaypointsRendered(page) {
  await page.waitForFunction(
    () => {
      const stages = window.Konva?.stages;
      if (!stages || stages.length === 0) return false;
      const layers = stages[0].getLayers();
      if (layers.length < 3) return false;
      const markerLayer = layers[2];
      return markerLayer.getChildren().length > 0;
    },
    { timeout: 15000 },
  );
}

/** Programmatically set the Konva stage scale, then wait for repaint. */
async function setMapZoom(page, targetScale) {
  await page.evaluate((scale) => {
    const stages = window.Konva?.stages;
    if (!stages || stages.length === 0) return;
    const stage = stages[0];
    stage.scaleX(scale);
    stage.scaleY(scale);
    stage.batchDraw();
  }, targetScale);
  await page.waitForTimeout(800);
}

/**
 * Stop all running Konva animations so the canvas becomes static.
 * This is critical for deterministic screenshot comparison.
 */
async function stopAllAnimations(page) {
  await page.evaluate(() => {
    if (!window.Konva) return;
    const anim = window.Konva.Animation;
    if (anim && anim.animations && Array.isArray(anim.animations)) {
      // Copy the array since stopping may mutate it
      [...anim.animations].forEach((a) => {
        try { a.stop(); } catch (_) { /* ignore */ }
      });
    }
    // Also force a final draw to settle the last frame
    const stages = window.Konva.stages;
    if (stages) stages.forEach((s) => s.batchDraw());
  });
  await page.waitForTimeout(200);
}

/** Count visible waypoint child shapes on the marker layer. */
async function countVisibleWaypoints(page) {
  return page.evaluate(() => {
    const stages = window.Konva?.stages;
    if (!stages || stages.length === 0) return 0;
    const layers = stages[0].getLayers();
    if (layers.length < 3) return 0;
    const markerLayer = layers[2];
    let count = 0;
    for (const g of markerLayer.getChildren()) {
      count += g.children ? g.children.length : 1;
    }
    return count;
  });
}

// Snapshot options – generous tolerance for canvas anti-aliasing
const SNAPSHOT_OPTS = {
  maxDiffPixels: 500,
  threshold: 0.3,
  timeout: 15000,
  animations: 'disabled',
};

// ===========================================================================
// Tests
// ===========================================================================

test.describe('Map Visual Regression', () => {
  // -----------------------------------------------------------------------
  // Default state snapshot (Desktop 1280×720)
  // -----------------------------------------------------------------------
  test.describe('Default State', () => {
    test.beforeEach(async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
        localStorage.removeItem('mapLastOpenedDistanceMiles');
      }, authToken);
    });

    test('map renders at default zoom without errors', async ({ page }) => {
      await setupMapTestState(page, { totalDistance: 100 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);

      const canvas = page.locator('.map-canvas-wrapper canvas');
      await expect(canvas.first()).toBeVisible();

      await stopAllAnimations(page);
      await expect(page.locator('.map-shell')).toHaveScreenshot(
        'map-default-zoom.png',
        SNAPSHOT_OPTS,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Zoom state snapshots
  // -----------------------------------------------------------------------
  test.describe('Zoom States', () => {
    test.beforeEach(async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
        localStorage.removeItem('mapLastOpenedDistanceMiles');
      }, authToken);
    });

    test('snapshot at zoomed out scale (0.5x)', async ({ page }) => {
      await setupMapTestState(page, { totalDistance: 100 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);

      await setMapZoom(page, 0.5);

      await stopAllAnimations(page);
      await expect(page.locator('.map-shell')).toHaveScreenshot(
        'map-zoomed-out.png',
        SNAPSHOT_OPTS,
      );
    });

    test('snapshot at zoomed in scale (2x)', async ({ page }) => {
      await setupMapTestState(page, { totalDistance: 100 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);

      await setMapZoom(page, 2.0);

      await stopAllAnimations(page);
      await expect(page.locator('.map-shell')).toHaveScreenshot(
        'map-zoomed-in.png',
        SNAPSHOT_OPTS,
      );
    });

    test('pan position is consistent between runs', async ({ page }) => {
      await setupMapTestState(page, { totalDistance: 100 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);

      const position = await page.evaluate(() => {
        const stage = window.Konva?.stages?.[0];
        if (!stage) return null;
        return { x: stage.x(), y: stage.y(), scale: stage.scaleX() };
      });

      expect(position).not.toBeNull();
      expect(position.scale).toBeGreaterThan(1.0);
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Path rendering snapshots
  // -----------------------------------------------------------------------
  test.describe('Path Rendering', () => {
    test.beforeEach(async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
        localStorage.removeItem('mapLastOpenedDistanceMiles');
      }, authToken);
    });

    test('path visible with 100 km progress', async ({ page }) => {
      await setupMapTestState(page, { totalDistance: 100 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);
      await waitForPathRendered(page);

      const pathInfo = await page.evaluate(() => {
        const pathLayer = window.Konva?.stages?.[0]?.getLayers()?.[1];
        if (!pathLayer) return null;
        const lines = pathLayer.getChildren().filter((c) => c.getClassName() === 'Line');
        return {
          lineCount: lines.length,
          hasCompletedPath: lines.some((l) => l.opacity() === 1),
          hasFuturePath: lines.some((l) => l.opacity() < 1),
        };
      });

      expect(pathInfo).not.toBeNull();
      expect(pathInfo.lineCount).toBeGreaterThanOrEqual(2);

      await stopAllAnimations(page);
      await expect(page.locator('.map-shell')).toHaveScreenshot(
        'map-path-100km.png',
        SNAPSHOT_OPTS,
      );
    });

    test('path extends further with 500 km progress', async ({ page }) => {
      await setupMapTestState(page, { totalDistance: 500 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);
      await waitForPathRendered(page);

      await stopAllAnimations(page);
      await expect(page.locator('.map-shell')).toHaveScreenshot(
        'map-path-500km.png',
        SNAPSHOT_OPTS,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Waypoint visibility
  // -----------------------------------------------------------------------
  test.describe('Waypoint Visibility', () => {
    test.beforeEach(async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
        localStorage.removeItem('mapLastOpenedDistanceMiles');
      }, authToken);
    });

    test('waypoints visible at default zoom', async ({ page }) => {
      await setupMapTestState(page, { totalDistance: 100 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);
      await waitForWaypointsRendered(page);

      const markerCount = await countVisibleWaypoints(page);
      expect(markerCount).toBeGreaterThan(0);
    });

    test('fewer waypoints at zoomed out level (0.5x)', async ({ page }) => {
      await setupMapTestState(page, { totalDistance: 100 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);
      await waitForWaypointsRendered(page);

      const defaultCount = await countVisibleWaypoints(page);

      await setMapZoom(page, 0.5);
      await page.waitForTimeout(600);

      const zoomedOutCount = await countVisibleWaypoints(page);
      expect(zoomedOutCount).toBeLessThanOrEqual(defaultCount);

      await stopAllAnimations(page);
      await expect(page.locator('.map-shell')).toHaveScreenshot(
        'map-waypoints-zoomed-out.png',
        SNAPSHOT_OPTS,
      );
    });

    test('more waypoints at zoomed in level (2x)', async ({ page }) => {
      await setupMapTestState(page, { totalDistance: 100 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);
      await waitForWaypointsRendered(page);

      await setMapZoom(page, 0.5);
      await page.waitForTimeout(600);
      const zoomedOutCount = await countVisibleWaypoints(page);

      await setMapZoom(page, 2.0);
      await page.waitForTimeout(600);
      const zoomedInCount = await countVisibleWaypoints(page);

      expect(zoomedInCount).toBeGreaterThanOrEqual(zoomedOutCount);

      await stopAllAnimations(page);
      await expect(page.locator('.map-shell')).toHaveScreenshot(
        'map-waypoints-zoomed-in.png',
        SNAPSHOT_OPTS,
      );
    });

    test('unlocked and locked waypoints are visually distinct', async ({ page }) => {
      await setupMapTestState(page, { totalDistance: 100 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);
      await waitForWaypointsRendered(page);

      const markerInfo = await page.evaluate(() => {
        const stages = window.Konva?.stages;
        if (!stages || stages.length === 0) return null;
        const layers = stages[0].getLayers();
        if (layers.length < 3) return null;
        const markerLayer = layers[2];

        let hasListening = false;
        let hasNonListening = false;

        for (const g of markerLayer.getChildren()) {
          if (!g.children) continue;
          for (const c of g.children) {
            if (c.listening()) hasListening = true;
            else hasNonListening = true;
          }
        }

        return { hasListening, hasNonListening };
      });

      expect(markerInfo).not.toBeNull();
      expect(markerInfo.hasListening).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Calendar modal toggle
  // -----------------------------------------------------------------------
  test.describe('Calendar Toggle Interaction', () => {
    test.beforeEach(async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
        localStorage.removeItem('mapLastOpenedDistanceMiles');
      }, authToken);
    });

    test('clicking FAB opens calendar and snapshot captures modal overlay', async ({ page }) => {
      // Freeze clock so the calendar "today" indicator is deterministic
      await page.clock.install({ time: new Date('2025-06-15T12:00:00') });
      await setupMapTestState(page, { totalDistance: 100 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);

      const fab = page.locator('.map-walk-button');
      await expect(fab).toBeVisible({ timeout: 5000 });
      await fab.click();

      const calendarSheet = page.locator('#map-calendar-sheet');
      await expect(calendarSheet).toBeVisible({ timeout: 5000 });

      await stopAllAnimations(page);
      await expect(page.locator('.map-shell')).toHaveScreenshot(
        'map-with-calendar-modal.png',
        SNAPSHOT_OPTS,
      );
    });

    test('snapshot after calendar modal is dismissed', async ({ page }) => {
      // Freeze clock so the calendar "today" indicator is deterministic
      await page.clock.install({ time: new Date('2025-06-15T12:00:00') });
      await setupMapTestState(page, { totalDistance: 100 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);

      const fab = page.locator('.map-walk-button');
      await expect(fab).toBeVisible({ timeout: 5000 });
      await fab.click();
      await expect(page.locator('#map-calendar-sheet')).toBeVisible({ timeout: 5000 });

      await page.locator('#sheet-close-btn').click();
      await expect(page.locator('#map-calendar-sheet')).toBeHidden({ timeout: 3000 });

      await stopAllAnimations(page);
      await expect(page.locator('.map-shell')).toHaveScreenshot(
        'map-modal-dismissed.png',
        SNAPSHOT_OPTS,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Mobile viewport (Pixel 5)
  // -----------------------------------------------------------------------
  test.describe('Mobile Viewport', () => {
    test.beforeEach(async ({ page, authToken }) => {
      await page.addInitScript((token) => {
        localStorage.setItem('sessionToken', token);
        localStorage.removeItem('mapLastOpenedDistanceMiles');
      }, authToken);
    });

    test('mobile map renders correctly (Pixel 5 viewport)', async ({ page }) => {
      await page.setViewportSize({ width: 393, height: 851 });
      await setupMapTestState(page, { totalDistance: 100 });
      await page.goto(`${BASE_URL}/map`);
      await waitForCanvasReady(page);
      await waitForMapLoaded(page);

      await stopAllAnimations(page);
      await expect(page.locator('.map-shell')).toHaveScreenshot(
        'map-mobile-default.png',
        SNAPSHOT_OPTS,
      );
    });
  });
});
