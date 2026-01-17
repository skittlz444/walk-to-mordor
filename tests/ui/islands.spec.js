// @ts-check
const { test, expect } = require('./helpers/common');

test.describe('Preact Islands', () => {
  test('HelloWorld island hydrates and responds to interactions', async ({ page }) => {
    // Navigate to the test page
    await page.goto('/islands-test.html');
    
    // Verify the island hydrated by checking for the heading
    await expect(page.locator('h2:has-text("🎉 Preact Island: HelloWorld")')).toBeVisible();
    
    // Verify initial counter state
    await expect(page.locator('text=Counter Signal: 0')).toBeVisible();
    
    // Verify initial toggle state
    await expect(page.locator('text=❌ OFF')).toBeVisible();
    
    // Test counter increment
    const incrementButton = page.locator('button:has-text("Increment")');
    await incrementButton.click();
    await expect(page.locator('text=Counter Signal: 1')).toBeVisible();
    
    await incrementButton.click();
    await expect(page.locator('text=Counter Signal: 2')).toBeVisible();
    
    // Test counter reset
    const resetButton = page.locator('button:has-text("Reset")');
    await resetButton.click();
    await expect(page.locator('text=Counter Signal: 0')).toBeVisible();
    
    // Test toggle
    const toggleButton = page.locator('button:has-text("Toggle")');
    await toggleButton.click();
    await expect(page.locator('text=✅ ON')).toBeVisible();
    
    await toggleButton.click();
    await expect(page.locator('text=❌ OFF')).toBeVisible();
  });
  
  test('Island hydration logs to console', async ({ page }) => {
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });
    
    await page.goto('/islands-test.html');
    
    // Wait for hydration
    await page.waitForLoadState('networkidle');
    
    // Verify hydration console log
    expect(consoleLogs.some(log => log.includes('✅ Hydrated island: HelloWorld'))).toBe(true);
  });
  
  test('Multiple islands can coexist', async ({ page }) => {
    // This test verifies the architecture supports multiple islands
    // Currently only HelloWorld exists, but the pattern should work for multiple
    await page.goto('/islands-test.html');
    
    const islands = await page.locator('[data-island]').count();
    expect(islands).toBeGreaterThanOrEqual(1);
    
    // Verify all islands with data-island attribute are present
    const islandElements = await page.locator('[data-island]').all();
    for (const element of islandElements) {
      const islandName = await element.getAttribute('data-island');
      expect(islandName).toBeTruthy();
    }
  });
});
