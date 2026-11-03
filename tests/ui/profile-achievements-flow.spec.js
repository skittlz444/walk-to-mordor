// @ts-check
const {
    test,
    expect,
    navigateAuthenticated,
    waitForAuthenticated,
    dismissPwaInstallBanner,
} = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

// A fresh user logging one 7000 km walk on a Monday (not a Sunday, so the
// weekly "Faithful Walker" habit cannot fire) earns `habit-first-steps` plus
// every Frodo/Sam journey badge up to `threshold_km <= 7000` — nine in total.
const SEED_DATE = '2026-11-02';
const SEED_DISTANCE = 7000;

const JOURNEY_SLUGS = [
    'journey-frodo-sam-buckleberry-ferry',
    'journey-frodo-sam-weathertop-survivor',
    'journey-frodo-sam-through-khazad-dum',
    'journey-frodo-sam-lothlorien-guest',
    'journey-frodo-sam-rauros-parting',
    'journey-frodo-sam-mordor-threshold',
    'journey-frodo-sam-home-at-sunset',
    'journey-frodo-sam-glittering-caves',
];

const EXPECTED_SLUGS = ['habit-first-steps', ...JOURNEY_SLUGS].sort();
const EXPECTED_BADGE_COUNT = EXPECTED_SLUGS.length;

function authHeaders(authToken) {
    return {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
    };
}

async function getAchievements(request, authToken) {
    const response = await request.get(`${BASE_URL}/api/achievements`, {
        headers: authHeaders(authToken),
    });
    expect(response.ok(), `GET /api/achievements failed (${response.status()})`).toBeTruthy();
    const body = await response.json();
    return body.achievements;
}

async function getPending(request, authToken) {
    const response = await request.get(`${BASE_URL}/api/achievements/pending`, {
        headers: authHeaders(authToken),
    });
    expect(response.ok(), `GET /api/achievements/pending failed (${response.status()})`).toBeTruthy();
    const body = await response.json();
    return body.pending;
}

async function waitForProfileSettingsForm(page) {
    await page.waitForFunction(() => {
        const emailInput = document.querySelector('#profile-email');
        return emailInput instanceof HTMLInputElement && emailInput.value.includes('@');
    }, { timeout: 10000 });
}

/**
 * Full profile/achievements branch flow:
 * award seeding → achievement + pending API truth → award modal queue →
 * duplicate-log idempotency → badge grid → view-only badge dialog →
 * view/settings split → avatar modal → friends regression smoke.
 */
test('profile achievements flow covers award queue, badge grid, settings split and avatar modal', async ({
    page,
    request,
    authToken,
}) => {
    const headers = authHeaders(authToken);

    // ---------------------------------------------------------------- 1. Seed
    const seedResponse = await request.post(`${BASE_URL}/api/calendar-progress`, {
        headers,
        data: { start: SEED_DATE, title: SEED_DISTANCE },
    });
    expect(
        seedResponse.ok(),
        `POST /api/calendar-progress failed (${seedResponse.status()}): ${await seedResponse.text()}`,
    ).toBeTruthy();

    // ------------------------------------------------- 2. API truth before UI
    const achievements = await getAchievements(request, authToken);
    expect(achievements, 'A 7000 km walk should award nine achievements').toHaveLength(
        EXPECTED_BADGE_COUNT,
    );
    for (const entry of achievements) {
        expect(entry.slug).toBeTruthy();
        expect(entry.earned_count).toBe(1);
    }
    expect(achievements.map((entry) => entry.slug).sort()).toEqual(EXPECTED_SLUGS);

    const earnedNames = achievements.map((entry) => entry.name);
    expect(earnedNames).toContain('First Steps');
    expect(earnedNames).toContain('Home Again at Sunset');
    expect(new Set(earnedNames).size).toBe(EXPECTED_BADGE_COUNT);

    const pendingBeforeAck = await getPending(request, authToken);
    expect(pendingBeforeAck, 'Every newly earned badge should be pending').toHaveLength(
        EXPECTED_BADGE_COUNT,
    );
    expect(new Set(pendingBeforeAck.map((entry) => entry.instance_id)).size).toBe(
        EXPECTED_BADGE_COUNT,
    );
    expect(pendingBeforeAck.map((entry) => entry.name).sort()).toEqual([...earnedNames].sort());

    // ------------------------------------- 3. Profile view + award modal queue
    await navigateAuthenticated(page, authToken, '/profile');
    await page.waitForSelector('[data-island="ProfileViewIsland"][data-hydrated="true"]', {
        timeout: 15000,
    });
    await dismissPwaInstallBanner(page);

    const awardContent = page.locator('.badge-award__content');
    await expect(awardContent).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.badge-award-dialog[role="dialog"]')).toBeVisible();
    await expect(page.locator('.badge-award__position')).toHaveText('Badge 1 of 9');

    const awardedNames = [];
    for (let index = 1; index <= EXPECTED_BADGE_COUNT; index += 1) {
        const position = page.locator('.badge-award__position');
        await expect(position).toHaveText(`Badge ${index} of ${EXPECTED_BADGE_COUNT}`, {
            timeout: 10000,
        });

        const name = ((await page.locator('.badge-award__name').textContent()) || '').trim();
        expect(name.length, `Badge ${index} of 9 should render a name`).toBeGreaterThan(0);
        awardedNames.push(name);

        const primary = page.locator('.badge-award__primary');
        await expect(primary).toBeEnabled();
        await expect(primary).toHaveText(
            index === EXPECTED_BADGE_COUNT ? 'Collect badge' : 'Continue',
        );
        await primary.click();

        if (index < EXPECTED_BADGE_COUNT) {
            // Wait for the acknowledged award to advance before reading the next name.
            await expect(position).toHaveText(
                `Badge ${index + 1} of ${EXPECTED_BADGE_COUNT}`,
                { timeout: 10000 },
            );
        }
    }

    await expect(awardContent, 'Collecting the last badge should close the queue').toHaveCount(0, {
        timeout: 10000,
    });
    expect(new Set(awardedNames).size, 'The queue must not repeat a badge').toBe(
        EXPECTED_BADGE_COUNT,
    );
    expect([...awardedNames].sort()).toEqual([...earnedNames].sort());

    // --------------------------------------------- 4. Duplicate / idempotency
    const duplicateResponse = await request.post(`${BASE_URL}/api/calendar-progress`, {
        headers,
        data: { start: SEED_DATE, title: SEED_DISTANCE },
    });
    if (!duplicateResponse.ok()) {
        // One walk per date: the API rejects the repeat outright.
        expect(duplicateResponse.status()).toBe(409);
    }

    const pendingAfterDuplicate = await getPending(request, authToken);
    expect(pendingAfterDuplicate, 'Re-logging must not queue new awards').toEqual([]);

    const achievementsAfterDuplicate = await getAchievements(request, authToken);
    expect(achievementsAfterDuplicate).toHaveLength(EXPECTED_BADGE_COUNT);
    for (const entry of achievementsAfterDuplicate) {
        expect(entry.earned_count, `${entry.slug} must stay earned exactly once`).toBe(1);
    }

    // --------------------------------------------------- 5. Badge grid matches
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAuthenticated(page);
    await page.waitForSelector('[data-island="ProfileViewIsland"][data-hydrated="true"]', {
        timeout: 15000,
    });
    await dismissPwaInstallBanner(page);

    const badgeCards = page.locator('.badge-card');
    await expect(badgeCards).toHaveCount(EXPECTED_BADGE_COUNT, { timeout: 15000 });
    await expect(awardContent, 'Acknowledged awards must not reopen').toHaveCount(0);

    const journeyProgress = page.locator('.badge-collection__progress');
    await expect(journeyProgress).toHaveCount(1);
    await expect(journeyProgress).toContainText('8/8');

    const gridNames = (await page.locator('.badge-card__name').allTextContents()).map((text) => text.trim());
    expect(gridNames.sort()).toEqual([...earnedNames].sort());

    // ------------------------- 5b. Narrow viewports: no horizontal overflow
    const originalViewport = page.viewportSize();
    for (const width of [390, 360]) {
        await page.setViewportSize({ width, height: 844 });
        await expect(badgeCards).toHaveCount(EXPECTED_BADGE_COUNT, { timeout: 15000 });
        await expect(badgeCards.first()).toBeVisible();
        await expect
            .poll(
                () => page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth),
                { timeout: 5000 },
            )
            .toBe(true);
    }
    if (originalViewport) {
        await page.setViewportSize(originalViewport);
    }

    // A second reload proves the modal does not resurrect and the grid persists.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAuthenticated(page);
    await expect(page.locator('.badge-card')).toHaveCount(EXPECTED_BADGE_COUNT, {
        timeout: 15000,
    });
    await expect(awardContent).toHaveCount(0);

    // A fresh browser context is a true app re-open (new tab/session storage).
    // The acknowledged queue is server-side, so the modal must not return.
    const browser = page.context().browser();
    if (!browser) throw new Error('Browser fixture is unavailable');
    const reopenedContext = await browser.newContext();
    try {
        await reopenedContext.addInitScript(({ token, dismissKey, dismissedAt }) => {
            localStorage.setItem('sessionToken', token);
            localStorage.setItem(dismissKey, String(dismissedAt));
        }, {
            token: authToken,
            dismissKey: 'wtm_pwa_install_dismissed',
            dismissedAt: Date.now(),
        });
        const reopened = await reopenedContext.newPage();

        for (const path of ['/profile', '/journey']) {
            const pendingResponse = reopened.waitForResponse(
                (response) => response.url().includes('/api/achievements/pending')
                    && response.request().method() === 'GET',
                { timeout: 15000 },
            );
            await reopened.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
            await waitForAuthenticated(reopened);
            // Wait for the app's pending fetch to complete. Do not read the
            // browser response body here: Firefox invalidates it after a
            // navigation and throws NS_ERROR_INVALID_CONTENT_ENCODING.
            await pendingResponse;
            const pendingApi = await request.get(`${BASE_URL}/api/achievements/pending`, {
                headers,
            });
            expect(
                pendingApi.ok(),
                `GET /api/achievements/pending failed after reopening ${path}`,
            ).toBeTruthy();
            const pendingBody = await pendingApi.json();
            expect(
                pendingBody.pending,
                `Cleared queue must return no pending awards on ${path} after an app re-open`,
            ).toEqual([]);
            await expect(
                reopened.locator('.badge-award__content'),
                `Cleared queue must not reopen on ${path} after an app re-open`,
            ).toHaveCount(0);
            await expect(reopened.locator('.badge-award-overlay')).toHaveCount(0);
        }
    } finally {
        await reopenedContext.close();
    }

    // ------------------------------------------------------ 6. Badge detail
    const firstCard = page.locator('.badge-card').first();
    const firstCardName = ((await firstCard.locator('.badge-card__name').textContent()) || '').trim();
    await firstCard.locator('.badge-card__button').click();

    await expect(awardContent).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.badge-award__name')).toHaveText(firstCardName);
    const closeAwardButton = page.getByRole('button', { name: 'Close award' });
    await expect(closeAwardButton).toBeVisible();
    // View-only mode never shows queue position or a "Continue" action.
    await expect(page.locator('.badge-award__position')).toHaveCount(0);
    await expect(page.locator('.badge-award__primary')).toHaveCount(0);

    await closeAwardButton.click();
    await expect(awardContent).toHaveCount(0);
    const pendingAfterDetail = await getPending(request, authToken);
    expect(pendingAfterDetail, 'Viewing a badge must not acknowledge anything').toEqual([]);

    // ------------------------------ 7. View → Settings → Back flow
    const settingsLink = page.locator('a[href="/profile/settings"]');
    await expect(settingsLink).toBeVisible();
    await expect(settingsLink).toContainText('Edit Profile & Settings');
    await settingsLink.click();

    await page.waitForURL('**/profile/settings', { timeout: 10000 });
    await page.waitForSelector('[data-island="ProfileSettingsIsland"][data-hydrated="true"]', {
        timeout: 15000,
    });
    await dismissPwaInstallBanner(page);
    await waitForProfileSettingsForm(page);

    const backButton = page.locator('.profile-back-button');
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveAttribute('href', '/profile');
    const backBox = await backButton.boundingBox();
    expect(backBox, 'Back to profile control should be rendered').not.toBeNull();
    expect(backBox.height, 'Back to profile control should be at least 44px tall').toBeGreaterThanOrEqual(44);

    // Auto-save page: no global save control or banner exists.
    await expect(page.locator('#save-profile-btn')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save Changes' })).toHaveCount(0);

    // Only the email changes; the mock-auth token embeds the username.
    const newEmail = `flow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}@example.com`;
    const emailInput = page.locator('#profile-email');
    await emailInput.click({ clickCount: 3 });
    await emailInput.press('Backspace');
    await emailInput.type(newEmail, { delay: 15 });
    await expect(emailInput).toHaveValue(newEmail);

    const saveResponsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/profile') && response.request().method() === 'PUT',
        { timeout: 10000 },
    );
    await emailInput.blur();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status(), 'Email save should succeed').toBe(200);

    const emailStatus = page.locator('.form-group:has(#profile-email) .profile-field-status');
    await expect(emailStatus).toHaveClass(/saved/, { timeout: 10000 });
    await expect(emailStatus).toHaveText('Saved');

    await expect(page.locator('#profile-success'), 'No global save banner').toHaveCount(0);
    await expect(page.locator('#profile-error'), 'No global save banner').toHaveCount(0);

    await backButton.click();
    await page.waitForURL((url) => url.pathname === '/profile', { timeout: 10000 });
    await page.waitForSelector('[data-island="ProfileViewIsland"][data-hydrated="true"]', {
        timeout: 15000,
    });
    await expect(page.locator('.friend-profile-username')).toBeVisible();
    await expect(page.locator('.friend-profile-stats')).toBeVisible();
    await expect(page.locator('a[href="/profile/settings"]')).toBeVisible();

    // ------------------------------------------------------- 8. Avatar modal
    const avatarTrigger = page.locator('[aria-label^="Change avatar for"]');
    await expect(avatarTrigger).toBeVisible();
    await avatarTrigger.click();

    const avatarDialog = page.locator('.picker-dialog[role="dialog"]');
    await expect(avatarDialog).toBeVisible({ timeout: 10000 });

    // Regression: `profile.css` (@imported by main.css) must reach this page —
    // the picker overlay is only viewport-fixed when that stylesheet applies.
    const overlay = page.locator('.profile-dialog-overlay');
    await expect
        .poll(
            () => overlay.evaluate((element) => getComputedStyle(element).position),
            { timeout: 5000 },
        )
        .toBe('fixed');
    await expect
        .poll(
            () => overlay.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return Math.abs(rect.width - window.innerWidth) <= 2
                    && Math.abs(rect.height - window.innerHeight) <= 2;
            }),
            { timeout: 5000 },
        )
        .toBe(true);

    await expect(page.locator('#avatar-picker-title')).toContainText('Choose Avatar');
    await expect(page.locator('.picker-gallery')).toBeVisible();
    await expect(
        page.locator('[role="radiogroup"][aria-label="Choose avatar"]'),
        'Avatar gallery should load its choices',
    ).toBeVisible({ timeout: 15000 });

    await page.keyboard.press('Escape');
    await expect(avatarDialog).toHaveCount(0);
    await expect
        .poll(
            async () => page.evaluate(() => {
                const active = document.activeElement;
                return active instanceof HTMLElement ? active.getAttribute('aria-label') || '' : '';
            }),
            { timeout: 5000 },
        )
        .toMatch(/^Change avatar for /);

    // ---------------------------------------- 9. Friends regression smoke
    const consoleErrors = [];
    const onConsole = (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
    };
    const onPageError = (error) => consoleErrors.push(String(error));
    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    try {
        await navigateAuthenticated(page, authToken, '/friends');
        await page.waitForSelector('[data-island="FriendsListIsland"][data-hydrated="true"]', {
            timeout: 15000,
        });
        await expect(page.locator('.party-page')).toBeVisible();
        // A fresh user has no friendships; the page must render its empty state
        // (or the friend list) rather than error out.
        await expect(page.locator('.party-empty, .friend-list-item').first()).toBeVisible({
            timeout: 10000,
        });
    } finally {
        page.off('console', onConsole);
        page.off('pageerror', onPageError);
    }

    expect(consoleErrors, `Friends page logged console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
