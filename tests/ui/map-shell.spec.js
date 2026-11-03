const { test, expect, navigateAuthenticated, waitForJourneyReady, createFellowship, dismissBadgeAwardModal } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

async function openDrawer(page) {
  await page.locator('.menu-icon').click();
  await page.waitForSelector('body.drawer-open');
  // The backdrop transitions in (opacity + visibility); wait until it is a
  // real hit-testable layer before probing what paints on top.
  await expect(page.locator('.drawer-backdrop')).toBeVisible();
  await expect(page.locator('.side-drawer')).toHaveAttribute('aria-hidden', 'false');
  // The drawer slides in over 0.2s; wait for its animations to finish so
  // callers measuring its bounding box read the settled position.
  await page.evaluate(() => Promise.all(
    document.querySelector('.side-drawer').getAnimations().map((a) => a.finished)
  ));
}

/**
 * Hit-test a point inside the given element and report what actually paints
 * there. The point is derived from the element's measured box, so the probe
 * adapts to any viewport width instead of hard-coding coordinates.
 */
async function probeOverlayHit(page, selector, edge = 'center') {
  return page.evaluate(({ selector, edge }) => {
    const target = document.querySelector(selector);
    if (!target) {
      return { targetFound: false, hitTarget: false, hitDrawer: false, topSelector: 'none', point: { x: 0, y: 0 } };
    }

    const rect = target.getBoundingClientRect();
    const rawX = edge === 'left' ? rect.left + 4 : rect.left + rect.width / 2;
    const x = Math.min(Math.max(rawX, 1), window.innerWidth - 1);
    const y = Math.min(Math.max(rect.top + rect.height / 2, 1), window.innerHeight - 1);
    const top = document.elementFromPoint(x, y);

    const describe = (node) => {
      if (!node) {
        return 'none';
      }
      const id = node.id ? `#${node.id}` : '';
      const classes = typeof node.className === 'string' && node.className.trim()
        ? `.${node.className.trim().split(/\s+/).join('.')}`
        : '';
      return `${node.tagName.toLowerCase()}${id}${classes}`;
    };

    return {
      targetFound: true,
      point: { x, y },
      topSelector: describe(top),
      hitTarget: Boolean(top && target.contains(top)),
      hitDrawer: Boolean(top && (top.closest('.side-drawer') || top.closest('.drawer-backdrop'))),
    };
  }, { selector, edge });
}

test.describe('Map Shell (Authenticated)', () => {
  test('drawer navigation and profile access', async ({ page, authToken }) => {
    await navigateAuthenticated(page, authToken, '/map');

    const menuButton = page.locator('.menu-icon');
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    await page.waitForSelector('body.drawer-open');

    await expect(page.locator('.drawer-link', { hasText: 'Journey' })).toBeVisible();
    await expect(page.locator('.drawer-link', { hasText: 'Map' })).toBeVisible();
    await expect(page.locator('.drawer-profile')).toBeVisible();

    await page.click('.drawer-link:has-text("Journey")');
    await page.waitForURL((url) => {
      return url.pathname.endsWith('/journey') || url.pathname.endsWith('/login');
    });
    await page.waitForLoadState('domcontentloaded');

    if (page.url().endsWith('/login')) {
      await navigateAuthenticated(page, authToken, '/journey');
    }

    await waitForJourneyReady(page);

    const menuIcon = page.locator('.menu-icon');
    await expect(menuIcon).toBeVisible();
    await menuIcon.click();
    await page.waitForSelector('body.drawer-open');
    await page.click('.drawer-link:has-text("Map")');

    await page.waitForURL((url) => {
      return url.pathname.endsWith('/map') || url.pathname.endsWith('/login');
    });
    await page.waitForLoadState('domcontentloaded');

    if (page.url().endsWith('/login')) {
      await navigateAuthenticated(page, authToken, '/map');
    }

    await expect(menuIcon).toBeVisible();
    await menuIcon.click();
    await page.waitForSelector('body.drawer-open');
    const profileButton = page.locator('.drawer-profile');
    await expect(profileButton).toBeVisible();
    await profileButton.click();

    await page.waitForURL('**/profile');
    await page.waitForSelector('[data-island="ProfileViewIsland"][data-hydrated="true"]', { timeout: 10000 });
    await expect(page.locator('.party-page')).toBeVisible();
  });

  test('drawer opens and closes via backdrop and escape', async ({ page, authToken }) => {
    await navigateAuthenticated(page, authToken, '/map');

    const menuButton = page.locator('.menu-icon');
    const backdrop = page.locator('.drawer-backdrop');
    const drawer = page.locator('.side-drawer');

    await menuButton.click();
    await page.waitForSelector('body.drawer-open');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');

    await backdrop.click({ position: { x: 5, y: 5 } });
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');

    await menuButton.click();
    await page.waitForSelector('body.drawer-open');
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
  });

  test('drawer links are not focusable when closed', async ({ page, authToken }) => {
    await navigateAuthenticated(page, authToken, '/map');

    const drawerLinks = page.locator('.side-drawer .drawer-link');
    const closeButton = page.locator('.side-drawer .drawer-close');

    await page.waitForFunction(() => {
      const drawer = document.querySelector('.side-drawer');
      return drawer && drawer.getAttribute('aria-hidden') === 'true';
    });

    const linkCount = await drawerLinks.count();
    for (let i = 0; i < linkCount; i += 1) {
      await expect(drawerLinks.nth(i)).toHaveAttribute('tabindex', '-1');
    }

    await expect(closeButton).toBeDisabled();
  });

  test('focus management on drawer open and close', async ({ page, authToken }) => {
    await navigateAuthenticated(page, authToken, '/map');

    const menuButton = page.locator('.menu-icon');
    const closeButton = page.locator('.side-drawer .drawer-close');

    // Initially, menu button should not have focus (page just loaded)
    // Open the drawer
    await menuButton.click();
    await page.waitForSelector('body.drawer-open');

    // Focus should move to the close button inside the drawer
    await expect(closeButton).toBeFocused();

    // Close the drawer via the close button
    await closeButton.click();
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);

    // Focus should return to the menu trigger button
    await expect(menuButton).toBeFocused();

    // Open drawer again
    await menuButton.click();
    await page.waitForSelector('body.drawer-open');

    // Focus should move to close button again
    await expect(closeButton).toBeFocused();

    // Close via backdrop
    await page.locator('.drawer-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);

    // Focus should return to the menu trigger button
    await expect(menuButton).toBeFocused();

    // Open drawer once more
    await menuButton.click();
    await page.waitForSelector('body.drawer-open');

    // Focus should move to close button
    await expect(closeButton).toBeFocused();

    // Close via Escape key
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);

    // Focus should return to the menu trigger button
    await expect(menuButton).toBeFocused();
  });

  test('open drawer paints above page overlays (party legend and calendar sheet)', async ({ page, request, authToken }) => {
    const fellowshipName = `Drawer Layer ${Date.now()}`;
    await createFellowship(request, authToken, fellowshipName);

    await navigateAuthenticated(page, authToken, '/map');
    await page.waitForSelector('[data-island="MapIsland"][data-hydrated="true"]', { timeout: 15000 });
    // The award modal can interleave with map hydration; wait for hydration
    // first, then close the modal so a slow award fetch cannot slip past.
    await dismissBadgeAwardModal(page);

    // Switch the social panel to the fellowship so the party legend renders.
    await page.locator('.map-social-toggle').click();
    const partyOption = page.locator('.map-party-option', { hasText: fellowshipName });
    await expect(partyOption).toBeVisible({ timeout: 10000 });
    await partyOption.click();

    const legend = page.locator('.map-legend');
    await expect(legend).toBeVisible({ timeout: 15000 });
    await expect(legend).toContainText(fellowshipName);

    await openDrawer(page);

    // Probe the legend's left edge, which stays outside the drawer panel even
    // when the drawer is 85vw wide on a narrow viewport.
    const drawerBox = await page.locator('.side-drawer').boundingBox();
    expect(drawerBox, 'drawer must be laid out while open').not.toBeNull();

    const legendHit = await probeOverlayHit(page, '.map-legend', 'left');
    expect(legendHit.targetFound, 'party legend must exist before probing').toBeTruthy();
    expect(legendHit.point.x, 'legend probe must not sit inside the drawer panel').toBeLessThan(drawerBox.x);
    expect(
      legendHit.hitTarget,
      `party legend painted above the open drawer at (${legendHit.point.x}, ${legendHit.point.y}); top element was ${legendHit.topSelector}`,
    ).toBe(false);
    expect(
      legendHit.hitDrawer,
      `expected the drawer or its backdrop at the legend probe, got ${legendHit.topSelector}`,
    ).toBe(true);

    // Close the drawer so the map FAB is clickable again, then repeat the
    // probe with the map calendar sheet (z-index 200) as the page overlay.
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);

    await page.locator('.map-walk-button').click();
    await expect(page.locator('#map-calendar-sheet')).toBeVisible({ timeout: 10000 });

    await openDrawer(page);

    // Probe the sheet's left edge: on narrow viewports the sheet centre sits
    // inside the drawer panel, which would let the drawer cover itself.
    const sheetHit = await probeOverlayHit(page, '#map-calendar-sheet', 'left');
    expect(sheetHit.targetFound, 'calendar sheet must exist before probing').toBeTruthy();
    expect(
      sheetHit.hitTarget,
      `calendar sheet painted above the open drawer at (${sheetHit.point.x}, ${sheetHit.point.y}); top element was ${sheetHit.topSelector}`,
    ).toBe(false);
    expect(
      sheetHit.hitDrawer,
      `expected the drawer or its backdrop over the calendar sheet, got ${sheetHit.topSelector}`,
    ).toBe(true);
  });
});

test.describe('Map Shell (Unauthenticated)', () => {
  test('redirects to login when session is missing', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/map`);

    expect(response).not.toBeNull();
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(400);

    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });
});
