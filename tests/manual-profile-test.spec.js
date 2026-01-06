// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Profile Modal Manual Test', () => {
  test('should open profile modal and take screenshots', async ({ page }) => {
    // Set up mock auth token
    const testToken = 'TEST_MOCK_TOKEN_manualtest_' + Math.random().toString(36).substring(7);
    
    console.log('1. Navigating to app and setting auth...');
    await page.goto('http://localhost:8787/');
    await page.evaluate((token) => {
      localStorage.setItem('sessionToken', token);
    }, testToken);
    
    await page.goto('http://localhost:8787/');
    await page.waitForSelector('header', { timeout: 10000 });
    
    console.log('2. Taking screenshot of main page with Profile button...');
    await page.screenshot({ path: '/tmp/01-main-page-with-profile-button.png', fullPage: true });
    
    console.log('3. Clicking Profile button...');
    const profileBtn = page.locator('#profile-btn');
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();
    
    await page.waitForSelector('.modal-overlay', { timeout: 5000 });
    
    console.log('4. Taking screenshot of Profile modal...');
    await page.screenshot({ path: '/tmp/02-profile-modal-open.png', fullPage: true });
    
    console.log('5. Verifying modal elements...');
    await expect(page.locator('.modal-title')).toHaveText('User Profile');
    await expect(page.locator('#profile-username')).toBeVisible();
    await expect(page.locator('#profile-email')).toBeVisible();
    await expect(page.locator('#save-profile-btn')).toHaveText('Save Changes');
    await expect(page.locator('#logout-modal-btn')).toHaveText('Logout');
    await expect(page.locator('#cancel-profile-btn')).toHaveText('Cancel');
    
    console.log('6. Filling in new values...');
    await page.fill('#profile-username', 'updateduser123');
    await page.fill('#profile-email', 'updated@example.com');
    
    console.log('7. Taking screenshot of filled form...');
    await page.screenshot({ path: '/tmp/03-profile-modal-filled.png', fullPage: true });
    
    console.log('8. Clicking Save Changes...');
    await page.click('#save-profile-btn');
    
    console.log('9. Waiting for success message...');
    await page.waitForSelector('.success-message:not(:empty)', { timeout: 5000 });
    
    console.log('10. Taking screenshot with success message...');
    await page.screenshot({ path: '/tmp/04-profile-modal-success.png', fullPage: true });
    
    await page.waitForTimeout(2000);
    
    console.log('11. Opening profile again to verify updates...');
    await page.click('#profile-btn');
    await page.waitForSelector('.modal-overlay', { timeout: 5000 });
    
    console.log('12. Taking screenshot of updated profile...');
    await page.screenshot({ path: '/tmp/05-profile-modal-updated-values.png', fullPage: true });
    
    const username = await page.inputValue('#profile-username');
    const email = await page.inputValue('#profile-email');
    
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    
    expect(username).toBe('updateduser123');
    expect(email).toBe('updated@example.com');
    
    console.log('\n✅ All screenshots saved to /tmp/');
    console.log('   - 01-main-page-with-profile-button.png');
    console.log('   - 02-profile-modal-open.png');
    console.log('   - 03-profile-modal-filled.png');
    console.log('   - 04-profile-modal-success.png');
    console.log('   - 05-profile-modal-updated-values.png');
  });
});
