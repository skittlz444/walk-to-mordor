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

async function waitForPopupOrSheet(page, timeout = 5000) {
  await page.waitForFunction(
    () => {
      const popup = document.querySelector('.waypoint-popup');
      const sheet = document.querySelector('.waypoint-sheet');
      const overlay = document.querySelector('.waypoint-sheet-overlay');
      return !!(popup || sheet || overlay);
    },
    { timeout },
  );
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
    await waitForPopupOrSheet(page);

    // Popup or sheet should appear
    const popup = page.locator('.waypoint-popup');
    const sheet = page.locator('.waypoint-sheet');
    const hasPopup = await popup.count() > 0;
    const hasSheet = await sheet.count() > 0;
    expect(hasPopup || hasSheet).toBe(true);

    if (hasPopup) {
      const hasDetailTitle = await popup.locator('.waypoint-popup-title').count() > 0;
      const hasClusterTitle = await popup.locator('.cluster-list-title').count() > 0;
      expect(hasDetailTitle || hasClusterTitle).toBe(true);

      await expect(popup.locator('.waypoint-popup-close')).toBeVisible();

      // Popup has role=dialog and aria-label
      await expect(popup).toHaveAttribute('role', 'dialog');
      const ariaLabel = await popup.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    }
  });

  test('X button closes popup', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);
    await waitForPopupOrSheet(page);

    const popup = page.locator('.waypoint-popup');
    if (await popup.count() > 0) {
      await popup.locator('.waypoint-popup-close').click();
      await expect(popup).not.toBeVisible();
    }
  });

  test('ESC key closes popup', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);
    await waitForPopupOrSheet(page);

    const popup = page.locator('.waypoint-popup');
    const sheet = page.locator('.waypoint-sheet-overlay');
    const hasPopup = await popup.count() > 0;
    const hasSheet = await sheet.count() > 0;

    if (hasPopup || hasSheet) {
      await page.keyboard.press('Escape');
      await expect(popup).not.toBeVisible();
      await expect(sheet).not.toBeVisible();
    }
  });

  test('zoom wheel dismisses popup', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);
    await waitForPopupOrSheet(page);

    const popup = page.locator('.waypoint-popup');
    if (await popup.count() > 0) {
      const wrapper = await page.locator('.map-canvas-wrapper').boundingBox();
      await page.mouse.move(wrapper.x + wrapper.width / 2, wrapper.y + wrapper.height / 2);
      await page.mouse.wheel(0, -200);
      await expect(popup).not.toBeVisible();
    }
  });

  test('drag/pan dismisses popup', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);
    await waitForPopupOrSheet(page);

    const popup = page.locator('.waypoint-popup');
    if (await popup.count() > 0) {
      const wrapper = await page.locator('.map-canvas-wrapper').boundingBox();
      await page.mouse.move(wrapper.x + 100, wrapper.y + 100);
      await page.mouse.down();
      await page.mouse.move(wrapper.x + 250, wrapper.y + 250, { steps: 10 });
      await page.mouse.up();
      await expect(popup).not.toBeVisible();
    }
  });

  test('only one popup open at a time', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);
    await waitForPopupOrSheet(page);

    const popupCount = await page.locator('.waypoint-popup').count();
    expect(popupCount).toBeLessThanOrEqual(1);
  });

  test('popup is rendered as HTML overlay, not Konva', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);
    await waitForPopupOrSheet(page);

    const isHTMLOverlay = await page.evaluate(() => {
      const popup = document.querySelector('.waypoint-popup');
      const sheet = document.querySelector('.waypoint-sheet');
      const konva = document.querySelector('.konvajs-content');
      const overlay = popup || sheet;
      return !!(overlay && konva && !konva.contains(overlay));
    });
    expect(isHTMLOverlay).toBe(true);
  });

  test('popup CSS styles are injected at runtime', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const hasStyles = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          if (rules.some((r) => r.cssText && r.cssText.includes('.waypoint-popup'))) {
            return true;
          }
        } catch (_e) { /* cross-origin */ }
      }
      return false;
    });
    expect(hasStyles).toBe(true);
  });

  test('expand button opens goal modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    expect(clicked).toBe(true);
    await waitForPopupOrSheet(page);

    const expandBtn = page.locator('.waypoint-popup-expand');
    if (await expandBtn.count() > 0) {
      await expandBtn.click();

      // GoalModal should appear, popup should close
      const modal = page.locator('.modal-overlay');
      await expect(modal).toBeVisible();

      const popup = page.locator('.waypoint-popup');
      await expect(popup).not.toBeVisible();
    }
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
    if (!clicked) {
      test.skip();
      return;
    }
    await waitForPopupOrSheet(page);

    // Should show sheet overlay, not desktop popup
    const sheet = page.locator('.waypoint-sheet');
    const desktopPopup = page.locator('.waypoint-popup');

    const hasSheet = await sheet.count() > 0;
    const hasDesktop = await desktopPopup.count() > 0;

    if (hasSheet) {
      await expect(sheet).toBeVisible();
      await expect(sheet.locator('.waypoint-popup-title')).toBeVisible();
    }
    // Desktop popup should not be shown on mobile
    expect(hasDesktop).toBe(false);
  });

  test('mobile sheet overlay click dismisses sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/map`);
    await waitForMapReady(page);

    const clicked = await clickUnlockedWaypoint(page);
    if (!clicked) {
      test.skip();
      return;
    }
    await waitForPopupOrSheet(page);

    const overlay = page.locator('.waypoint-sheet-overlay');
    if (await overlay.count() > 0) {
      // Click on overlay area (top of screen, outside sheet)
      await page.mouse.click(187, 50);
      await expect(overlay).not.toBeVisible();
    }
  });
});
