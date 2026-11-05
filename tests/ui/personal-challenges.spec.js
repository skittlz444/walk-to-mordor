// @ts-check
const {
    test,
    expect,
    navigateAuthenticated,
    waitForAuthenticated,
} = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const DIALOG = '.encounter-popup-dialog';
const ACCEPT = '.encounter-popup__accept';
const DECLINE = '.encounter-popup__decline';

function authHeaders(authToken) {
    return {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
    };
}

/** UTC date string N days before today. */
function isoDaysAgo(days) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
}

/**
 * Seed enough distinct walking days to pass the 7-walks-in-30-days
 * eligibility threshold. Dates are in the past so accepting the encounter
 * does not immediately complete it.
 */
async function seedActivity(request, authToken, days = 7, distance = 5) {
    for (let index = 1; index <= days; index += 1) {
        const response = await request.post(`${BASE_URL}/api/calendar-progress`, {
            headers: authHeaders(authToken),
            data: { start: isoDaysAgo(index), title: distance },
        });
        expect(
            response.ok(),
            `seed walk ${isoDaysAgo(index)} failed: ${response.status()} ${await response.text()}`,
        ).toBeTruthy();
    }
}

/**
 * Create today's roll deterministically. `force_offer` is honored only when
 * the dev server runs with ALLOW_TEST_AUTH=true, which the Playwright
 * webServer does.
 */
async function forceOffer(request, authToken) {
    const response = await request.post(`${BASE_URL}/api/events/daily-roll`, {
        headers: authHeaders(authToken),
        data: { force_offer: true },
    });
    expect(response.ok(), `daily roll failed: ${response.status()} ${await response.text()}`).toBeTruthy();
    const body = await response.json();
    expect(body.offer, 'expected a forced encounter offer').not.toBeNull();
    return body.offer;
}

async function rollAgain(request, authToken) {
    const response = await request.post(`${BASE_URL}/api/events/daily-roll`, {
        headers: authHeaders(authToken),
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
}

async function acceptAgain(request, authToken, definitionId) {
    const response = await request.post(`${BASE_URL}/api/events/daily-roll/accept`, {
        headers: authHeaders(authToken),
        data: { encounter_definition_id: definitionId },
    });
    expect(response.ok(), `repeat accept failed: ${response.status()} ${await response.text()}`).toBeTruthy();
    return response.json();
}

async function expectNoDialog(page) {
    await page.waitForTimeout(1500);
    await expect(page.locator(DIALOG)).toHaveCount(0);
}

/**
 * The weekly Palantír insight and the badge-award queue are independent
 * modals. They can open around the same time as the encounter and correctly
 * defer each other, which makes a test about the encounter nondeterministic.
 * Acknowledge the seeded awards server-side and pre-set the Palantír cooldown
 * for this user so the encounter is the only popup on the page.
 */
async function prepareForEncounter(page, request, authToken) {
    const headers = authHeaders(authToken);

    const pendingResponse = await request.get(`${BASE_URL}/api/achievements/pending`, { headers });
    if (pendingResponse.ok()) {
        const pendingBody = await pendingResponse.json();
        const instanceIds = Array.isArray(pendingBody.pending)
            ? pendingBody.pending.map((entry) => entry.instance_id)
            : [];
        if (instanceIds.length > 0) {
            const acknowledge = await request.post(`${BASE_URL}/api/achievements/acknowledge`, {
                headers,
                data: { instance_ids: instanceIds },
            });
            expect(acknowledge.ok()).toBeTruthy();
        }
    }

    const sessionResponse = await request.get(`${BASE_URL}/api/session`, { headers });
    expect(sessionResponse.ok()).toBeTruthy();
    const session = await sessionResponse.json();
    expect(typeof session.userId).toBe('number');

    await page.addInitScript(({ userId }) => {
        localStorage.setItem(`wtm_palantir_last_view:${userId}`, String(Date.now()));
    }, { userId: session.userId });
}

async function dismissInterferingModals(page) {
    const badge = page.locator('.badge-award-overlay');
    if (await badge.isVisible().catch(() => false)) {
        const close = page.getByRole('button', { name: 'Close award' });
        if (await close.isVisible().catch(() => false)) {
            await close.click({ force: true }).catch(() => {});
        }
        await page.waitForTimeout(200);
    }

    const palantir = page.locator('button:has-text("Cast the Palantír aside")').first();
    if (await palantir.count() > 0) {
        await palantir.evaluate((element) => element.click()).catch(() => {});
        await page.waitForTimeout(200);
    }
}

/**
 * Wait for the encounter dialog, clearing any modal that opened first and is
 * legitimately deferring it. The setup above usually prevents these, but the
 * fallback keeps the test honest about the real browser behaviour.
 */
async function waitForEncounterDialog(page) {
    const dialog = page.locator(DIALOG);
    const deadline = Date.now() + 20000;

    while (Date.now() < deadline) {
        const dialogVisible = await dialog.isVisible().catch(() => false);
        const badgeVisible = await page.locator('.badge-award-overlay').isVisible().catch(() => false);
        if (dialogVisible && !badgeVisible) return dialog;
        await dismissInterferingModals(page);
        await page.waitForTimeout(250);
    }

    await expect(dialog).toBeVisible({ timeout: 2000 });
    return dialog;
}

async function waitForArtwork(page) {
    await page.waitForFunction(() => {
        const image = document.querySelector('img.encounter-popup__art');
        return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
    }, { timeout: 10000 });
}

test.describe('Personal challenge encounter popup', () => {
    test('journey page shows the Nazgul offer, accepts it, and does not re-show after reload', async ({
        page,
        request,
        authToken,
    }) => {
        await seedActivity(request, authToken);
        const offer = await forceOffer(request, authToken);
        await prepareForEncounter(page, request, authToken);

        await navigateAuthenticated(page, authToken, '/journey');

        const dialog = await waitForEncounterDialog(page);
        await expect(dialog).toHaveAttribute('role', 'dialog');
        await expect(dialog).toHaveAttribute('aria-modal', 'true');
        await expect(page.locator('.encounter-popup__title')).toContainText(/nazg/i);
        await expect(page.locator('.encounter-popup__target')).toContainText(String(offer.target));
        await expect(page.locator('.encounter-popup__coverage')).toContainText(offer.coverageEnd);
        await expect(page.locator('.encounter-popup__grace')).toContainText(offer.graceDeadline);

        const artwork = page.locator('img.encounter-popup__art');
        await expect(artwork).toBeVisible();
        await expect(artwork).toHaveAttribute('src', /\/img\/highres\/nazgul-pursuit\.webp$/);
        await waitForArtwork(page);

        await page.locator(ACCEPT).click();
        await expect(page.locator('.encounter-popup__success')).toBeVisible({ timeout: 5000 });
        await expect(dialog).toBeHidden({ timeout: 10000 });

        const repeat = await acceptAgain(request, authToken, offer.definition.id);
        expect(repeat.alreadyAccepted).toBe(true);
        expect(repeat.occurrence.personalized_target).toBe(offer.target);

        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForAuthenticated(page);
        await expectNoDialog(page);
    });

    test('map page shows the offer, declines it, and suppresses it for the rest of the day', async ({
        page,
        request,
        authToken,
    }) => {
        await seedActivity(request, authToken);
        await forceOffer(request, authToken);
        await prepareForEncounter(page, request, authToken);

        await navigateAuthenticated(page, authToken, '/map');

        const dialog = page.locator(DIALOG);
        await expect(dialog).toBeVisible({ timeout: 15000 });
        await page.locator(DECLINE).click();
        await expect(dialog).toBeHidden({ timeout: 10000 });

        const reroll = await rollAgain(request, authToken);
        expect(reroll.offer).toBeNull();

        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForAuthenticated(page);
        await expectNoDialog(page);
    });

    test('no modal appears on journey or map when the user is not eligible', async ({
        page,
        request,
        authToken,
    }) => {
        // No walks: below the activity threshold, so today's roll stores no offer.
        const roll = await rollAgain(request, authToken);
        expect(roll.offer).toBeNull();
        await prepareForEncounter(page, request, authToken);

        await navigateAuthenticated(page, authToken, '/journey');
        await expectNoDialog(page);

        await navigateAuthenticated(page, authToken, '/map');
        await expectNoDialog(page);
    });

    test('modal stays usable when the illustration fails to load', async ({
        page,
        request,
        authToken,
    }) => {
        await seedActivity(request, authToken);
        await forceOffer(request, authToken);
        await prepareForEncounter(page, request, authToken);

        await page.route('**/img/highres/nazgul-pursuit.webp', (route) => route.abort());

        await navigateAuthenticated(page, authToken, '/journey');

        const dialog = await waitForEncounterDialog(page);
        await expect(page.locator('img.encounter-popup__art')).toHaveCount(0);
        await expect(page.locator('.encounter-popup__title')).toBeVisible();
        await expect(page.locator(ACCEPT)).toBeVisible();
        await expect(page.locator(DECLINE)).toBeVisible();
    });

    test('mobile layout keeps the dialog inside the viewport and the actions reachable', async ({
        page,
        request,
        authToken,
    }) => {
        await seedActivity(request, authToken);
        await forceOffer(request, authToken);
        await prepareForEncounter(page, request, authToken);

        await page.setViewportSize({ width: 390, height: 844 });
        await navigateAuthenticated(page, authToken, '/journey');

        const dialog = await waitForEncounterDialog(page);

        const box = await dialog.boundingBox();
        expect(box).not.toBeNull();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
        expect(box.y + box.height).toBeLessThanOrEqual(844);

        await expect(page.locator(ACCEPT)).toBeVisible();
        await expect(page.locator(DECLINE)).toBeVisible();
        await waitForArtwork(page);

        await page.screenshot({ path: 'test-results/encounter-mobile.png', fullPage: false });
    });

    test('desktop layout renders the centred modal', async ({
        page,
        request,
        authToken,
    }) => {
        await seedActivity(request, authToken);
        await forceOffer(request, authToken);
        await prepareForEncounter(page, request, authToken);

        await page.setViewportSize({ width: 1280, height: 900 });
        await navigateAuthenticated(page, authToken, '/journey');

        const dialog = await waitForEncounterDialog(page);
        await waitForArtwork(page);
        await page.screenshot({ path: 'test-results/encounter-desktop.png', fullPage: false });
    });

    test('the offer is deferred while another modal dialog is open', async ({
        page,
        request,
        authToken,
    }) => {
        await seedActivity(request, authToken);
        await forceOffer(request, authToken);
        await prepareForEncounter(page, request, authToken);

        // A stand-in dialog exists when the Preact bootstrap runs and stays
        // until the test removes it; the encounter trigger must wait for it.
        await page.addInitScript(() => {
            window.addEventListener('DOMContentLoaded', () => {
                const blocker = document.createElement('div');
                blocker.id = 'encounter-test-blocker';
                blocker.className = 'modal-overlay';
                blocker.setAttribute('role', 'dialog');
                blocker.setAttribute('aria-modal', 'true');
                document.body.appendChild(blocker);
                window['__encounterTestBlocker'] = blocker;
            });
        });

        await navigateAuthenticated(page, authToken, '/map');

        // Still deferred while the blocker exists.
        await expect(page.locator('#encounter-test-blocker')).toHaveCount(1);
        await expect(page.locator(DIALOG)).toHaveCount(0);

        // Removing the blocker releases the deferred mount.
        await page.evaluate(() => {
            const blocker = window['__encounterTestBlocker'];
            if (blocker) blocker.remove();
        });
        await expect(page.locator(DIALOG)).toBeVisible({ timeout: 15000 });
    });
});
