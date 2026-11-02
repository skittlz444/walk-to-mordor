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

function fieldStatus(page, field) {
    return page.locator(`.form-group:has(#profile-${field}) .profile-field-status`);
}

/**
 * Counts `PUT /api/profile` requests so invalid/unchanged field values can be
 * proven never to reach the server.
 */
function trackProfilePutRequests(page) {
    /** @type {import('@playwright/test').Request[]} */
    const requests = [];
    const listener = (request) => {
        if (request.method() === 'PUT' && new URL(request.url()).pathname === '/api/profile') {
            requests.push(request);
        }
    };

    page.on('request', listener);

    return {
        requests,
        stop: () => page.off('request', listener),
    };
}

/**
 * Records every visible status transition of a field so the
 * "Saving…" → "Saved" sequence can be asserted without racing the response.
 */
async function recordFieldStatusTransitions(page, field) {
    await page.evaluate((selector) => {
        const status = document.querySelector(selector);
        window.__profileStatusTransitions = [];
        if (!status) {
            return;
        }

        const record = () => {
            window.__profileStatusTransitions.push((status.textContent || '').trim());
        };

        record();
        window.__profileStatusObserver?.disconnect();
        window.__profileStatusObserver = new MutationObserver(record);
        window.__profileStatusObserver.observe(status, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
        });
    }, `#profile-${field}-status`);
}

async function getFieldStatusTransitions(page) {
    return page.evaluate(() => window.__profileStatusTransitions || []);
}

/**
 * UI Tests - Profile View / Settings Split
 *
 * `/profile` is the read-only view; the editable form lives at
 * `/profile/settings` and saves username/email on blur.
 */
test.describe('User Profile Settings Page', () => {
    const menuSelector = '.menu-icon';
    const profileDrawerSelector = '.drawer-profile';

    async function openProfileFromDrawer(page) {
        await page.click(menuSelector);
        await page.waitForSelector('body.drawer-open');
        const profileLink = page.locator(profileDrawerSelector);
        await expect(profileLink).toBeVisible();
        await profileLink.click();
        // The drawer opens the read-only view; the editable form is on settings.
        await page.waitForURL('**/profile');
        await page.goto(BASE_URL + '/profile/settings', { waitUntil: 'domcontentloaded' });
        await waitForAuthenticated(page);
        await page.waitForSelector('[data-island="ProfileSettingsIsland"][data-hydrated="true"]', { timeout: 10000 });
        await dismissPwaInstallBanner(page);
        await waitForProfileFormReady(page);
    }

    async function navigateToProfile(page) {
        await page.goto(BASE_URL + '/profile/settings');
        await waitForAuthenticated(page);
        await page.waitForSelector('[data-island="ProfileSettingsIsland"][data-hydrated="true"]', { timeout: 10000 });
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

    test('should navigate to profile settings when clicking Profile link in drawer', async ({ page }) => {
        // Navigate from the drawer to the profile surfaces
        await openProfileFromDrawer(page);

        // Verify settings page is displayed
        await expect(page.locator('.profile-page')).toBeVisible();

        // Verify form fields are present
        await expect(page.locator('#profile-username')).toBeVisible();
        await expect(page.locator('#profile-email')).toBeVisible();

        // The styled Back to profile control is the only page-level action
        const backButton = page.locator('.profile-back-button');
        await expect(backButton).toBeVisible();
        await expect(backButton).toHaveAttribute('href', '/profile');

        // No Save or Cancel controls exist on the auto-saving settings page
        await expect(page.locator('#save-profile-btn')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Save Changes' })).toHaveCount(0);
        await expect(page.locator('#cancel-profile-btn')).toHaveCount(0);
    });

    test('should navigate back to the profile view when clicking Back to profile', async ({ page }) => {
        // Navigate to settings page
        await openProfileFromDrawer(page);
        await expect(page.locator('.profile-page')).toBeVisible();

        const backButton = page.locator('.profile-back-button');
        await expect(backButton).toBeVisible();
        await expect(backButton).toHaveAttribute('href', '/profile');

        const box = await backButton.boundingBox();
        expect(box, 'Back to profile button should be rendered').not.toBeNull();
        expect(box.height, 'Back to profile button should be at least 44px tall').toBeGreaterThanOrEqual(44);

        await backButton.click();

        // Should navigate to the read-only profile view
        await page.waitForURL(url => url.pathname === '/profile', { timeout: 5000 });
        await expect(page.locator('.party-page')).toBeVisible();
    });

    test('should display current username and email in form fields', async ({ page, authToken }) => {
        // Extract username from test token
        const username = authToken.replace('TEST_MOCK_TOKEN_', '');
        const expectedEmail = `${username}@example.com`;

        // Navigate to profile settings
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        // Verify current values
        const usernameValue = await page.inputValue('#profile-username');
        const emailValue = await page.inputValue('#profile-email');

        expect(usernameValue).toBe(username);
        expect(emailValue).toBe(expectedEmail);
    });

    test('should update username on blur with inline saved status', async ({ page }) => {
        // Navigate to profile settings
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        // Update username and save by blurring the field
        const newUsername = uniqueUsername('updusr');
        await setFieldValueRobust(page, '#profile-username', newUsername);
        await recordFieldStatusTransitions(page, 'username');

        const saveResponsePromise = waitForProfilePutResponse(page);
        await page.locator('#profile-username').blur();

        const saveResponse = await saveResponsePromise;
        expect(saveResponse, 'PUT /api/profile should be sent on blur').not.toBeNull();
        expect(saveResponse.status()).toBe(200);

        const status = fieldStatus(page, 'username');
        await expect(status).toHaveClass(/saved/);
        await expect(status).toHaveText('Saved');

        const transitions = await getFieldStatusTransitions(page);
        expect(transitions).toContain('Saving…');
        expect(transitions).toContain('Saved');

        // Status is announced inline, never through a global banner
        await expect(status).toHaveAttribute('role', 'status');
        await expect(page.locator('#profile-success')).toHaveCount(0);
        await expect(page.locator('#profile-error')).toHaveCount(0);
    });

    test('should update email on blur and persist across reload', async ({ page }) => {
        // Navigate to profile settings
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        // Update email and save by blurring the field
        const newEmail = uniqueEmail('newemail');
        await setFieldValueRobust(page, '#profile-email', newEmail);
        await expect(page.locator('#profile-email')).toHaveValue(newEmail);

        const responsePromise = waitForProfilePutResponse(page);
        await page.locator('#profile-email').blur();
        const response = await responsePromise;
        expect(response, 'PUT /api/profile should be sent on blur').not.toBeNull();
        expect(response.status()).toBe(200);

        const status = fieldStatus(page, 'email');
        await expect(status).toHaveClass(/saved/);
        await expect(status).toHaveText('Saved');

        // Reload profile settings page to verify update persisted
        await page.reload();
        await waitForAuthenticated(page);
        await page.waitForSelector('[data-island="ProfileSettingsIsland"][data-hydrated="true"]', { timeout: 10000 });
        await waitForProfileFormReady(page);
        await expect(page.locator('#profile-email')).toHaveValue(newEmail);
        // Status starts empty after a fresh load (no pre-rendered "Saved")
        await expect(fieldStatus(page, 'email')).toHaveText('');
    });

    test('should update both username and email on blur', async ({ page }) => {
        // Navigate to profile settings
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        const newEmail = uniqueEmail('fullupd');
        const newUsername = uniqueUsername('fullupd');

        // Email first: renaming the mock-auth user invalidates the token-derived
        // username, so the rename must be the final request in this test.
        await setFieldValueRobust(page, '#profile-email', newEmail);
        const emailResponsePromise = waitForProfilePutResponse(page);
        await page.locator('#profile-email').blur();
        const emailResponse = await emailResponsePromise;
        expect(emailResponse, 'PUT /api/profile should be sent for the email').not.toBeNull();
        expect(emailResponse.status()).toBe(200);
        await expect(fieldStatus(page, 'email')).toHaveClass(/saved/);

        await setFieldValueRobust(page, '#profile-username', newUsername);
        const usernameResponsePromise = waitForProfilePutResponse(page);
        await page.locator('#profile-username').blur();
        const usernameResponse = await usernameResponsePromise;
        expect(usernameResponse, 'PUT /api/profile should be sent for the username').not.toBeNull();
        expect(usernameResponse.status()).toBe(200);
        await expect(fieldStatus(page, 'username')).toHaveClass(/saved/);

        await expect(page.locator('#profile-email')).toHaveValue(newEmail);
        await expect(page.locator('#profile-username')).toHaveValue(newUsername);
    });

    test('should show inline error and send no request for invalid email format', async ({ page }) => {
        // Navigate to profile settings
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        const tracker = trackProfilePutRequests(page);

        try {
            // Enter invalid email and blur
            await setFieldValueRobust(page, '#profile-email', 'invalid-email');
            await page.locator('#profile-email').blur();

            const status = fieldStatus(page, 'email');
            await expect(status).toHaveClass(/error/);
            await expect(status).toContainText(/valid email/i);

            expect(tracker.requests, 'Invalid email must never be sent to the API').toHaveLength(0);
            await expect(page.locator('#profile-error')).toHaveCount(0);
            await expect(page.locator('#profile-success')).toHaveCount(0);
        } finally {
            tracker.stop();
        }
    });

    test('should show inline error and send no request for invalid username format', async ({ page }) => {
        // Navigate to profile settings
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        const tracker = trackProfilePutRequests(page);

        try {
            // Enter invalid username (too short) and blur
            await page.fill('#profile-username', 'ab');
            await page.locator('#profile-username').blur();

            const status = fieldStatus(page, 'username');
            await expect(status).toHaveClass(/error/);
            await expect(status).toContainText(/3-30 characters/i);

            expect(tracker.requests, 'Invalid username must never be sent to the API').toHaveLength(0);
            await expect(page.locator('#profile-error')).toHaveCount(0);
            await expect(page.locator('#profile-success')).toHaveCount(0);
        } finally {
            tracker.stop();
        }
    });

    test('should show inline errors and send no request for empty or whitespace-only fields', async ({ page }) => {
        // Navigate to profile settings
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        const tracker = trackProfilePutRequests(page);

        try {
            for (const blankValue of ['', '   ']) {
                // Empty and whitespace-only values both trim to empty
                await page.fill('#profile-username', blankValue);
                await page.locator('#profile-username').blur();
                await page.fill('#profile-email', blankValue);
                await page.locator('#profile-email').blur();

                await expect(fieldStatus(page, 'username')).toHaveClass(/error/);
                await expect(fieldStatus(page, 'email')).toHaveClass(/error/);
                expect(
                    tracker.requests,
                    `Fields blanked with ${JSON.stringify(blankValue)} must never be sent to the API`,
                ).toHaveLength(0);
            }

            await expect(page.locator('#profile-error')).toHaveCount(0);
        } finally {
            tracker.stop();
        }
    });

    test('should show server conflicts inline for duplicate username and email', async ({ page, authToken }) => {
        // Navigate to profile settings
        await navigateToProfile(page);
        await waitForProfileFormReady(page);

        const dupId = uniqueToken(8);
        const duplicateUsername = `dupe_${dupId}`;
        const duplicateEmail = `dupe_${dupId}@example.com`;

        const registerResponse = await page.request.post(BASE_URL + '/api/register', {
            data: {
                username: duplicateUsername,
                email: duplicateEmail,
                password: 'Password123!',
            },
        });
        expect(registerResponse.ok(), 'Duplicate fixture user should register').toBeTruthy();

        // Duplicate username is rejected by the server and shown inline
        await setFieldValueRobust(page, '#profile-username', duplicateUsername);
        const usernameResponsePromise = waitForProfilePutResponse(page);
        await page.locator('#profile-username').blur();
        const usernameResponse = await usernameResponsePromise;
        expect(usernameResponse, 'PUT /api/profile should be sent for the duplicate username').not.toBeNull();
        expect(usernameResponse.status()).toBe(409);

        const usernameStatus = fieldStatus(page, 'username');
        await expect(usernameStatus).toHaveClass(/error/);
        await expect(usernameStatus).toContainText(/username already exists/i);
        await expect(page.locator('#profile-error')).toHaveCount(0);

        // Restore the saved username so the email save is the only request in flight.
        // The 409 left the server-confirmed username untouched, so restoring it is a
        // no-op: the island sends no PUT. Wait for the username field to settle (its
        // status leaves "Saving…") before starting the email save, so no username
        // response can be mistaken for the email 409 below.
        const savedUsername = authToken.replace('TEST_MOCK_TOKEN_', '');
        await page.fill('#profile-username', savedUsername);
        await page.locator('#profile-username').blur();
        await expect(fieldStatus(page, 'username')).toHaveText('', { timeout: 5000 });

        // Duplicate email is rejected by the server and shown inline
        await setFieldValueRobust(page, '#profile-email', duplicateEmail);
        const emailResponsePromise = waitForProfilePutResponse(page);
        await page.locator('#profile-email').blur();
        const emailResponse = await emailResponsePromise;
        expect(emailResponse, 'PUT /api/profile should be sent for the duplicate email').not.toBeNull();
        expect(emailResponse.status()).toBe(409);

        const emailStatus = fieldStatus(page, 'email');
        await expect(emailStatus).toHaveClass(/error/);
        await expect(emailStatus).toContainText(/email already registered/i);
        await expect(page.locator('#profile-error')).toHaveCount(0);
    });

    test('should log out from the Account island on the settings page', async ({ page }) => {
        // Navigate to profile settings
        await navigateToProfile(page);

        // Wait for the Account island that owns the logout action
        await page.waitForSelector('[data-island="ProfileAccountIsland"][data-hydrated="true"]', { timeout: 10000 });
        const accountIsland = page.locator('[data-island="ProfileAccountIsland"]');
        const logoutBtn = accountIsland.locator('button:has-text("Logout")');

        await expect(logoutBtn).toBeVisible();
        await expect(logoutBtn).toHaveText('Logout');
        await expect(logoutBtn).toHaveClass(/btn-danger/);

        await logoutBtn.click();
        await page.waitForURL('**/login', { timeout: 10000 });
    });
});
