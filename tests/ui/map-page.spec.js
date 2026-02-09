const { test, expect, setupTest } = require('./helpers/common');

test.describe('Map Page - Story 2.1', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
  });

  test('should access map page when authenticated', async ({ page }) => {
    // Navigate to map page
    await page.goto('/map');
    
    // Verify page loads
    await expect(page).toHaveTitle(/Map - Walk to Mordor/i);
    
    // Check header is present
    await expect(page.locator('.map-header')).toBeVisible();
    await expect(page.locator('.map-header h1')).toHaveText('Middle-earth Map');
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    // Clear auth token
    await page.evaluate(() => localStorage.removeItem('sessionToken'));
    
    // Try to access map page
    await page.goto('/map');
    
    // Should redirect to login
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display hamburger menu icon in header', async ({ page }) => {
    await page.goto('/map');
    
    // Check hamburger icon is present
    const hamburgerIcon = page.locator('.hamburger-icon');
    await expect(hamburgerIcon).toBeVisible();
    // Just check the icon element exists, not its visibility (FontAwesome may load async)
    await expect(hamburgerIcon.locator('i')).toHaveClass(/fa-bars/);
  });

  test('should have map-root container for island hydration', async ({ page }) => {
    await page.goto('/map');
    
    // Check map-root container exists
    const mapRoot = page.locator('#map-root');
    await expect(mapRoot).toBeVisible();
    await expect(mapRoot).toHaveAttribute('data-island', 'MapIsland');
  });

  test('should display MapIsland placeholder content', async ({ page }) => {
    await page.goto('/map');
    
    // Wait for island to hydrate
    await page.waitForSelector('.map-island-container', { timeout: 5000 });
    
    // Check placeholder content
    await expect(page.locator('.map-placeholder')).toBeVisible();
    await expect(page.locator('.map-placeholder-content h2')).toHaveText('Interactive Map');
    await expect(page.locator('.map-placeholder-content')).toContainText('Middle-earth map canvas will render here');
  });

  test('should open drawer when hamburger is clicked', async ({ page }) => {
    await page.goto('/map');
    
    // Wait for page to be ready
    await page.waitForSelector('.hamburger-icon');
    
    // Drawer should not be active initially
    const drawer = page.locator('#drawer');
    await expect(drawer).not.toHaveClass(/active/);
    
    // Click hamburger to open drawer
    await page.click('.hamburger-icon');
    
    // Wait for drawer to become active (animation completes)
    await drawer.waitFor({ state: 'visible' });
    await expect(drawer).toHaveClass(/active/);
    
    // Overlay should be visible
    const overlay = page.locator('#drawer-overlay');
    await expect(overlay).toHaveClass(/active/);
  });

  test('should close drawer when close button is clicked', async ({ page }) => {
    await page.goto('/map');
    
    // Open drawer first
    await page.click('.hamburger-icon');
    const drawer = page.locator('#drawer');
    await expect(drawer).toHaveClass(/active/);
    
    // Click close button
    await page.click('.drawer-close');
    
    // Wait for drawer to be closed
    await expect(drawer).not.toHaveClass(/active/);
  });

  test('should close drawer when overlay is clicked', async ({ page }) => {
    await page.goto('/map');
    
    // Open drawer
    await page.click('.hamburger-icon');
    const drawer = page.locator('#drawer');
    await expect(drawer).toHaveClass(/active/);
    
    // Click overlay to close
    await page.click('#drawer-overlay');
    
    // Wait for drawer to be closed
    await expect(drawer).not.toHaveClass(/active/);
  });

  test('should close drawer when Escape key is pressed', async ({ page }) => {
    await page.goto('/map');
    
    // Open drawer
    await page.click('.hamburger-icon');
    const drawer = page.locator('#drawer');
    await expect(drawer).toHaveClass(/active/);
    
    // Press Escape key
    await page.keyboard.press('Escape');
    
    // Wait for drawer to be closed
    await expect(drawer).not.toHaveClass(/active/);
  });

  test('should have navigation links in drawer', async ({ page }) => {
    await page.goto('/map');
    
    // Open drawer
    await page.click('.hamburger-icon');
    const drawer = page.locator('#drawer');
    await expect(drawer).toHaveClass(/active/);
    
    // Check navigation links
    const dashboardLink = page.locator('.drawer-link[href="/"]');
    await expect(dashboardLink).toBeVisible();
    await expect(dashboardLink).toContainText('Dashboard');
    
    const mapLink = page.locator('.drawer-link[href="/map"]');
    await expect(mapLink).toBeVisible();
    await expect(mapLink).toContainText('Map');
    await expect(mapLink).toHaveClass(/active/); // Should be active on map page
  });

  test('should navigate to dashboard from drawer', async ({ page }) => {
    await page.goto('/map');
    
    // Open drawer
    await page.click('.hamburger-icon');
    const drawer = page.locator('#drawer');
    await expect(drawer).toHaveClass(/active/);
    
    // Click dashboard link
    await page.click('.drawer-link[href="/"]');
    
    // Should navigate to dashboard
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('should have map link in dashboard header', async ({ page }) => {
    // Go to dashboard
    await page.goto('/');
    
    // Check map link exists in header
    const mapLink = page.locator('.map-link');
    await expect(mapLink).toBeVisible();
    // Just check the icon element exists with correct class
    await expect(mapLink.locator('i')).toHaveClass(/fa-map/);
  });

  test('should navigate to map from dashboard header', async ({ page }) => {
    await page.goto('/');
    
    // Click map link
    await page.click('.map-link');
    
    // Should navigate to map page
    await page.waitForURL('/map');
    await expect(page).toHaveURL('/map');
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/map');
    
    // Check mobile layout
    await expect(page.locator('.map-header')).toBeVisible();
    await expect(page.locator('.hamburger-icon')).toBeVisible();
    
    // Check map container is responsive
    const mapContainer = page.locator('.map-island-container');
    await expect(mapContainer).toBeVisible();
  });
});
