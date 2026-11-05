// @ts-check
const {
    test,
    expect,
    navigateAuthenticated,
} = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const UI_TIMEOUT = 15000;
const EXPLORER_API = `${BASE_URL}/cdn-cgi/local/explorer/api`;

/**
 * The mock-auth test seam creates ordinary users. There is deliberately no
 * "grant admin" API, so the admin fixture promotes its own uniquely named user.
 * Fixture SQL goes through the dev server's Local Explorer D1 API rather than a
 * direct SQLite connection: an external writer invalidates the worker's D1
 * session snapshot, which surfaces as a spurious 500 on the next request. The
 * browser still talks to the real worker + real D1 stack.
 */
function uniqueId() {
    return Math.random().toString(36).substring(2, 8);
}

let localD1DatabaseId = '';

async function localD1Database(request) {
    if (localD1DatabaseId) return localD1DatabaseId;

    const response = await request.get(`${EXPLORER_API}/d1/database`);
    const body = await response.text();
    expect(response.ok(), `local D1 discovery failed: ${response.status()} ${body}`).toBeTruthy();
    const databases = JSON.parse(body).result ?? [];
    // Only one D1 binding is configured; prefer it by name when present.
    const database = databases.find((entry) => entry.name === 'DB') ?? databases[0];
    expect(
        database,
        'Local D1 database not found. Run "npm run seedLocalD1" before the E2E suite.',
    ).toBeTruthy();
    localD1DatabaseId = database.uuid;
    return localD1DatabaseId;
}

function d1Params(params) {
    // The Local Explorer endpoint only accepts string parameters; D1 performs
    // the numeric conversion itself.
    return params.map((value) => (value === null ? null : String(value)));
}

async function queryLocalD1(request, sql, params = []) {
    const databaseId = await localD1Database(request);
    const response = await request.post(`${EXPLORER_API}/d1/database/${databaseId}/raw`, {
        data: { sql, params: d1Params(params) },
    });
    const body = await response.text();
    expect(
        response.ok(),
        `local D1 query failed: ${response.status()} ${body} :: ${sql} ${JSON.stringify(params)}`,
    ).toBeTruthy();
    const [result] = JSON.parse(body).result ?? [];
    expect(result?.success, `local D1 query failed: ${body}`).toBeTruthy();
    return result;
}

async function batchLocalD1(request, statements) {
    const databaseId = await localD1Database(request);
    const response = await request.post(`${EXPLORER_API}/d1/database/${databaseId}/raw`, {
        data: {
            batch: statements.map(({ sql, params = [] }) => ({ sql, params: d1Params(params) })),
        },
    });
    const body = await response.text();
    expect(response.ok(), `local D1 batch failed: ${response.status()} ${body}`).toBeTruthy();
    const results = JSON.parse(body).result ?? [];
    for (const result of results) {
        expect(result?.success, `local D1 batch failed: ${body}`).toBeTruthy();
    }
    return results;
}

function authHeaders(authToken) {
    return {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
    };
}

function isoDaysFromToday(offset) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
}

async function ensureSessionUser(request, authToken) {
    const response = await request.get(`${BASE_URL}/api/session`, {
        headers: authHeaders(authToken),
    });
    const body = await response.text();
    expect(response.ok(), `mock session setup failed: ${response.status()} ${body}`).toBeTruthy();
    return JSON.parse(body);
}

async function createEncounterViaApi(request, authToken, run) {
    const response = await request.post(`${BASE_URL}/api/admin/encounters`, {
        headers: authHeaders(authToken),
        data: {
            slug: `${run.prefix}-encounter`,
            name: `E2E Encounter ${run.id}`,
            description: 'Seeded by the admin encounters Playwright smoke suite.',
            image_slug: 'nazgul-pursuit',
            badge_slug: `${run.prefix}-badge`,
            badge_name: `E2E Badge ${run.id}`,
            badge_description: 'Badge auto-created by the admin encounters smoke suite.',
            badge_image_slug: `${run.prefix}-badge`,
            duration_days: 5,
            target_stretch_multiplier: 1.2,
            target_min_distance: 4,
            target_max_distance: 20,
            is_repeatable: true,
        },
    });

    expect(
        response.ok(),
        `admin encounter seed failed: ${response.status()} ${await response.text()}`,
    ).toBeTruthy();
    const body = await response.json();
    return body.encounter;
}

/**
 * Deterministic setup for the disable-confirmation flow: materialize one active
 * occurrence for the freshly created definition. Going through daily-roll
 * randomness could offer the seeded Nazgul definition instead, so the fixture
 * writes the occurrence row straight to local D1 and then drives the admin
 * action in the UI.
 */
async function seedActiveOccurrence(request, definitionId, userId) {
    const rollDate = new Date().toISOString().slice(0, 10);
    const roll = await queryLocalD1(
        request,
        `INSERT INTO daily_rolls (user_id, roll_date, encounter_definition_id, preview_target_distance, status)
         VALUES (?, ?, ?, ?, 'accepted')`,
        [userId, rollDate, definitionId, 10],
    );

    await queryLocalD1(
        request,
        `INSERT INTO encounter_occurrences
           (definition_id, user_id, daily_roll_id, status, personalized_target,
            started_at, coverage_end_date, grace_deadline)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
        [
            definitionId,
            userId,
            Number(roll.meta.last_row_id),
            10,
            rollDate,
            isoDaysFromToday(3),
            isoDaysFromToday(7),
        ],
    );
}

async function occurrenceStatus(request, definitionId) {
    const result = await queryLocalD1(
        request,
        `SELECT status FROM encounter_occurrences WHERE definition_id = ? ORDER BY id DESC LIMIT 1`,
        [definitionId],
    );
    return result.results?.rows?.[0]?.[0] ?? null;
}

/**
 * Navigate once and wait for the island's own readiness signals. A failed API
 * request now fails the test instead of being papered over by a navigation
 * retry, so a real one-off 500 is visible.
 */
async function gotoAdminPage(page, authToken) {
    await navigateAuthenticated(page, authToken, '/admin');

    const section = page.locator('.admin-encounters');
    // The island starts in a loading state and swaps to a table or empty panel
    // once the real API response arrives.
    await expect(section.locator('.admin-encounters-table, .admin-encounters-empty')).toBeVisible({
        timeout: UI_TIMEOUT,
    });
    await expect(section.locator('.admin-error')).toHaveCount(0);
    return section;
}

function encounterRow(section, slug) {
    return section.locator('.admin-encounters-row', { hasText: slug });
}

/**
 * Submit once and wait for whichever real outcome the island renders. There is
 * no retry: a server error surface is reported with its message instead of
 * re-POSTing the form.
 */
async function submitEncounterForm(form, buttonName) {
    await form.getByRole('button', { name: buttonName }).click();

    const outcome = await Promise.race([
        form.waitFor({ state: 'detached', timeout: UI_TIMEOUT })
            .then(() => 'success', () => 'timeout'),
        form.locator('.admin-error').first().waitFor({ state: 'visible', timeout: UI_TIMEOUT })
            .then(() => 'error', () => 'timeout'),
    ]);

    if (outcome === 'timeout') {
        throw new Error(`form submit "${buttonName}" never settled`);
    }
    if (outcome === 'success') return 'success';

    const text = await form.locator('.admin-error').first().innerText().catch(() => '');
    // The island renders this banner alongside the field errors after a 422.
    if (/Please correct the highlighted fields/i.test(text)) {
        await expect(form.locator('.field-error').first()).toBeVisible();
        return 'validation';
    }
    throw new Error(`form submit "${buttonName}" failed: ${text}`);
}

async function clickEncounterAction(section, row, buttonName, expectedBadge) {
    await row.getByRole('button', { name: buttonName }).click();
    await expect(row.locator('.admin-badge')).toHaveText(expectedBadge, { timeout: UI_TIMEOUT });
    await expect(section.locator('.admin-error')).toHaveCount(0);
}

async function openDisableConfirmation(row, modal) {
    await row.getByRole('button', { name: 'Disable' }).click();
    await expect(modal).toBeVisible({ timeout: UI_TIMEOUT });
}

async function chooseDisableOption(row, modal, optionName, expectedBadge) {
    await modal.getByRole('button', { name: optionName }).click();
    await expect(modal).toBeHidden({ timeout: UI_TIMEOUT });
    await expect(row.locator('.admin-badge')).toHaveText(expectedBadge, { timeout: UI_TIMEOUT });
}

async function deleteWorkerFixtures(request, slugPrefix) {
    const like = `${slugPrefix}%`;

    // Occurrences and rolls reference definitions without ON DELETE CASCADE,
    // so remove the children before the definition rows.
    await batchLocalD1(request, [
        {
            sql: `DELETE FROM encounter_occurrences
                  WHERE definition_id IN (SELECT id FROM personal_encounter_definitions WHERE slug LIKE ?)`,
            params: [like],
        },
        {
            sql: `DELETE FROM daily_rolls
                  WHERE encounter_definition_id IN (SELECT id FROM personal_encounter_definitions WHERE slug LIKE ?)`,
            params: [like],
        },
        {
            sql: 'DELETE FROM personal_encounter_definitions WHERE slug LIKE ?',
            params: [like],
        },
        {
            sql: 'DELETE FROM achievement_definitions WHERE slug LIKE ?',
            params: [like],
        },
    ]);
}

async function deleteWalkerFixtures(request, usernames) {
    for (const username of usernames) {
        // daily_rolls/encounter_occurrences only cascade from users when the
        // connection enforces foreign keys, so remove the children explicitly.
        await batchLocalD1(request, [
            {
                sql: `DELETE FROM encounter_occurrences
                      WHERE user_id IN (SELECT id FROM users WHERE username = ?)`,
                params: [username],
            },
            {
                sql: `DELETE FROM daily_rolls
                      WHERE user_id IN (SELECT id FROM users WHERE username = ?)`,
                params: [username],
            },
            {
                sql: 'DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = ?)',
                params: [username],
            },
            { sql: 'DELETE FROM users WHERE username = ?', params: [username] },
        ]);
    }
}

// The admin islands talk straight to the API. Keep the service worker out of
// the way so page.route interception for the empty-state edge case is reliable
// (requests made by a controlling SW bypass Playwright routing).
test.use({ serviceWorkers: 'block' });

test.describe('Admin personal encounter management', () => {
    /** One promoted admin per worker: the DB is shared, so a distinct identity
     *  per worker avoids cross-worker 403s during cleanup. */
    let adminUsername = '';
    let adminToken = '';
    let fixtureSlugPrefix = '';
    /** Walker users created by the active-occurrence flow, removed in afterAll. */
    let walkerUsernames = [];
    /** @type {{ id: string, prefix: string } | null} */
    let run = null;

    test.beforeAll(async ({ request }, testInfo) => {
        adminUsername = `AdminEncounters_E2E${testInfo.workerIndex}`;
        adminToken = `TEST_MOCK_TOKEN_${adminUsername}`;
        fixtureSlugPrefix = `e2e-w${testInfo.workerIndex}`;
        walkerUsernames = [];

        // Clear rows left by an earlier aborted run in this worker slot.
        await deleteWorkerFixtures(request, fixtureSlugPrefix);

        await ensureSessionUser(request, adminToken);

        const promotion = await queryLocalD1(
            request,
            'UPDATE users SET is_admin = 1 WHERE username = ?',
            [adminUsername],
        );
        expect(Number(promotion.meta.changes), 'admin promotion should update exactly one user').toBe(1);
    });

    test.afterAll(async ({ request }) => {
        await deleteWorkerFixtures(request, fixtureSlugPrefix);
        await deleteWalkerFixtures(request, walkerUsernames);
        if (adminUsername) {
            await queryLocalD1(
                request,
                'UPDATE users SET is_admin = 0 WHERE username = ?',
                [adminUsername],
            );
        }
    });

    test.beforeEach(() => {
        const id = uniqueId();
        run = {
            id,
            prefix: `${fixtureSlugPrefix}-${id}`,
        };
    });

    test('lists encounter definitions with duration, badge, and status', async ({ page, request }) => {
        if (!run) throw new Error('admin fixture missing');
        const created = await createEncounterViaApi(request, adminToken, run);

        const section = await gotoAdminPage(page, adminToken);

        // The migration-seeded encounter is always present in a seeded local DB.
        const seededRow = encounterRow(section, 'nazgul-pursuit');
        await expect(seededRow).toBeVisible();
        await expect(seededRow.locator('.admin-encounters-name')).toHaveText('Outrun the Nazgûl');

        const row = encounterRow(section, created.slug);
        await expect(row).toBeVisible();
        await expect(row.locator('.admin-encounters-name')).toHaveText(created.name);
        await expect(row).toContainText(`${created.duration_days} days`);
        await expect(row.locator('.admin-encounters-badge')).toHaveText(`E2E Badge ${run.id}`);
        await expect(row.locator('.admin-badge')).toHaveText('Disabled');
    });

    test('shows the empty state and a New Encounter action', async ({ page }) => {
        if (!run) throw new Error('admin fixture missing');

        // Edge case only: the seeded Nazgul definition means a cleaned real DB is
        // never empty. Intercept this one read so the empty panel is exercised
        // without deleting shared definitions. All mutations stay on the real API.
        await page.route('**/api/admin/encounters', (route) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ encounters: [] }),
        }));

        const section = await gotoAdminPage(page, adminToken);
        const empty = section.locator('.admin-encounters-empty');
        await expect(empty).toBeVisible();
        await expect(empty).toContainText('No personal encounters yet.');
        await expect(empty.getByRole('button', { name: /New Encounter/ })).toBeVisible();
        await expect(
            section.locator('.admin-section-heading').getByRole('button', { name: /New Encounter/ }),
        ).toBeVisible();
    });

    test('creates an encounter with inline badge metadata', async ({ page, request }) => {
        if (!run) throw new Error('admin fixture missing');
        const section = await gotoAdminPage(page, adminToken);

        await section.locator('.admin-section-heading')
            .getByRole('button', { name: /New Encounter/ })
            .click();

        const form = page.locator('.admin-encounter-form');
        await expect(form).toContainText('Create Encounter');
        const slug = `${run.prefix}-encounter`;
        await form.locator('#create-encounter-slug').fill(slug);
        await form.locator('#create-encounter-name').fill(`Created Encounter ${run.id}`);
        await form.locator('#create-encounter-description').fill('Created from the admin E2E smoke suite.');
        await form.locator('#create-encounter-image-slug').fill('nazgul-pursuit');
        await form.locator('#create-encounter-duration-days').fill('7');
        await form.locator('#create-encounter-stretch-multiplier').fill('1.4');
        await form.locator('#create-encounter-min-distance').fill('6');
        await form.locator('#create-encounter-max-distance').fill('18');
        await form.locator('#create-encounter-badge-slug').fill(`${run.prefix}-badge`);
        await form.locator('#create-encounter-badge-name').fill(`Inline Badge ${run.id}`);
        await form.locator('#create-encounter-badge-description').fill('Inline badge description from E2E.');
        await form.locator('#create-encounter-badge-image-slug').fill(`${run.prefix}-badge`);
        expect(await submitEncounterForm(form, 'Create Encounter')).toBe('success');

        await expect(section.locator('.admin-notice')).toHaveText('Encounter created');
        await expect(form).toHaveCount(0);

        const row = encounterRow(section, slug);
        await expect(row).toBeVisible();
        await expect(row.locator('.admin-encounters-name')).toHaveText(`Created Encounter ${run.id}`);
        await expect(row).toContainText('7 days');
        await expect(row.locator('.admin-encounters-badge')).toHaveText(`Inline Badge ${run.id}`);
        await expect(row.locator('.admin-badge')).toHaveText('Disabled');

        const listResponse = await request.get(`${BASE_URL}/api/admin/encounters`, {
            headers: authHeaders(adminToken),
        });
        expect(listResponse.ok()).toBeTruthy();
        const { encounters } = await listResponse.json();
        const saved = encounters.find((encounter) => encounter.slug === slug);
        expect(saved, 'created encounter should be returned by the admin API').toBeTruthy();
        expect(saved.enabled).toBe(false);
        expect(saved.duration_days).toBe(7);
        expect(saved.badge_slug).toBe(`${run.prefix}-badge`);
        expect(saved.badge).toBeTruthy();
        expect(saved.badge.name).toBe(`Inline Badge ${run.id}`);
        expect(saved.badge.badge_type).toBe('challenge');
    });

    test('shows field-level validation errors without clearing the form', async ({ page }) => {
        if (!run) throw new Error('admin fixture missing');
        const section = await gotoAdminPage(page, adminToken);

        await section.locator('.admin-section-heading')
            .getByRole('button', { name: /New Encounter/ })
            .click();

        const form = page.locator('.admin-encounter-form');
        await form.locator('#create-encounter-slug').fill('Invalid Slug!');
        await form.locator('#create-encounter-name').fill('');
        await form.locator('#create-encounter-description').fill('Validation coverage.');
        await form.locator('#create-encounter-image-slug').fill('nazgul-pursuit');
        await form.locator('#create-encounter-min-distance').fill('50');
        await form.locator('#create-encounter-max-distance').fill('10');
        await form.locator('#create-encounter-badge-slug').fill(`${run.prefix}-badge`);
        await form.locator('#create-encounter-badge-name').fill('Inline Badge');
        await form.locator('#create-encounter-badge-description').fill('Inline badge description.');
        await form.locator('#create-encounter-badge-image-slug').fill(`${run.prefix}-badge`);
        expect(await submitEncounterForm(form, 'Create Encounter')).not.toBe('success');

        await expect(form.getByText('Please correct the highlighted fields.')).toBeVisible();
        await expect(form.getByText('Slug must be lowercase words separated by hyphens')).toBeVisible();
        await expect(form.getByText('Name is required')).toBeVisible();
        await expect(
            form.getByText('Target minimum distance must be less than or equal to the maximum'),
        ).toBeVisible();
        await expect(
            form.getByText('Target maximum distance must be greater than or equal to the minimum'),
        ).toBeVisible();

        await expect(form.locator('#create-encounter-slug')).toHaveAttribute('aria-invalid', 'true');
        await expect(form.locator('#create-encounter-slug')).toHaveValue('Invalid Slug!');
        await expect(form.locator('#create-encounter-description')).toHaveValue('Validation coverage.');
        await expect(section.locator('.admin-notice')).toHaveCount(0);
        await expect(section.locator('.admin-encounters-row', { hasText: 'Invalid Slug!' })).toHaveCount(0);
    });

    test('edits an encounter and its badge metadata through the dashboard', async ({ page, request }) => {
        if (!run) throw new Error('admin fixture missing');
        const created = await createEncounterViaApi(request, adminToken, run);
        const section = await gotoAdminPage(page, adminToken);

        const row = encounterRow(section, created.slug);
        await row.getByRole('button', { name: 'Edit' }).click();

        const form = page.locator('.admin-encounter-form');
        await expect(form).toContainText('Edit Encounter');
        const editPrefix = `#edit-encounter-${created.id}`;
        await form.locator(`${editPrefix}-name`).fill(`Edited Encounter ${run.id}`);
        await form.locator(`${editPrefix}-duration-days`).fill('9');
        await form.locator(`${editPrefix}-badge-name`).fill(`Edited Badge ${run.id}`);
        await form.locator(`${editPrefix}-badge-description`).fill('Edited badge description.');
        expect(await submitEncounterForm(form, 'Save Encounter')).toBe('success');

        await expect(section.locator('.admin-notice')).toHaveText('Encounter updated');
        await expect(row.locator('.admin-encounters-name')).toHaveText(`Edited Encounter ${run.id}`);
        await expect(row).toContainText('9 days');
        await expect(row.locator('.admin-encounters-badge')).toHaveText(`Edited Badge ${run.id}`);

        const detailResponse = await request.get(
            `${BASE_URL}/api/admin/encounters/${created.id}`,
            { headers: authHeaders(adminToken) },
        );
        expect(detailResponse.ok()).toBeTruthy();
        const { encounter } = await detailResponse.json();
        expect(encounter.name).toBe(`Edited Encounter ${run.id}`);
        expect(encounter.duration_days).toBe(9);
        expect(encounter.badge.name).toBe(`Edited Badge ${run.id}`);
        expect(encounter.badge.description).toBe('Edited badge description.');
        expect(encounter.enabled).toBe(false);
    });

    test('enables and disables an encounter with no active occurrences', async ({ page, request }) => {
        if (!run) throw new Error('admin fixture missing');
        const created = await createEncounterViaApi(request, adminToken, run);
        expect(created.enabled).toBe(false);
        const section = await gotoAdminPage(page, adminToken);

        const row = encounterRow(section, created.slug);
        await expect(row.locator('.admin-badge')).toHaveText('Disabled');

        await clickEncounterAction(section, row, 'Enable', 'Enabled');
        await expect(section.locator('.admin-notice')).toContainText(`Enabled ${created.name}`);

        await clickEncounterAction(section, row, 'Disable', 'Disabled');
        await expect(section.locator('.admin-notice')).toContainText(`Disabled ${created.name}`);
        await expect(page.locator('.admin-encounters-modal')).toHaveCount(0);

        const detailResponse = await request.get(
            `${BASE_URL}/api/admin/encounters/${created.id}`,
            { headers: authHeaders(adminToken) },
        );
        const { encounter } = await detailResponse.json();
        expect(encounter.enabled).toBe(false);
    });

    test('keeps or cancels active challenges through the disable confirmation', async ({ page, request }) => {
        if (!run) throw new Error('admin fixture missing');
        const created = await createEncounterViaApi(request, adminToken, run);
        const enableResponse = await request.put(
            `${BASE_URL}/api/admin/encounters/${created.id}/enable`,
            { headers: authHeaders(adminToken) },
        );
        expect(
            enableResponse.ok(),
            `enable encounter failed: ${enableResponse.status()} ${await enableResponse.text()}`,
        ).toBeTruthy();

        // A fresh walker per run keeps daily_rolls' (user_id, roll_date)
        // uniqueness intact when the suite is repeated on the same day.
        const walkerUsername = `E2EOcc_${run.id}`;
        walkerUsernames.push(walkerUsername);
        const walkerToken = `TEST_MOCK_TOKEN_${walkerUsername}`;
        const walker = await ensureSessionUser(request, walkerToken);
        await seedActiveOccurrence(request, created.id, walker.userId);

        const section = await gotoAdminPage(page, adminToken);
        const row = encounterRow(section, created.slug);
        await expect(row.locator('.admin-badge')).toHaveText('Enabled');

        const modal = page.locator('.admin-encounters-modal');

        // Branch 1: keep active challenges running while disabling future rolls.
        await openDisableConfirmation(row, modal);
        await expect(modal).toContainText('1 user has active challenge');
        await chooseDisableOption(row, modal, 'Keep active challenges', 'Disabled');
        expect(await occurrenceStatus(request, created.id)).toBe('active');

        // Branch 2: re-enable, then cancel all active challenges.
        await clickEncounterAction(section, row, 'Enable', 'Enabled');
        await openDisableConfirmation(row, modal);
        await expect(modal).toContainText('1 user has active challenge');
        await chooseDisableOption(row, modal, 'Cancel all active challenges', 'Disabled');
        await expect(section.locator('.admin-notice')).toContainText('1 active challenge cancelled');
        expect(await occurrenceStatus(request, created.id)).toBe('failed');
    });
});
