const { test, expect } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

test.describe('Map Shell (Authenticated)', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('sessionToken', token);
    }, authToken);
  });

  test('drawer navigation and profile access', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

    const menuButton = page.locator('.menu-icon');
    await expect(menuButton).toBeVisible();

    await menuButton.click();
    await page.waitForSelector('body.drawer-open', { timeout: 5000 });

    await expect(page.locator('.drawer-link', { hasText: 'Journey' })).toBeVisible();
    await expect(page.locator('.drawer-link', { hasText: 'Map' })).toBeVisible();
    await expect(page.locator('.drawer-profile')).toBeVisible();

    await page.click('.drawer-link:has-text("Journey")');
    await page.waitForURL('**/');

    await page.click('.menu-icon');
    await page.waitForSelector('body.drawer-open', { timeout: 5000 });
    await page.click('.drawer-link:has-text("Map")');
    await page.waitForURL('**/map');

    await page.click('.menu-icon');
    await page.waitForSelector('body.drawer-open', { timeout: 5000 });
    await page.click('.drawer-profile');

    await expect(page.locator('.modal-overlay')).toBeVisible();
  });

  test('drawer opens and closes via backdrop and escape', async ({ page }) => {
    await page.goto(`${BASE_URL}/map`);

    const menuButton = page.locator('.menu-icon');
    const backdrop = page.locator('.drawer-backdrop');
    const drawer = page.locator('.side-drawer');

    await menuButton.click();
    await page.waitForSelector('body.drawer-open', { timeout: 5000 });
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');

    await backdrop.click();
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');

    await menuButton.click();
    await page.waitForSelector('body.drawer-open', { timeout: 5000 });
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
    await page.waitForSelector('body.drawer-open', { timeout: 5000 });

    // Focus should move to the close button inside the drawer
    await expect(closeButton).toBeFocused();

    // Close the drawer via the close button
    await closeButton.click();
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);

    // Focus should return to the menu trigger button
    await expect(menuButton).toBeFocused();

    // Open drawer again
    await menuButton.click();
    await page.waitForSelector('body.drawer-open', { timeout: 5000 });

    // Focus should move to close button again
    await expect(closeButton).toBeFocused();

    // Close via backdrop
    await page.click('.drawer-backdrop');
    await expect(page.locator('body')).not.toHaveClass(/drawer-open/);

    // Focus should return to the menu trigger button
    await expect(menuButton).toBeFocused();

    // Open drawer once more
    await menuButton.click();
    await page.waitForSelector('body.drawer-open', { timeout: 5000 });

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
