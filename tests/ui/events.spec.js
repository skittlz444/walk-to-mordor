// @ts-check
const {
    test,
    expect,
} = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const EVENTS_PATH = '/events';
const CARD = '.event-card';
const SIGN_IN = '.event-join__signin';
const JOIN_BUTTON = '.event-join__button';
const NOTICE = '.event-join__notice';
const CONTRIBUTOR_ITEM = '.event-contributors__item';

function authHeaders(authToken) {
    return {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
    };
}

/** UTC date string for today, matching the campaign date domain. */
function utcToday() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * `/events` deliberately skips `main.js` (`publicPage: true`), so
 * `body.authenticated` never appears there. Seed the token before the first
 * navigation instead of using `navigateAuthenticated` (which waits for that
 * class on the target page).
 */
async function seedSession(page, authToken) {
    await page.addInitScript(({ token }) => {
        try {
            localStorage.setItem('sessionToken', token);
        } catch (_error) {
            // Ignore storage failures in unsupported contexts.
        }
    }, { token: authToken });
}

async function fetchCampaigns(request, authToken) {
    const response = await request.get(`${BASE_URL}/api/events`, {
        headers: authToken ? authHeaders(authToken) : {},
    });
    expect(response.ok(), `campaign list failed: ${response.status()} ${await response.text()}`).toBeTruthy();
    const body = await response.json();
    return Array.isArray(body.campaigns) ? body.campaigns : [];
}

async function fetchCommunityProgress(request, campaignId, authToken) {
    const response = await request.get(`${BASE_URL}/api/events/${campaignId}/community-progress`, {
        headers: authToken ? authHeaders(authToken) : {},
    });
    expect(response.ok(), `community progress failed: ${response.status()} ${await response.text()}`).toBeTruthy();
    return response.json();
}

/** Campaigns whose active run can still be joined (upcoming or active). */
function joinableCampaigns(campaigns) {
    return campaigns.filter((campaign) => (
        campaign.activeRun
        && (campaign.activeRun.status === 'active' || campaign.activeRun.status === 'upcoming')
    ));
}

test.describe('community campaigns page', () => {
    test('renders publicly without a login redirect and hydrates the island', async ({ page }) => {
        const response = await page.goto(`${BASE_URL}${EVENTS_PATH}`, { waitUntil: 'domcontentloaded' });

        expect(response?.status()).toBe(200);
        expect(new URL(page.url()).pathname).toBe(EVENTS_PATH);
        await expect(page.locator('header h1')).toHaveText('Campaigns');

        const island = page.locator('[data-island="EventsIsland"]');
        await expect(island).toHaveAttribute('data-hydrated', 'true', { timeout: 15000 });
        // Either campaign cards or the empty state must resolve; the page never
        // bounces an anonymous visitor to /login.
        await expect(page.locator(`${CARD}, .events-empty, .events-loading`).first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.events-error')).toHaveCount(0);
    });

    test('drawer navigation links to Campaigns between Fellowships and Friends', async ({ page }) => {
        await page.goto(`${BASE_URL}${EVENTS_PATH}`, { waitUntil: 'domcontentloaded' });

        await page.locator('.menu-icon').click();
        const campaignsLink = page.locator('.drawer-nav a.drawer-link', { hasText: 'Campaigns' });
        await expect(campaignsLink).toHaveAttribute('href', EVENTS_PATH);

        const labels = await page.locator('.drawer-nav a.drawer-link').allTextContents();
        const fellowshipIndex = labels.findIndex((label) => label.includes('Fellowships'));
        const campaignsIndex = labels.findIndex((label) => label.includes('Campaigns'));
        const friendsIndex = labels.findIndex((label) => label.includes('Friends'));
        expect(fellowshipIndex).toBeGreaterThanOrEqual(0);
        expect(campaignsIndex).toBeGreaterThan(fellowshipIndex);
        expect(friendsIndex).toBeGreaterThan(campaignsIndex);
    });

    test('campaign card shows imagery, progress bar, participants, and which-days copy', async ({ page, request }) => {
        const campaigns = await fetchCampaigns(request);
        if (campaigns.length === 0) {
            test.skip(true, 'No enabled campaigns are seeded; only the campaign shell assertions run.');
            return;
        }

        await page.goto(`${BASE_URL}${EVENTS_PATH}`, { waitUntil: 'domcontentloaded' });

        const firstCampaign = campaigns.find((campaign) => campaign.activeRun) ?? campaigns[0];
        const card = page.locator(`${CARD}[data-campaign="${firstCampaign.slug}"]`).first();
        await expect(card).toBeVisible({ timeout: 15000 });

        await expect(card.locator('.event-card__title')).toHaveText(firstCampaign.name);
        await expect(card.locator('.event-progress__track[role="progressbar"]')).toBeVisible();
        await expect(card.locator('.event-progress__meta')).toContainText('walker');
        await expect(card).toContainText('Walks dated');
        await expect(card).toContainText('count toward this campaign');

        if (firstCampaign.imageSlug) {
            const image = card.locator('.event-card__image');
            await expect(image).toHaveAttribute('src', `/img/highres/${firstCampaign.imageSlug}.webp`);
            const thumb = card.locator('.event-card__thumb');
            await expect(thumb).toHaveAttribute('src', `/img/thumbs/${firstCampaign.imageSlug}-thumb.webp`);
        } else {
            await expect(card.locator('.event-card__art')).toHaveCount(0);
        }
    });

    test('shows the top five contributors and an "and X more" indicator', async ({ page, request }) => {
        const campaigns = await fetchCampaigns(request);
        const campaign = campaigns.find((entry) => entry.activeRun && entry.activeRun.contributorCount > 5);
        if (!campaign) {
            test.skip(true, 'No active run has more than five contributors.');
            return;
        }

        await page.goto(`${BASE_URL}${EVENTS_PATH}`, { waitUntil: 'domcontentloaded' });

        const card = page.locator(`${CARD}[data-campaign="${campaign.slug}"]`).first();
        await expect(card.locator(CONTRIBUTOR_ITEM)).toHaveCount(5);
        await expect(card.locator('.event-contributors__more')).toContainText('more');
    });

    test('anonymous visitors see a sign-in prompt instead of a join button', async ({ page, request }) => {
        const campaigns = await fetchCampaigns(request);
        if (joinableCampaigns(campaigns).length === 0) {
            test.skip(true, 'No joinable campaign is seeded.');
            return;
        }

        await page.goto(`${BASE_URL}${EVENTS_PATH}`, { waitUntil: 'domcontentloaded' });

        const signIn = page.locator(SIGN_IN).first();
        await expect(signIn).toBeVisible({ timeout: 15000 });
        await expect(signIn).toHaveAttribute('href', '/login');
        await expect(signIn).toHaveText('Sign in to join');
        await expect(page.locator(JOIN_BUTTON)).toHaveCount(0);
        await expect(page.locator(NOTICE).first()).toContainText('publicly visible');
        expect(new URL(page.url()).pathname).toBe(EVENTS_PATH);
    });

    test('authenticated visitors see a join button and the public-visibility notice', async ({ page, request, authToken }) => {
        const campaigns = await fetchCampaigns(request, authToken);
        const unjoined = joinableCampaigns(campaigns).filter((campaign) => !campaign.participation);
        if (unjoined.length === 0) {
            test.skip(true, 'No joinable, unjoined campaign is seeded.');
            return;
        }

        await seedSession(page, authToken);
        await page.goto(`${BASE_URL}${EVENTS_PATH}`, { waitUntil: 'domcontentloaded' });

        const card = page.locator(`${CARD}[data-campaign="${unjoined[0].slug}"]`).first();
        await expect(card.locator(JOIN_BUTTON)).toBeVisible({ timeout: 15000 });
        await expect(card.locator(NOTICE)).toContainText('Your username and contribution distance will be publicly visible.');
        await expect(card.locator(SIGN_IN)).toHaveCount(0);
    });

    test('joining an active run credits an in-window walk and publishes the contribution', async ({
        page,
        request,
        authToken,
        browser,
    }) => {
        const campaigns = await fetchCampaigns(request, authToken);
        const today = utcToday();
        const campaign = joinableCampaigns(campaigns).find((entry) => (
            entry.activeRun.status === 'active'
            && !entry.participation
            && entry.activeRun.startDate <= today
            && today <= entry.activeRun.endDate
        ));
        if (!campaign) {
            test.skip(true, 'No active, unjoined campaign whose window includes today.');
            return;
        }

        const username = authToken.replace('TEST_MOCK_TOKEN_', '');
        const progressBefore = await fetchCommunityProgress(request, campaign.id, authToken);

        // A walk dated inside the run window is backfilled at join time, so it
        // must appear as this user's contribution and in the public ranking.
        const walkDistance = 5;
        const walkResponse = await request.post(`${BASE_URL}/api/calendar-progress`, {
            headers: authHeaders(authToken),
            data: { start: today, title: walkDistance },
        });
        expect(walkResponse.ok(), `walk seed failed: ${walkResponse.status()} ${await walkResponse.text()}`).toBeTruthy();

        await seedSession(page, authToken);
        await page.goto(`${BASE_URL}${EVENTS_PATH}`, { waitUntil: 'domcontentloaded' });

        const card = page.locator(`${CARD}[data-campaign="${campaign.slug}"]`).first();
        await expect(card.locator(JOIN_BUTTON)).toBeVisible({ timeout: 15000 });
        await card.locator(JOIN_BUTTON).click();

        await expect(card.locator('.event-join__contribution')).toBeVisible({ timeout: 15000 });
        await expect(card.locator('.event-join__contribution')).toContainText('your contribution');
        await expect(card.locator(JOIN_BUTTON)).toHaveCount(0);

        // Community progress is public: the total moved forward and the new
        // contributor is listed with their username and distance.
        const progressAfter = await fetchCommunityProgress(request, campaign.id, null);
        expect(progressAfter.totalDistance).toBeGreaterThanOrEqual(progressBefore.totalDistance + walkDistance - 0.01);
        const ranked = Array.isArray(progressAfter.contributors) ? progressAfter.contributors : [];
        const ownEntry = ranked.find((entry) => entry.username === username);
        expect(ownEntry, 'joined contributor should appear in the public ranking').toBeTruthy();
        expect(ownEntry.distance).toBeGreaterThanOrEqual(walkDistance - 0.01);

        // The same campaign presents a sign-in prompt to a fresh anonymous
        // visitor — the join affordance is the only authenticated difference.
        const anonContext = await browser.newContext();
        try {
            const anonPage = await anonContext.newPage();
            await anonPage.goto(`${BASE_URL}${EVENTS_PATH}`, { waitUntil: 'domcontentloaded' });
            const anonCard = anonPage.locator(`${CARD}[data-campaign="${campaign.slug}"]`).first();
            await expect(anonCard.locator(SIGN_IN)).toBeVisible({ timeout: 15000 });
            await expect(anonCard.locator(JOIN_BUTTON)).toHaveCount(0);
            await expect(anonCard.locator('.event-join__contribution')).toHaveCount(0);
            await expect(anonCard.locator('.event-progress__track')).toBeVisible();
        } finally {
            await anonContext.close();
        }
    });

    test('renders past-run outcomes when a campaign has completed or expired runs', async ({ page, request }) => {
        const campaigns = await fetchCampaigns(request);
        const withHistory = campaigns.find((campaign) => (
            Array.isArray(campaign.pastRuns) && campaign.pastRuns.length > 0
        ));
        if (!withHistory) {
            test.skip(true, 'No campaign has a completed or expired run.');
            return;
        }

        await page.goto(`${BASE_URL}${EVENTS_PATH}`, { waitUntil: 'domcontentloaded' });

        const pastSection = page.locator('.events-past');
        await expect(pastSection).toBeVisible({ timeout: 15000 });
        const pastCards = pastSection.locator('.event-past-card');
        await expect(pastCards).toHaveCount(withHistory.pastRuns.length);
        await expect(pastCards.first()).toContainText('Final progress');
        await expect(pastCards.first()).toContainText(/Completed|Expired/);
    });
});
