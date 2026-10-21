const { test, expect } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

/**
 * Helper: click on the first unlocked (listening) waypoint marker in the Konva canvas.
 * Uses Konva internal API to find the marker's screen position.
 * Returns true if a marker was found and clicked, false otherwise.
 */
async function clickUnlockedWaypoint(page, index = 0) {
  const clicked = await page.evaluate((idx) => {
    const stages = window.Konva && window.Konva.stages;
    if (!stages || !stages.length) return false;
    const stage = stages[0];
    const layers = stage.getLayers();
    if (layers.length < 3) return false;
    const markerLayer = layers[2];
    const rootGroups = markerLayer.getChildren();
    const wpGroup = rootGroups.find(
      (g) => g.x() === 0 && g.y() === 0 && g.children && g.children.length > 3,
    );
    if (!wpGroup) return false;
    const listening = wpGroup.children.filter((c) => c.listening());
    if (idx >= listening.length) return false;
    const wp = listening[idx];
    // Fire Konva click directly to avoid coordinate and timing flakiness.
    // Bubble enabled so stage/listeners receive the event consistently.
    wp.fire('click', undefined, true);
    return true;
  }, index);

  return clicked;
}

/**
 * Wait for the Konva map to be fully loaded with waypoint markers.
 * Polls the Konva stage for markers on the marker layer.
 */
async function waitForMapReady(page) {
  await page.waitForSelector('[data-island="MapIsland"][data-hydrated="true"]');
  await page.waitForSelector('.map-canvas-wrapper canvas');
  await page.waitForFunction(
    () => {
      const stages = window.Konva && window.Konva.stages;
      if (!stages || !stages.length) return false;
      const stage = stages[0];
      const layers = stage.getLayers();
      if (layers.length < 3) return false;
      const markerLayer = layers[2];
      const rootGroups = markerLayer.getChildren();
      const wpGroup = rootGroups.find(
        (g) => g.x() === 0 && g.y() === 0 && g.children && g.children.length > 3,
      );
      return !!wpGroup;
    },
  );
}

test.describe('Waypoint Detail Popup - Functional Tests', () => {
  // Desktop-only: the app renders `.waypoint-sheet` instead of `.waypoint-popup`
  // at mobile widths (e.g. Mobile Chrome's Pixel 5).
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
  });

  test('no popup visible on initial map load', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    await expect(page.locator('.waypoint-popup')).not.toBeVisible();
    await expect(page.locator('.waypoint-sheet')).not.toBeVisible();
  });

  test('clicking unlocked waypoint opens popup with correct content', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);

    // Desktop viewport (default 1280x720) always renders the HTML popup
    const popup = page.locator('.waypoint-popup');
    await expect(popup).toBeVisible();

    // Popup has role=dialog and aria-label
    await expect(popup).toHaveAttribute('role', 'dialog');
    const ariaLabel = await popup.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    await expect(popup.locator('.waypoint-popup-close')).toBeVisible();
  });

  test('X button closes popup', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);

    const popup = page.locator('.waypoint-popup');
    await expect(popup).toBeVisible();
    await popup.locator('.waypoint-popup-close').click();
    await expect(popup).not.toBeVisible();
  });

  test('ESC key closes popup', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);

    const popup = page.locator('.waypoint-popup');
    await expect(popup).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup).not.toBeVisible();
  });

  test('zoom wheel dismisses popup', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);

    const popup = page.locator('.waypoint-popup');
    await expect(popup).toBeVisible();
    const wrapper = await page.locator('.map-canvas-wrapper').boundingBox();
    await page.mouse.move(wrapper.x + wrapper.width / 2, wrapper.y + wrapper.height / 2);
    await page.mouse.wheel(0, -200);
    await expect(popup).not.toBeVisible();
  });

  test('drag/pan dismisses popup', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);

    const popup = page.locator('.waypoint-popup');
    await expect(popup).toBeVisible();
    const wrapper = await page.locator('.map-canvas-wrapper').boundingBox();
    await page.mouse.move(wrapper.x + 100, wrapper.y + 100);
    await page.mouse.down();
    await page.mouse.move(wrapper.x + 250, wrapper.y + 250, { steps: 10 });
    await page.mouse.up();
    await expect(popup).not.toBeVisible();
  });

  test('only one popup open at a time', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);

    const popup = page.locator('.waypoint-popup');
    await expect(popup).toBeVisible();
    const popupCount = await page.locator('.waypoint-popup').count();
    expect(popupCount).toBe(1);
  });

  test('popup is rendered as HTML overlay, not Konva', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);

    const popup = page.locator('.waypoint-popup');
    await expect(popup).toBeVisible();

    const isHTMLOverlay = await page.evaluate(() => {
      const popup = document.querySelector('.waypoint-popup');
      const konva = document.querySelector('.konvajs-content');
      return !!(popup && konva && !konva.contains(popup));
    });
    expect(isHTMLOverlay).toBe(true);
  });

  test('expand button opens goal modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);

    const popup = page.locator('.waypoint-popup');
    await expect(popup).toBeVisible();
    const expandBtn = page.locator('.waypoint-popup-expand');
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();

    // GoalModal should appear, popup should close
    const modal = page.locator('.modal-overlay');
    await expect(modal).toBeVisible();
    await expect(popup).not.toBeVisible();
  });
});

test.describe('Waypoint Popup - Mobile', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
  });

  test('mobile viewport shows bottom sheet instead of desktop popup', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    // A missing marker is a setup failure, not a skip
    expect(clicked).toBe(true);

    // Mobile always renders the bottom sheet, never the desktop popup
    const sheet = page.locator('.waypoint-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.waypoint-popup-title')).toBeVisible();
    await expect(page.locator('.waypoint-popup')).not.toBeVisible();
  });

  test('mobile sheet overlay click dismisses sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);

    const overlay = page.locator('.waypoint-sheet-overlay');
    await expect(overlay).toBeVisible();
    // Click on overlay area (top of screen, outside sheet)
    await page.mouse.click(187, 50);
    await expect(overlay).not.toBeVisible();
  });
});
