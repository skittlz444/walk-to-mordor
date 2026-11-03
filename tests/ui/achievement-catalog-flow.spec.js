// @ts-check
//
// End-to-end coverage for the achievement-catalog-expansion change:
//
//   1. The three new habit badges are earnable from walk logging and appear in
//      the profile badge grid with the expected repeat counts.
//   2. The fellowship collection is earned via direct joins and displays as a
//      complete 2/2 community collection. Invite-accept activation is covered
//      by the Jest suite in tests/api/fellowship-invite-handlers.test.ts.
//
// Habit windows are only awarded on specific calendar anchors, so the seed
// dates below are fixed and walk backwards from the present. October 2026 is
// fully in the past, and Oct 1 2026 is a Thursday:
//
//   Sat Oct 3  + Sun Oct 4   -> weekend 1
//   Sat Oct 10 + Sun Oct 11  -> weekend 2, and Mon Oct 5 - Sun Oct 11 is a
//                               complete 105 km week (hundred-K + faithful)
//   Sat Oct 17 + Sun Oct 18  -> weekend 3, and Mon Oct 12 - Sun Oct 18 is a
//                               complete 105 km week (hundred-K + faithful)
//   Oct 1..20                -> 20 distinct days in October (steady month)
//
// 20 walks x 15 km = 300 km, which crosses exactly the first Frodo/Sam
// journey threshold (112.65 km) and not the second (387.85 km).
const {
    test: base,
    expect,
    navigateAuthenticated,
    waitForAuthenticated,
    dismissPwaInstallBanner,
} = require('./helpers/common');
const { cleanupAllTestData } = require('./helpers/cleanup');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

function uniqueId() {
    return Math.random().toString(36).substring(2, 8);
}

// ─── Multi-user fixtures ────────────────────────────────────────────────────
// The fellowship test uses four ad-hoc mock-auth members; without fixtures
// they would leak across runs. The `authToken` fixture in helpers/common.js
// already cleans up the primary user.
const test = base.extend({
    catalogMember1Token: async ({}, use) => {
        const token = `TEST_MOCK_TOKEN_CatalogMember1_${uniqueId()}`;
        await use(token);
        await cleanupAllTestData(BASE_URL, token);
    },
    catalogMember2Token: async ({}, use) => {
        const token = `TEST_MOCK_TOKEN_CatalogMember2_${uniqueId()}`;
        await use(token);
        await cleanupAllTestData(BASE_URL, token);
    },
    catalogMember3Token: async ({}, use) => {
        const token = `TEST_MOCK_TOKEN_CatalogMember3_${uniqueId()}`;
        await use(token);
        await cleanupAllTestData(BASE_URL, token);
    },
    catalogMember4Token: async ({}, use) => {
        const token = `TEST_MOCK_TOKEN_CatalogMember4_${uniqueId()}`;
        await use(token);
        await cleanupAllTestData(BASE_URL, token);
    },
});

const DAILY_DISTANCE = 15;
const HABIT_DATES = Array.from({ length: 20 }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return `2026-10-${day}`;
});

const EXPECTED_EARNED = {
    'habit-first-steps': 1,
    'habit-faithful-walker': 2,
    'habit-weekend-warrior': 3,
    'habit-steady-month': 1,
    'habit-hundred-week': 2,
    'journey-frodo-sam-buckleberry-ferry': 1,
};

const EXPECTED_NAMES = {
    'habit-weekend-warrior': 'Weekend Warrior',
    'habit-steady-month': 'Steady Month',
    'habit-hundred-week': 'Hundred-K Week',
    'community-fellowship-founder': 'Fellowship Founder',
    'community-good-company': 'Good Company',
};

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

async function acknowledgeAll(request, authToken) {
    const pending = await getPending(request, authToken);
    if (pending.length === 0) return;

    const response = await request.post(`${BASE_URL}/api/achievements/acknowledge`, {
        headers: authHeaders(authToken),
        data: { instance_ids: pending.map((entry) => entry.instance_id) },
    });
    expect(
        response.ok(),
        `POST /api/achievements/acknowledge failed (${response.status()}): ${await response.text()}`,
    ).toBeTruthy();
}

async function seedWalk(request, authToken, date, distance) {
    const response = await request.post(`${BASE_URL}/api/calendar-progress`, {
        headers: authHeaders(authToken),
        data: { start: date, title: distance },
    });
    expect(
        response.ok(),
        `POST /api/calendar-progress ${date} failed (${response.status()}): ${await response.text()}`,
    ).toBeTruthy();
}

async function createFellowship(request, authToken, name) {
    const response = await request.post(`${BASE_URL}/api/party`, {
        headers: authHeaders(authToken),
        data: { name, distance_mode: 'cumulative', leave_distance_behavior: 'keep' },
    });
    expect(
        response.ok(),
        `POST /api/party failed (${response.status()}): ${await response.text()}`,
    ).toBeTruthy();
    return response.json();
}

async function joinFellowship(request, authToken, inviteCode) {
    const response = await request.post(`${BASE_URL}/api/party/join/${inviteCode}`, {
        headers: authHeaders(authToken),
    });
    expect(
        response.ok(),
        `POST /api/party/join/${inviteCode} failed (${response.status()}): ${await response.text()}`,
    ).toBeTruthy();
}

/** Slugs earned by `authToken`, as a slug -> earned_count map. */
async function earnedCounts(request, authToken) {
    const achievements = await getAchievements(request, authToken);
    return Object.fromEntries(
        achievements.map((entry) => [entry.slug, entry.earned_count]),
    );
}

test.describe('achievement catalog expansion', () => {
    test('earns the three habit badges from walk logging and renders them', async ({
        page,
        request,
        authToken,
    }) => {
        // ------------------------------------------------------- 1. Seed walks
        for (const date of HABIT_DATES) {
            await seedWalk(request, authToken, date, DAILY_DISTANCE);
        }

        // ----------------------------------------------------- 2. API contract
        const counts = await earnedCounts(request, authToken);
        expect(counts).toEqual(EXPECTED_EARNED);

        const achievements = await getAchievements(request, authToken);
        const namesBySlug = Object.fromEntries(
            achievements.map((entry) => [entry.slug, entry.name]),
        );
        expect(namesBySlug['habit-weekend-warrior']).toBe(EXPECTED_NAMES['habit-weekend-warrior']);
        expect(namesBySlug['habit-steady-month']).toBe(EXPECTED_NAMES['habit-steady-month']);
        expect(namesBySlug['habit-hundred-week']).toBe(EXPECTED_NAMES['habit-hundred-week']);
        // -------------------------------------------------- 3. Award modal queue
        // Pending awards are per instance, not per definition: repeatable
        // habits queue one award per earned window.
        const expectedPendingCount = Object.values(EXPECTED_EARNED).reduce(
            (total, count) => total + count,
            0,
        );
        const pending = await getPending(request, authToken);
        expect(pending).toHaveLength(expectedPendingCount);

        await navigateAuthenticated(page, authToken, '/profile');
        await page.waitForSelector('[data-island="ProfileViewIsland"][data-hydrated="true"]', {
            timeout: 15000,
        });
        await dismissPwaInstallBanner(page);

        const awardContent = page.locator('.badge-award__content');
        await expect(awardContent).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.badge-award-dialog[role="dialog"]')).toBeVisible();
        await expect(page.locator('.badge-award__position')).toHaveText(
            `Badge 1 of ${expectedPendingCount}`,
        );

        const expectedBadgeNames = new Set(achievements.map((entry) => entry.name));
        const awardedNames = [];
        for (let index = 1; index <= expectedPendingCount; index += 1) {
            await expect(page.locator('.badge-award__position')).toHaveText(
                `Badge ${index} of ${expectedPendingCount}`,
                { timeout: 10000 },
            );

            const name = ((await page.locator('.badge-award__name').textContent()) || '').trim();
            expect(name.length).toBeGreaterThan(0);
            awardedNames.push(name);

            const primary = page.locator('.badge-award__primary');
            await expect(primary).toBeEnabled();
            await expect(primary).toHaveText(
                index === expectedPendingCount ? 'Collect badge' : 'Continue',
            );
            await primary.click();

            if (index < expectedPendingCount) {
                await expect(page.locator('.badge-award__position')).toHaveText(
                    `Badge ${index + 1} of ${expectedPendingCount}`,
                    { timeout: 10000 },
                );
            }
        }

        await expect(awardContent, 'Collecting the last badge should close the queue').toHaveCount(
            0,
            { timeout: 10000 },
        );
        // Duplicate names are expected: a repeatable badge queues one modal per
        // earned window, but only the known catalog names may appear.
        for (const name of awardedNames) {
            expect(expectedBadgeNames.has(name), `Unexpected badge in queue: ${name}`).toBe(true);
        }
        expect(new Set(awardedNames).size).toBe(Object.keys(EXPECTED_EARNED).length);
        for (const slug of [
            'habit-weekend-warrior',
            'habit-steady-month',
            'habit-hundred-week',
        ]) {
            expect(awardedNames).toContain(EXPECTED_NAMES[slug]);
        }

        // ----------------------------------------------------- 4. Badge grid
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForAuthenticated(page);
        await page.waitForSelector('[data-island="ProfileViewIsland"][data-hydrated="true"]', {
            timeout: 15000,
        });
        await dismissPwaInstallBanner(page);

        const badgeCards = page.locator('.badge-card');
        await expect(badgeCards).toHaveCount(Object.keys(EXPECTED_EARNED).length, {
            timeout: 15000,
        });
        await expect(awardContent, 'Acknowledged awards must not reopen').toHaveCount(0);

        const gridNames = (await page.locator('.badge-card__name').allTextContents()).map((text) =>
            text.trim(),
        );
        for (const slug of [
            'habit-weekend-warrior',
            'habit-steady-month',
            'habit-hundred-week',
        ]) {
            expect(gridNames).toContain(EXPECTED_NAMES[slug]);
        }

        // Repeatable badges resolve rank from earned_count: three weekends is
        // rank 1 (rank_thresholds [1, 4, 12, 26]).
        const weekendCard = page
            .locator('.badge-card')
            .filter({ hasText: EXPECTED_NAMES['habit-weekend-warrior'] });
        await expect(weekendCard).toBeVisible();
        await expect(weekendCard.locator('.badge-rank')).toHaveText('bronze');

        // ------------------------------------------- 5. Narrow viewport sanity
        const originalViewport = page.viewportSize();
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(badgeCards.first()).toBeVisible();
        await expect
            .poll(
                () => page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth),
                { timeout: 5000 },
            )
            .toBe(true);
        if (originalViewport) {
            await page.setViewportSize(originalViewport);
        }
    });

    test('awards both fellowship badges and renders the completed collection', async ({
        page,
        request,
        authToken,
        catalogMember1Token,
        catalogMember2Token,
        catalogMember3Token,
        catalogMember4Token,
    }) => {
        const unique = Math.random().toString(36).substring(2, 8);
        const memberTokens = [
            catalogMember1Token,
            catalogMember2Token,
            catalogMember3Token,
            catalogMember4Token,
        ];

        const party = await createFellowship(request, authToken, `Catalog Fellowship ${unique}`);

        // Leader only has the founder badge until the fourth active member joins.
        expect(await earnedCounts(request, authToken)).toEqual({
            'community-fellowship-founder': 1,
        });

        // Three joiners: still below the threshold.
        for (const token of memberTokens.slice(0, 2)) {
            await joinFellowship(request, token, party.invite_code);
        }
        expect(await earnedCounts(request, authToken)).toEqual({
            'community-fellowship-founder': 1,
        });
        for (const token of memberTokens.slice(0, 2)) {
            expect(await earnedCounts(request, token)).toEqual({});
        }

        // Fourth active member crosses the threshold: everybody gets Good Company.
        await joinFellowship(request, memberTokens[2], party.invite_code);
        expect(await earnedCounts(request, authToken)).toEqual({
            'community-fellowship-founder': 1,
            'community-good-company': 1,
        });
        for (const token of memberTokens.slice(0, 3)) {
            expect(await earnedCounts(request, token)).toEqual({
                'community-good-company': 1,
            });
        }

        // A late joiner to an already-qualifying fellowship also gets it, and
        // existing members never earn a second instance.
        await joinFellowship(request, memberTokens[3], party.invite_code);
        for (const token of memberTokens) {
            expect(await earnedCounts(request, token)).toEqual({
                'community-good-company': 1,
            });
        }
        expect(await earnedCounts(request, authToken)).toEqual({
            'community-fellowship-founder': 1,
            'community-good-company': 1,
        });

        // ------------------------------------------------------- UI: 2/2 cards
        await acknowledgeAll(request, authToken);

        await navigateAuthenticated(page, authToken, '/profile');
        await page.waitForSelector('[data-island="ProfileViewIsland"][data-hydrated="true"]', {
            timeout: 15000,
        });
        await dismissPwaInstallBanner(page);

        const awardContent = page.locator('.badge-award__content');
        await expect(awardContent, 'Acknowledged badges must not queue').toHaveCount(0);

        const communityProgress = page
            .locator('.badge-collection')
            .filter({ hasText: 'The Fellowship' })
            .locator('.badge-collection__progress');
        await expect(communityProgress).toContainText('2/2', { timeout: 15000 });

        const gridNames = (await page.locator('.badge-card__name').allTextContents()).map((text) =>
            text.trim(),
        );
        expect(gridNames).toContain(EXPECTED_NAMES['community-fellowship-founder']);
        expect(gridNames).toContain(EXPECTED_NAMES['community-good-company']);

        // Every member's profile shows Good Company.
        for (const token of memberTokens) {
            await acknowledgeAll(request, token);
        }
        await navigateAuthenticated(page, memberTokens[0], '/profile');
        await page.waitForSelector('[data-island="ProfileViewIsland"][data-hydrated="true"]', {
            timeout: 15000,
        });
        await dismissPwaInstallBanner(page);
        await expect(page.locator('.badge-card')).toHaveCount(1, { timeout: 15000 });
        const memberNames = (await page.locator('.badge-card__name').allTextContents()).map((text) =>
            text.trim(),
        );
        expect(memberNames).toEqual([EXPECTED_NAMES['community-good-company']]);
    });
});
