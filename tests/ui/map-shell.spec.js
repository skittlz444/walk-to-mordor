const { test, expect } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

test.describe('Map Shell (Authenticated)', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
  });

  test('drawer navigation and profile access', async ({ page, authToken }) => {
    await page.goto(`${BASE_URL}/map`);

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
      await page.evaluate((token) => {
        localStorage.setItem('sessionToken', token);
      }, authToken);
      await page.goto(`${BASE_URL}/journey`);
      await page.waitForURL('**/journey');
      await page.waitForLoadState('domcontentloaded');
    }

    const menuIcon = page.locator('.menu-icon');
    await expect(menuIcon).toBeVisible();
    await menuIcon.click();
    await page.waitForSelector('body.drawer-open');
    await page.click('.drawer-link:has-text("Map")');
    await page.waitForURL('**/map');
    await page.waitForLoadState('domcontentloaded');

    await expect(menuIcon).toBeVisible();
    await menuIcon.click();
    await page.waitForSelector('body.drawer-open');
    const profileButton = page.locator('.drawer-profile');
    await expect(profileButton).toBeVisible();
    await expect(profileButton).toBeEnabled();
    await profileButton.click();

    await expect(page.locator('.modal-overlay')).toBeVisible();
  });

  test('drawer opens and closes via backdrop and escape', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

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

  test('drawer links are not focusable when closed', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

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

  test('focus management on drawer open and close', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

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
