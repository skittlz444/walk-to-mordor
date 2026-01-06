// @ts-check
const { test, expect, setupTest } = require('./helpers/common');

// Helper to properly close popup with Firefox compatibility
async function closePopupRobust(page, closeButton) {
  // Use force:true to bypass overlay interception issues if needed, but try standard first
  try {
      await closeButton.click({ timeout: 2000 });
  } catch (e) {
      await closeButton.click({ force: true });
  }
  
  // Firefox may need more time for popup animations/transitions
  await page.waitForTimeout(500);
  
  // Wait for popup to actually close - Firefox sometimes has timing issues
  await page.waitForFunction(() => {
    const popup = document.querySelector('.modal-overlay');
    return !popup || window.getComputedStyle(popup).display === 'none' || 
           popup.style.display === 'none' || !popup.offsetParent;
  }, { timeout: 10000 });
  
  await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 5000 });
}

/**
 * UI Tests - Profile Modal Functionality
 */
test.describe('User Profile Modal', () => {
    test.setTimeout(60000); // 60 seconds

    test.beforeEach(async ({ page, authToken }) => {
        await setupTest({ page, authToken });
        await page.waitForSelector('header', { timeout: 10000 });
    });

    test('should display Profile button in header', async ({ page }) => {
        // Verify Profile button exists in header
        const profileBtn = page.locator('#profile-btn');
        await expect(profileBtn).toBeVisible();
        await expect(profileBtn).toHaveText('Profile');
    });

    test('should open profile modal when clicking Profile button', async ({ page }) => {
        // Click Profile button
        await page.click('#profile-btn');

        // Verify modal is displayed
        await expect(page.locator('.modal-overlay')).toBeVisible();
        await expect(page.locator('.modal-title')).toHaveText('User Profile');

        // Verify form fields are present
        await expect(page.locator('#profile-username')).toBeVisible();
        await expect(page.locator('#profile-email')).toBeVisible();

        // Verify buttons are present
        await expect(page.locator('#save-profile-btn')).toHaveText('Save Changes');
        await expect(page.locator('#logout-modal-btn')).toHaveText('Logout');
        await expect(page.locator('#cancel-profile-btn')).toHaveText('Cancel');
    });

    test('should close modal when clicking Cancel button', async ({ page }) => {
        // Open modal
        await page.click('#profile-btn');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Click Cancel using robust closing
        const cancelBtn = page.locator('#cancel-profile-btn');
        await closePopupRobust(page, cancelBtn);
    });

    test('should close modal when clicking close (X) button', async ({ page }) => {
        // Open modal
        await page.click('#profile-btn');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Click close button using robust closing
        const closeBtn = page.locator('#close-profile-modal');
        await closePopupRobust(page, closeBtn);
    });

    test('should close modal when clicking overlay background', async ({ page }) => {
        // Open modal
        await page.click('#profile-btn');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Click on overlay (not on the dialog)
        // force: true ensures we click even if playwight thinks it's being intercepted (which is ironic here as we ARE the interceptor)
        await page.click('.modal-overlay', { position: { x: 5, y: 5 }, force: true });

        // Verify modal is closed
        await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 10000 });
        
        // Robust wait for Firefox
        await page.waitForFunction(() => {
          const popup = document.querySelector('.modal-overlay');
          return !popup || window.getComputedStyle(popup).display === 'none' || 
                 popup.style.display === 'none' || !popup.offsetParent;
        }, { timeout: 10000 });
    });

    test('should display current username and email in form fields', async ({ page, authToken }) => {
        // Extract username from test token
        const username = authToken.replace('TEST_MOCK_TOKEN_', '');
        const expectedEmail = `${username}@example.com`;

        // Open modal
        await page.click('#profile-btn');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Verify current values
        const usernameValue = await page.inputValue('#profile-username');
        const emailValue = await page.inputValue('#profile-email');

        expect(usernameValue).toBe(username);
        expect(emailValue).toBe(expectedEmail);
    });

    test('should update username successfully', async ({ page, authToken }) => {
        // Open modal
        await page.click('#profile-btn');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Get current username from input
        const originalUsername = await page.inputValue('#profile-username');

        // Update username (keeping same email)
        const newUsername = 'updateduser_' + Math.random().toString(36).substring(7);
        await page.fill('#profile-username', newUsername);

        // Save changes
        await page.click('#save-profile-btn');

        // Wait for success message
        await expect(page.locator('.success-message')).toBeVisible();
        await expect(page.locator('.success-message')).toContainText('Profile updated successfully');
    });

    test('should update email successfully', async ({ page }) => {
        // Open modal
        await page.click('#profile-btn');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Update email
        const newEmail = 'newemail_' + Math.random().toString(36).substring(7) + '@example.com';
        await page.fill('#profile-email', newEmail);

        // Save changes
        await page.click('#save-profile-btn');

        // Wait for success message
        await expect(page.locator('.success-message')).toBeVisible();
        await expect(page.locator('.success-message')).toContainText('Profile updated successfully');

        // Wait for modal to close properly (accounting for Firefox timing)
        await page.waitForTimeout(1000); // Allow fade out to start
        await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 10000 });

        // Reopen modal to verify update
        await page.click('#profile-btn');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        const updatedEmail = await page.inputValue('#profile-email');
        expect(updatedEmail).toBe(newEmail);
    });

    test('should update both username and email successfully', async ({ page }) => {
        // Open modal
        await page.click('#profile-btn');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Update both fields
        const newUsername = 'fullupdate_' + Math.random().toString(36).substring(7);
        const newEmail = 'fullupdate_' + Math.random().toString(36).substring(7) + '@example.com';

        await page.fill('#profile-username', newUsername);
        await page.fill('#profile-email', newEmail);
        
        // Wait for inputs to settle
        await page.waitForTimeout(500);

        // Save changes
        await page.click('#save-profile-btn');

        // Wait for success message
        await expect(page.locator('.success-message')).toBeVisible({ timeout: 20000 });
        await expect(page.locator('.success-message')).toContainText('Profile updated successfully');
    });

    test('should show error for invalid email format', async ({ page }) => {
        // Open modal
        await page.click('#profile-btn');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Enter invalid email
        await page.fill('#profile-email', 'invalid-email');
        // Clear username to ensure we isolate email validation and avoid any pre-existing username issues
        await page.fill('#profile-username', '');

        // Save changes
        await page.click('#save-profile-btn', { force: true });

        // Wait for error message
        await expect(page.locator('.error-message')).toBeVisible();
        await expect(page.locator('.error-message')).toContainText('Invalid email format');
    });

    test('should show error for invalid username format', async ({ page }) => {
        // Open modal
        await page.click('#profile-btn');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Enter invalid username (too short)
        await page.fill('#profile-username', 'ab');

        // Save changes
        await page.click('#save-profile-btn');

        // Wait for error message
        await expect(page.locator('.error-message')).toBeVisible();
        await expect(page.locator('.error-message')).toContainText('Invalid username');
    });

    test('should show error when no fields are provided', async ({ page }) => {
        // Open modal
        await page.click('#profile-btn');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Clear both fields
        await page.fill('#profile-username', '');
        await page.fill('#profile-email', '');

        // Save changes
        await page.click('#save-profile-btn');

        // Wait for error message
        await expect(page.locator('.error-message')).toBeVisible();
        await expect(page.locator('.error-message')).toContainText('at least one field');
    });

    test('should have logout button in profile modal', async ({ page }) => {
        // Open modal
        await page.click('#profile-btn');
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Verify logout button exists
        const logoutBtn = page.locator('#logout-modal-btn');
        await expect(logoutBtn).toBeVisible();
        await expect(logoutBtn).toHaveText('Logout');
        await expect(logoutBtn).toHaveClass(/btn-danger/);
    });
});
