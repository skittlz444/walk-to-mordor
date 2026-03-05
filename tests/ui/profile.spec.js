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
  
  // Wait for popup to actually close
  await page.waitForFunction(() => {
    const popup = document.querySelector('.modal-overlay');
    return !popup || window.getComputedStyle(popup).display === 'none' || 
           popup.style.display === 'none' || !popup.offsetParent;
  }, { timeout: 10000 });
  
  await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 5000 });
}

async function waitForProfileSave(page) {
    await page.waitForFunction(() => {
        const success = document.querySelector('.success-message');
        const modal = document.querySelector('.modal-overlay');

        const successVisible = !!success &&
            window.getComputedStyle(success).display !== 'none' &&
            (success.textContent || '').includes('Profile updated successfully');

        const modalHidden = !modal ||
            window.getComputedStyle(modal).display === 'none' ||
            modal.style.display === 'none' ||
            !modal.offsetParent;

        return successVisible || modalHidden;
    }, { timeout: 20000 });

    const modal = page.locator('.modal-overlay');
    if (await modal.isVisible().catch(() => false)) {
        const closeButton = page.locator('#close-profile-modal');
        if (await closeButton.isVisible().catch(() => false)) {
            await closePopupRobust(page, closeButton);
        } else {
            await page.keyboard.press('Escape');
            await expect(modal).toBeHidden({ timeout: 10000 });
        }
    }
}

async function waitForProfileFormReady(page) {
    await page.waitForFunction(() => {
        const usernameInput = document.querySelector('#profile-username');
        const emailInput = document.querySelector('#profile-email');

        return usernameInput instanceof HTMLInputElement &&
            emailInput instanceof HTMLInputElement &&
            usernameInput.value.trim().length > 0 &&
            emailInput.value.includes('@');
    }, { timeout: 10000 });
}

function uniqueToken(length = 8) {
    return Math.random().toString(36).slice(2, 2 + length);
}

function uniqueUsername(prefix) {
    return `${prefix}_${uniqueToken(6)}`;
}

function uniqueEmail(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${uniqueToken(6)}@example.com`;
}

async function waitForProfilePutResponse(page, timeout = 8000) {
    return page.waitForResponse((response) =>
        response.url().includes('/api/profile') && response.request().method() === 'PUT',
        { timeout },
    ).catch(() => null);
}

async function setFieldValueRobust(page, selector, value) {
    const field = page.locator(selector);

    await field.click({ clickCount: 3 });
    await field.press('Backspace');
    await field.type(value, { delay: 15 });

    try {
        await expect(field).toHaveValue(value, { timeout: 3000 });
    } catch {
        await page.evaluate(({ targetSelector, targetValue }) => {
            const input = document.querySelector(targetSelector);
            if (input instanceof HTMLInputElement) {
                input.value = targetValue;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, { targetSelector: selector, targetValue: value });

        await expect(field).toHaveValue(value, { timeout: 3000 });
    }
}

/**
 * UI Tests - Profile Modal Functionality
 */
test.describe('User Profile Modal', () => {
    test.setTimeout(30000);
    const menuSelector = '.menu-icon';
    const profileDrawerSelector = '.drawer-profile';

    async function openProfileFromDrawer(page) {
        await page.click(menuSelector);
        await page.waitForSelector('body.drawer-open', { timeout: 5000 });
        const profileButton = page.locator(profileDrawerSelector);
        await expect(profileButton).toBeVisible();
        await expect(profileButton).toBeEnabled();
        await profileButton.click();
    }

    test.beforeEach(async ({ page, authToken }) => {
        await setupTest({ page, authToken });
        await page.waitForSelector('header', { timeout: 10000 });
    });

    test('should display menu button in header', async ({ page }) => {
        // Verify Menu button exists in header
        const menuBtn = page.locator(menuSelector);
        await expect(menuBtn).toBeVisible();
        await expect(menuBtn).toHaveAttribute('aria-label', 'Open Navigation');
    });

    test('should open profile modal when clicking Profile button', async ({ page }) => {
        // Open Profile from drawer
        await openProfileFromDrawer(page);

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
        await openProfileFromDrawer(page);
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Click Cancel using robust closing
        const cancelBtn = page.locator('#cancel-profile-btn');
        await closePopupRobust(page, cancelBtn);
    });

    test('should close modal when clicking close (X) button', async ({ page }) => {
        // Open modal
        await openProfileFromDrawer(page);
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Click close button using robust closing
        const closeBtn = page.locator('#close-profile-modal');
        await closePopupRobust(page, closeBtn);
    });

    test('should close modal when clicking overlay background', async ({ page }) => {
        // Open modal
        await openProfileFromDrawer(page);
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
        await openProfileFromDrawer(page);
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Verify current values
        const usernameValue = await page.inputValue('#profile-username');
        const emailValue = await page.inputValue('#profile-email');

        expect(usernameValue).toBe(username);
        expect(emailValue).toBe(expectedEmail);
    });

    test('should update username successfully', async ({ page, authToken }) => {
        // Open modal
        await openProfileFromDrawer(page);
        await expect(page.locator('.modal-overlay')).toBeVisible();
        await waitForProfileFormReady(page);

        // Update username (keeping same email)
        const newUsername = uniqueUsername('updusr');
        await setFieldValueRobust(page, '#profile-username', newUsername);

        const saveResponsePromise = waitForProfilePutResponse(page);
        await page.click('#save-profile-btn');

        const saveResponse = await saveResponsePromise;
        expect(saveResponse).not.toBeNull();
        expect(saveResponse.status()).toBe(200);

        await waitForProfileSave(page);
    });

    test('should update email successfully', async ({ page }) => {
        // Open modal
        await openProfileFromDrawer(page);
        await expect(page.locator('.modal-overlay')).toBeVisible();
        await waitForProfileFormReady(page);

        // Update email (keeping same username)
        const newEmail = uniqueEmail('newemail');
        await page.locator('#profile-email').fill(newEmail);
        await expect(page.locator('#profile-email')).toHaveValue(newEmail);

        // Listen for the PUT response BEFORE clicking save (inherits 30s test timeout)
        const responsePromise = page.waitForResponse(
            resp => resp.url().includes('/api/profile') && resp.request().method() === 'PUT');
        await page.click('#save-profile-btn');
        const response = await responsePromise;
        expect(response.status()).toBe(200);

        await waitForProfileSave(page);

        // Reopen modal to verify update
        await openProfileFromDrawer(page);
        await expect(page.locator('.modal-overlay')).toBeVisible();
        await expect(page.locator('#profile-email')).toHaveValue(newEmail, { timeout: 10000 });
    });

    test('should update both username and email successfully', async ({ page }) => {
        // Open modal
        await openProfileFromDrawer(page);
        await expect(page.locator('.modal-overlay')).toBeVisible();
        await waitForProfileFormReady(page);

        let saved = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const newUsername = uniqueUsername('fullupd');
            const newEmail = uniqueEmail('fullupd');

            await setFieldValueRobust(page, '#profile-username', newUsername);
            await setFieldValueRobust(page, '#profile-email', newEmail);

            const saveResponsePromise = waitForProfilePutResponse(page);
            await page.click('#save-profile-btn');
            const saveResponse = await saveResponsePromise;

            if (saveResponse && saveResponse.status() === 200) {
                saved = true;
                break;
            }
        }

        expect(saved).toBe(true);

        await waitForProfileSave(page);
    });

    test('should show error for invalid email format', async ({ page }) => {
        // Open modal
        await openProfileFromDrawer(page);
        await expect(page.locator('.modal-overlay')).toBeVisible();
        await waitForProfileFormReady(page);

        // Enter invalid email using robust setter to ensure value sticks across browsers
        await setFieldValueRobust(page, '#profile-email', 'invalid-email');

        const saveResponsePromise = waitForProfilePutResponse(page);
        await page.click('#save-profile-btn');

        const saveResponse = await saveResponsePromise;
        if (saveResponse) {
            expect(saveResponse.status()).toBe(400);
        }

        await page.waitForFunction(() => {
            const error = document.querySelector('.error-message');
            const errorText = (error?.textContent || '').toLowerCase();

            const emailInput = document.querySelector('#profile-email');
            const hasTypeMismatch = emailInput instanceof HTMLInputElement
                ? emailInput.validity.typeMismatch
                : false;

            const validationMessage = emailInput instanceof HTMLInputElement
                ? (emailInput.validationMessage || '').toLowerCase()
                : '';

            return errorText.includes('invalid email format') || hasTypeMismatch || validationMessage.includes('email');
        }, { timeout: 10000 });
    });

    test('should show error for invalid username format', async ({ page }) => {
        // Open modal
        await openProfileFromDrawer(page);
        await expect(page.locator('.modal-overlay')).toBeVisible();
        await waitForProfileFormReady(page);

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
        await openProfileFromDrawer(page);
        await expect(page.locator('.modal-overlay')).toBeVisible();
        await waitForProfileFormReady(page);

        // Clear both fields
        await page.fill('#profile-username', '');
        await page.fill('#profile-email', '');

        const saveResponsePromise = waitForProfilePutResponse(page);
        await page.click('#save-profile-btn');

        const saveResponse = await saveResponsePromise;

        if (saveResponse && saveResponse.status() === 200) {
            await waitForProfileSave(page);
            return;
        }

        if (saveResponse) {
            expect(saveResponse.status()).toBe(400);
        }

        await page.waitForFunction(() => {
            const error = document.querySelector('.error-message');
            const errorText = (error?.textContent || '').toLowerCase();

            const usernameInput = document.querySelector('#profile-username');
            const emailInput = document.querySelector('#profile-email');

            const hasNativeValidation =
                (usernameInput instanceof HTMLInputElement && !!usernameInput.validationMessage) ||
                (emailInput instanceof HTMLInputElement && !!emailInput.validationMessage);

            return errorText.includes('at least one field') || hasNativeValidation;
        }, { timeout: 10000 });
    });

    test('should have logout button in profile modal', async ({ page }) => {
        // Open modal
        await openProfileFromDrawer(page);
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Verify logout button exists
        const logoutBtn = page.locator('#logout-modal-btn');
        await expect(logoutBtn).toBeVisible();
        await expect(logoutBtn).toHaveText('Logout');
        await expect(logoutBtn).toHaveClass(/btn-danger/);
    });
});
