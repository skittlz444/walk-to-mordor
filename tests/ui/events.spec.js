// @ts-check
const {
    test,
    expect,
} = require('./helpers/common');

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const EVENTS_PATH = '/events';
const CARD = '.event-card';
const SIGN_IN = '.event-join__signin';
const JOIN_BUTTON = '.event-join__button';
const NOTICE = '.event-join__notice';
const CONTRIBUTOR_ITEM = '.event-contributors__item';
const REPO_ROOT = path.join(__dirname, '..', '..');

/**
 * The seeded Beacon Watch campaign ships `enabled = 0` and its run window is
 * relative to migration time, so out of the box the events page has no cards.
 * This fixture activates the feature end-to-end through the local D1 database
 * (the same one `wrangler dev` serves): enable the campaign, shift its run
 * window around today, add six contributing walkers so the ranking has depth,
 * add a copy-only campaign card, and add a campaign with a completed run so
 * the past section renders.
 *
 * Every statement is idempotent (`INSERT OR IGNORE` / guarded `UPDATE`), so a
 * partially applied seed heals on the next run instead of aborting.
 * If the seed cannot run (no local D1 state, wrangler failure), the
 * data-dependent tests skip themselves exactly as they would on an unseeded
 * database.
 */
const SEED_SQL = `-- Activate Beacon Watch: enable the campaign and centre its run window on
-- today. The UPDATE is skipped while another run is current so a re-seed can
-- never violate the one-current-run partial unique index.
UPDATE campaign_definitions SET enabled = 1 WHERE slug = 'beacon-watch';
UPDATE campaign_runs
SET status = 'active',
    start_date = date('now', '-5 day'),
    end_date = date('now', '+9 day')
WHERE campaign_id = (SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch')
  AND run_number = 1
  AND NOT EXISTS (
    SELECT 1 FROM campaign_runs other
    WHERE other.campaign_id = campaign_runs.campaign_id
      AND other.id <> campaign_runs.id
      AND other.status IN ('upcoming', 'active')
  );

-- Six contributing walkers so the ranking and the "and X more" indicator have
-- depth. users.email/password_hash/salt are NOT NULL, so they must be supplied
-- explicitly (there is no usable default).
INSERT OR IGNORE INTO users (username, email, password_hash, salt, approved, email_verified) VALUES
    ('beacon-contrib-1', 'beacon-contrib-1@example.test', 'seed-hash', 'seed-salt', 1, 1),
    ('beacon-contrib-2', 'beacon-contrib-2@example.test', 'seed-hash', 'seed-salt', 1, 1),
    ('beacon-contrib-3', 'beacon-contrib-3@example.test', 'seed-hash', 'seed-salt', 1, 1),
    ('beacon-contrib-4', 'beacon-contrib-4@example.test', 'seed-hash', 'seed-salt', 1, 1),
    ('beacon-contrib-5', 'beacon-contrib-5@example.test', 'seed-hash', 'seed-salt', 1, 1),
    ('beacon-contrib-6', 'beacon-contrib-6@example.test', 'seed-hash', 'seed-salt', 1, 1);

-- progress is UNIQUE(date, user_id); without OR IGNORE a re-seed aborts the
-- whole script and leaves the fixtures half-applied.
INSERT OR IGNORE INTO progress (date, distance, user_id) VALUES
    (date('now', '-1 day'), 4.2, (SELECT id FROM users WHERE username = 'beacon-contrib-1')),
    (date('now', '-1 day'), 5.1, (SELECT id FROM users WHERE username = 'beacon-contrib-2')),
    (date('now', '-1 day'), 6.3, (SELECT id FROM users WHERE username = 'beacon-contrib-3')),
    (date('now', '-2 day'), 7.8, (SELECT id FROM users WHERE username = 'beacon-contrib-4')),
    (date('now', '-2 day'), 8.9, (SELECT id FROM users WHERE username = 'beacon-contrib-5')),
    (date('now', '-3 day'), 12.4, (SELECT id FROM users WHERE username = 'beacon-contrib-6'));

-- campaign_participants is UNIQUE(user_id, campaign_id, run_id); OR IGNORE
-- makes a re-seed idempotent instead of aborting on the first existing row.
INSERT OR IGNORE INTO campaign_participants (campaign_id, run_id, user_id, progress_distance, joined_at) VALUES
    ((SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch'), (SELECT id FROM campaign_runs WHERE campaign_id = (SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch') AND run_number = 1), (SELECT id FROM users WHERE username = 'beacon-contrib-1'), 4.2, datetime('now', '-2 day')),
    ((SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch'), (SELECT id FROM campaign_runs WHERE campaign_id = (SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch') AND run_number = 1), (SELECT id FROM users WHERE username = 'beacon-contrib-2'), 5.1, datetime('now', '-2 day')),
    ((SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch'), (SELECT id FROM campaign_runs WHERE campaign_id = (SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch') AND run_number = 1), (SELECT id FROM users WHERE username = 'beacon-contrib-3'), 6.3, datetime('now', '-2 day')),
    ((SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch'), (SELECT id FROM campaign_runs WHERE campaign_id = (SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch') AND run_number = 1), (SELECT id FROM users WHERE username = 'beacon-contrib-4'), 7.8, datetime('now', '-2 day')),
    ((SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch'), (SELECT id FROM campaign_runs WHERE campaign_id = (SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch') AND run_number = 1), (SELECT id FROM users WHERE username = 'beacon-contrib-5'), 8.9, datetime('now', '-2 day')),
    ((SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch'), (SELECT id FROM campaign_runs WHERE campaign_id = (SELECT id FROM campaign_definitions WHERE slug = 'beacon-watch') AND run_number = 1), (SELECT id FROM users WHERE username = 'beacon-contrib-6'), 12.4, datetime('now', '-2 day'));

-- Mirror each in-window seeded walk into the ledger. The unique
-- (participant_id, source_progress_id) constraint plus OR IGNORE keeps re-runs
-- from double-crediting a walk.
INSERT OR IGNORE INTO campaign_progress_ledger (participant_id, run_id, source_progress_id, distance)
SELECT p.id, p.run_id, pr.id, pr.distance
FROM campaign_participants p
JOIN users u ON u.id = p.user_id
JOIN campaign_definitions d ON d.id = p.campaign_id
JOIN campaign_runs r ON r.id = p.run_id AND r.campaign_id = p.campaign_id
JOIN progress pr ON pr.user_id = p.user_id
WHERE d.slug = 'beacon-watch'
  AND r.run_number = 1
  AND u.username IN (
    'beacon-contrib-1', 'beacon-contrib-2', 'beacon-contrib-3',
    'beacon-contrib-4', 'beacon-contrib-5', 'beacon-contrib-6'
  )
  AND pr.date >= r.start_date
  AND pr.date <= r.end_date;

-- A second campaign with a current (upcoming) run and no image_slug: the card
-- must render copy-only instead of a broken image.
INSERT OR IGNORE INTO campaign_definitions (slug, name, description, image_slug, badge_slug, enabled)
VALUES ('beacon-plain', 'Plain Beacon', 'A beacon rally with no artwork, rendered copy-only.', NULL, NULL, 1);

INSERT OR IGNORE INTO campaign_runs (campaign_id, run_number, target_distance, start_date, end_date, status)
VALUES ((SELECT id FROM campaign_definitions WHERE slug = 'beacon-plain'), 1, 200, date('now', '+1 day'), date('now', '+14 day'), 'upcoming');

-- A completed campaign with no imagery, so the past section renders its final
-- snapshot.
INSERT OR IGNORE INTO campaign_definitions (slug, name, description, image_slug, badge_slug, enabled)
VALUES ('beacon-history', 'The First Lighting', 'The first community lighting of the beacon chain, kept here as history.', 'beacon-history-card', 'community-beacon-watch', 1);

INSERT OR IGNORE INTO campaign_runs (campaign_id, run_number, target_distance, start_date, end_date, status, completed_at, participant_count, contributor_count, total_distance)
VALUES ((SELECT id FROM campaign_definitions WHERE slug = 'beacon-history'), 1, 100, date('now', '-30 day'), date('now', '-16 day'), 'completed', datetime('now', '-16 day'), 3, 2, 104.5);
`;

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

async function seedCampaignFixtures(request) {
    const today = utcToday();
    const before = await fetchCampaigns(request);
    const beaconWatch = before.find((campaign) => campaign.slug === 'beacon-watch');
    const windowCoversToday = Boolean(
        beaconWatch?.activeRun
        && beaconWatch.activeRun.status === 'active'
        && beaconWatch.activeRun.startDate <= today
        && today <= beaconWatch.activeRun.endDate,
    );
    const hasCopyOnlyCard = before.some((campaign) => (
        campaign.slug === 'beacon-plain' && campaign.activeRun
    ));
    const hasHistory = before.some((campaign) => (
        campaign.slug === 'beacon-history'
        && Array.isArray(campaign.pastRuns)
        && campaign.pastRuns.length > 0
    ));

    // Healthy fixtures: skip the wrangler round-trip. Any missing fixture, or a
    // run window that has aged out, falls through to the idempotent re-seed.
    if (windowCoversToday && hasCopyOnlyCard && hasHistory) {
        return;
    }

    const sqlPath = path.join(os.tmpdir(), 'wtm-events-spec-seed.sql');
    fs.writeFileSync(sqlPath, SEED_SQL, 'utf8');
    try {
        execSync(`npx wrangler d1 execute DB --local --yes --file "${sqlPath}"`, {
            cwd: REPO_ROOT,
            timeout: 120000,
            stdio: 'pipe',
            encoding: 'utf8',
        });
    } catch (error) {
        console.error('events spec: campaign fixture seed failed; data tests will skip', error.message);
        return;
    }

    // Verify the dev server actually serves the seeded state before the
    // data-dependent tests rely on it.
    const after = await fetchCampaigns(request);
    const seeded = after.find((campaign) => campaign.slug === 'beacon-watch');
    if (!seeded || !seeded.activeRun) {
        console.error('events spec: seeded campaign is not visible through the API; data tests will skip');
    }
}

test.describe('community campaigns page', () => {
    // One worker seeds the fixtures; serial mode keeps every test in this file
    // behind that single beforeAll.
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({ request }) => {
        await seedCampaignFixtures(request);
    });

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

    test('campaign cards show imagery or copy-only, progress bar, participants, and which-days copy', async ({ page, request }) => {
        const campaigns = await fetchCampaigns(request);
        const withRun = campaigns.filter((entry) => entry.activeRun);
        if (withRun.length === 0) {
            test.skip(true, 'No campaign has an upcoming or active run; nothing to render a card for.');
            return;
        }

        const imageryCampaign = withRun.find((entry) => entry.imageSlug);
        const copyOnlyCampaign = withRun.find((entry) => !entry.imageSlug);
        const campaign = imageryCampaign ?? copyOnlyCampaign;

        await page.goto(`${BASE_URL}${EVENTS_PATH}`, { waitUntil: 'domcontentloaded' });

        const card = page.locator(`${CARD}[data-campaign="${campaign.slug}"]`).first();
        await expect(card).toBeVisible({ timeout: 15000 });

        await expect(card.locator('.event-card__title')).toHaveText(campaign.name);
        await expect(card.locator('.event-progress__track[role="progressbar"]')).toBeVisible();
        await expect(card.locator('.event-progress__meta')).toContainText('walker');
        await expect(card).toContainText('Walks dated');
        await expect(card).toContainText('count toward this campaign');

        if (campaign.imageSlug) {
            const image = card.locator('.event-card__image');
            await expect(image).toHaveAttribute('src', `/img/highres/${campaign.imageSlug}.webp`);
            const thumb = card.locator('.event-card__thumb');
            await expect(thumb).toHaveAttribute('src', `/img/thumbs/${campaign.imageSlug}-thumb.webp`);
        } else {
            await expect(card.locator('.event-card__art')).toHaveCount(0);
        }

        // The copy-only campaign must never render a broken image.
        if (copyOnlyCampaign && copyOnlyCampaign.slug !== campaign.slug) {
            const plainCard = page.locator(`${CARD}[data-campaign="${copyOnlyCampaign.slug}"]`).first();
            await expect(plainCard).toBeVisible({ timeout: 15000 });
            await expect(plainCard.locator('.event-card__art')).toHaveCount(0);
            await expect(plainCard).toContainText(copyOnlyCampaign.description);
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
        // Scope to this campaign: other campaigns may also carry past runs.
        const pastCards = pastSection.locator(`.event-past-card[data-campaign="${withHistory.slug}"]`);
        await expect(pastCards).toHaveCount(withHistory.pastRuns.length);
        await expect(pastCards.first()).toContainText('Final progress');
        await expect(pastCards.first()).toContainText(/Completed|Expired/);
    });
});
