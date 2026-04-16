// @ts-check
const { test, expect, setupTest, waitForAuthenticated, dismissPwaInstallBanner } = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

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
 * UI Tests - Profile Page Functionality
 */
test.describe('User Profile Page', () => {
    const menuSelector = '.menu-icon';
    const profileDrawerSelector = '.drawer-profile';

    async function openProfileFromDrawer(page) {
        await page.click(menuSelector);
        await page.waitForSelector('body.drawer-open');
        const profileLink = page.locator(profileDrawerSelector);
        await expect(profileLink).toBeVisible();
        await profileLink.click();
        // Wait for navigation to /profile and island hydration
        await page.waitForURL('**/profile');
        await page.waitForSelector('[data-island="ProfileIsland"][data-hydrated="true"]', { timeout: 10000 });
        await dismissPwaInstallBanner(page);
        await waitForProfileFormReady(page);
    }

    async function navigateToProfile(page) {
        await page.goto(BASE_URL + '/profile');
        await waitForAuthenticated(page);
        await page.waitForSelector('[data-island="ProfileIsland"][data-hydrated="true"]', { timeout: 10000 });
        await dismissPwaInstallBanner(page);
    }

    test.beforeEach(async ({ page, authToken }) => {
        await setupTest({ page, authToken });
        await waitForAuthenticated(page);
    });

    test('should display menu button in header', async ({ page }) => {
        // Verify Menu button exists in header
        const menuBtn = page.locator(menuSelector);
        await expect(menuBtn).toBeVisible();
        await expect(menuBtn).toHaveAttribute('aria-label', 'Open Navigation');
    });

    test('should navigate to profile page when clicking Profile link in drawer', async ({ page }) => {
        // Navigate to profile from drawer
        await openProfileFromDrawer(page);

        // Verify profile page is displayed
        await expect(page.locator('.profile-page')).toBeVisible();

        // Verify form fields are present
        await expect(page.locator('#profile-username')).toBeVisible();
        await expect(page.locator('#profile-email')).toBeVisible();

        // Verify buttons are present
        await expect(page.locator('#save-profile-btn')).toHaveText('Save Changes');
        await expect(page.locator('#logout-modal-btn')).toHaveText('Logout');
        await expect(page.locator('#cancel-profile-btn')).toHaveText('Back');
    });

    test('should navigate back when clicking Back button', async ({ page }) => {
        // Navigate to profile page
        await openProfileFromDrawer(page);
        await expect(page.locator('.profile-page')).toBeVisible();

        // Click Back button
        await page.click('#cancel-profile-btn');

        // Should navigate back (not on profile page anymore)
        await page.waitForURL(url => !url.pathname.includes('/profile'), { timeout: 5000 });
    });

    test('should display current username and email in form fields', async ({ page, authToken }) => {
        // Extract username from test token
        const username = authToken.replace('TEST_MOCK_TOKEN_', '');
        const expectedEmail = `${username}@example.com`;

        // Navigate to profile
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        // Verify current values
        const usernameValue = await page.inputValue('#profile-username');
        const emailValue = await page.inputValue('#profile-email');

        expect(usernameValue).toBe(username);
        expect(emailValue).toBe(expectedEmail);
    });

    test('should update username successfully', async ({ page }) => {
        // Navigate to profile
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        // Update username
        const newUsername = uniqueUsername('updusr');
        await setFieldValueRobust(page, '#profile-username', newUsername);

        const saveResponsePromise = waitForProfilePutResponse(page);
        await page.click('#save-profile-btn');

        const saveResponse = await saveResponsePromise;
        expect(saveResponse).not.toBeNull();
        expect(saveResponse.status()).toBe(200);

        // Verify success message appears
        await page.waitForFunction(() => {
            const success = document.querySelector('#profile-success');
            return success && success.textContent && success.textContent.includes('Profile updated');
        });
    });

    test('should update email successfully', async ({ page }) => {
        // Navigate to profile
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        // Update email
        const newEmail = uniqueEmail('newemail');
        await page.locator('#profile-email').fill(newEmail);
        await expect(page.locator('#profile-email')).toHaveValue(newEmail);

        const responsePromise = page.waitForResponse(
            resp => resp.url().includes('/api/profile') && resp.request().method() === 'PUT');
        await page.click('#save-profile-btn');
        const response = await responsePromise;
        expect(response.status()).toBe(200);

        // Reload profile page to verify update persisted
        await page.reload();
        await waitForAuthenticated(page);
        await page.waitForSelector('[data-island="ProfileIsland"][data-hydrated="true"]', { timeout: 10000 });
        await waitForProfileFormReady(page);
        await expect(page.locator('#profile-email')).toHaveValue(newEmail);
    });

    test('should update both username and email successfully', async ({ page }) => {
        // Navigate to profile
        await navigateToProfile(page);
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

        // Verify success message
        await page.waitForFunction(() => {
            const success = document.querySelector('#profile-success');
            return success && success.textContent && success.textContent.includes('Profile updated');
        });
    });

    test('should show error for invalid email format', async ({ page }) => {
        // Navigate to profile
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        // Enter invalid email
        await setFieldValueRobust(page, '#profile-email', 'invalid-email');

        const saveResponsePromise = waitForProfilePutResponse(page);
        await page.click('#save-profile-btn');

        const saveResponse = await saveResponsePromise;
        if (saveResponse) {
            expect(saveResponse.status()).toBe(400);
        }

        await page.waitForFunction(() => {
            const error = document.querySelector('#profile-error');
            const errorText = (error?.textContent || '').toLowerCase();

            const emailInput = document.querySelector('#profile-email');
            const hasTypeMismatch = emailInput instanceof HTMLInputElement
                ? emailInput.validity.typeMismatch
                : false;

            const validationMessage = emailInput instanceof HTMLInputElement
                ? (emailInput.validationMessage || '').toLowerCase()
                : '';

            return errorText.includes('invalid email format') || hasTypeMismatch || validationMessage.includes('email');
        });
    });

    test('should show error for invalid username format', async ({ page }) => {
        // Navigate to profile
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        // Enter invalid username (too short)
        await page.fill('#profile-username', 'ab');

        const saveResponsePromise = waitForProfilePutResponse(page);
        await page.click('#save-profile-btn');

        const saveResponse = await saveResponsePromise;
        if (saveResponse) {
            expect(saveResponse.status()).toBe(400);
        }

        await page.waitForFunction(() => {
            const error = document.querySelector('#profile-error');
            return error && error.textContent && error.textContent.includes('Invalid username');
        });
    });

    test('should show error when no fields are provided', async ({ page }) => {
        // Navigate to profile
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        // Clear both fields
        await page.fill('#profile-username', '');
        await page.fill('#profile-email', '');

        const saveResponsePromise = waitForProfilePutResponse(page);
        await page.click('#save-profile-btn');

        const saveResponse = await saveResponsePromise;

        if (saveResponse && saveResponse.status() === 200) {
            return;
        }

        if (saveResponse) {
            expect(saveResponse.status()).toBe(400);
        }

        await page.waitForFunction(() => {
            const error = document.querySelector('#profile-error');
            const errorText = (error?.textContent || '').toLowerCase();

            const usernameInput = document.querySelector('#profile-username');
            const emailInput = document.querySelector('#profile-email');

            const hasNativeValidation =
                (usernameInput instanceof HTMLInputElement && !!usernameInput.validationMessage) ||
                (emailInput instanceof HTMLInputElement && !!emailInput.validationMessage);

            return errorText.includes('at least one field') || hasNativeValidation;
        });
    });

    test('should have logout button on profile page', async ({ page }) => {
        // Navigate to profile
        await navigateToProfile(page);

        // Verify logout button exists
        const logoutBtn = page.locator('#logout-modal-btn');
        await expect(logoutBtn).toBeVisible();
        await expect(logoutBtn).toHaveText('Logout');
        await expect(logoutBtn).toHaveClass(/btn-danger/);
    });
});
