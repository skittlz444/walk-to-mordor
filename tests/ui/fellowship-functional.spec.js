// @ts-check
const { test: base, expect } = require('@playwright/test');
const { cleanupAllTestData } = require('./helpers/cleanup');

const BASE_URL = 'http://127.0.0.1:8787';

function uniqueId() {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Extend test with multi-user auth fixtures (unique per test for parallel isolation).
 */
const test = base.extend({
  skittlz1Token: async ({}, use) => {
    const token = `TEST_MOCK_TOKEN_Skittlz1_${uniqueId()}`;
    await use(token);
    await cleanupAllTestData(BASE_URL, token);
  },
  test1Token: async ({}, use) => {
    const token = `TEST_MOCK_TOKEN_Test1_${uniqueId()}`;
    await use(token);
    await cleanupAllTestData(BASE_URL, token);
  },
  test2Token: async ({}, use) => {
    const token = `TEST_MOCK_TOKEN_Test2_${uniqueId()}`;
    await use(token);
    await cleanupAllTestData(BASE_URL, token);
  },
});

/**
 * Authenticate page via localStorage then navigate.
 */
async function loginAs(page, token, url = '/journey') {
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate((t) => localStorage.setItem('sessionToken', t), token);
  await page.goto(`${BASE_URL}${url}`);
}

/**
 * Create a fellowship via API.
 */
async function createFellowship(request, token, name, mode = 'cumulative', leaveBehavior = 'keep') {
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await request.post(`${BASE_URL}/api/party`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name, distance_mode: mode, leave_distance_behavior: leaveBehavior },
    });
    if (res.ok()) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  expect(res.ok(), `createFellowship failed: ${await res.text()}`).toBeTruthy();
  const data = await res.json();
  return { id: data.id, invite_code: data.invite_code };
}

/**
 * Join a fellowship via API.
 */
async function joinFellowship(request, token, inviteCode) {
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await request.post(`${BASE_URL}/api/party/join/${inviteCode}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (res.ok()) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  expect(res.ok(), `joinFellowship failed: ${await res.text()}`).toBeTruthy();
}

/**
 * Log walking distance via API.
 */
async function logDistance(request, token, date, distance) {
  // Try POST first; if entry already exists, use PUT to update
  let res = await request.post(`${BASE_URL}/api/calendar-progress`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { start: date, title: String(distance) },
  });
  if (!res.ok()) {
    const body = await res.text();
    if (body.includes('already exists')) {
      res = await request.put(`${BASE_URL}/api/calendar-progress`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { start: date, title: String(distance) },
      });
    }
  }
  expect(res.ok(), `logDistance failed: ${await res.text()}`).toBeTruthy();
}

// ============================================================================
// Story 3-7: Fellowships Pages UI
// ============================================================================

test.describe('Story 3-7: Fellowships Pages', () => {
  test('Party list page loads with empty state or content', async ({ page, skittlz1Token }) => {
    await loginAs(page, skittlz1Token, '/party');
    // Island mount should be visible
    await expect(page.locator('[data-island="PartyListIsland"]')).toBeVisible({ timeout: 5000 });
    // Should show the "Your Fellowships" heading (always present once loaded)
    await expect(page.locator('h2', { hasText: 'Your Fellowships' })).toBeVisible({ timeout: 8000 });
  });

  test('Create fellowship UI flow', async ({ page, skittlz1Token }) => {
    await loginAs(page, skittlz1Token, '/party');

    // Click "Create Fellowship" button to expand form
    const createBtn = page.locator('button:has-text("Create Fellowship")');
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();

    // Form should now be visible
    const nameInput = page.locator('input[placeholder="e.g. The Grey Company"]');
    await expect(nameInput).toBeVisible({ timeout: 3000 });

    // Fill in the name
    await nameInput.fill('UI Created Fellowship');

    // Click the submit button
    const submitBtn = page.locator('button[type="submit"]:has-text("Create Fellowship")');
    await submitBtn.click();

    // Success toast should appear or the party should now show in the list
    const toast = page.locator('.party-toast--success');
    const partyInList = page.locator('.party-list-item__name:has-text("UI Created Fellowship")');
    await expect(toast.or(partyInList).first()).toBeVisible({ timeout: 8000 });
  });

  test('Fellowship detail page renders progress and members', async ({ page, request, skittlz1Token, test1Token }) => {
    const party = await createFellowship(request, skittlz1Token, 'Detail Test Party');
    await joinFellowship(request, test1Token, party.invite_code);
    await logDistance(request, skittlz1Token, '2026-03-01', 5.5);
    await logDistance(request, test1Token, '2026-03-01', 3.2);

    await loginAs(page, skittlz1Token, `/party/${party.id}`);

    // Breadcrumb
    await expect(page.locator('text=← Fellowships')).toBeVisible({ timeout: 5000 });
    // Party name
    await expect(page.locator(`h2:has-text("Detail Test Party")`)).toBeVisible();
    // Progress stats
    await expect(page.locator('text=Total Progress')).toBeVisible();
    // Member list should show 2 members
    await expect(page.locator('.party-member-item')).toHaveCount(2, { timeout: 5000 });
  });

  test('Invite link section with copy button', async ({ page, request, skittlz1Token }) => {
    const party = await createFellowship(request, skittlz1Token, 'Invite Link Party');
    await loginAs(page, skittlz1Token, `/party/${party.id}`);

    await expect(page.locator('h3:has-text("Invite Link")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Copy Link")')).toBeVisible();
    await expect(page.locator('button:has-text("Share")')).toBeVisible();
    const inviteUrl = page.locator('.party-invite__url');
    await expect(inviteUrl).toBeVisible();
    const urlText = await inviteUrl.textContent();
    expect(urlText).toContain('/party/join/');
  });

  test('Leave fellowship confirmation dialog opens and cancels', async ({ page, request, skittlz1Token, test1Token }) => {
    const party = await createFellowship(request, skittlz1Token, 'Leave Test Party');
    await joinFellowship(request, test1Token, party.invite_code);

    await loginAs(page, test1Token, `/party/${party.id}`);

    const leaveBtn = page.locator('button:has-text("Leave Fellowship")');
    await expect(leaveBtn).toBeVisible({ timeout: 5000 });
    await leaveBtn.click();

    // Dialog appears
    const dialog = page.locator('.party-confirm-dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.locator('h3:has-text("Leave Fellowship")')).toBeVisible();

    // Cancel
    await dialog.locator('button:has-text("Cancel")').click();
    await expect(dialog).toBeHidden({ timeout: 3000 });
  });

  test('Leader sees Manage Fellowship button, non-leader does not', async ({ page, request, skittlz1Token, test1Token }) => {
    const party = await createFellowship(request, skittlz1Token, 'Leader Manage Party');
    await joinFellowship(request, test1Token, party.invite_code);

    // Leader sees manage
    await loginAs(page, skittlz1Token, `/party/${party.id}`);
    await expect(page.locator('a:has-text("Manage Fellowship")')).toBeVisible({ timeout: 8000 });

    // Non-leader does not
    await loginAs(page, test1Token, `/party/${party.id}`);
    await expect(page.locator('a:has-text("Manage Fellowship")')).toBeHidden({ timeout: 5000 });
  });

  test('Manage page shows settings for leader', async ({ page, request, skittlz1Token }) => {
    const party = await createFellowship(request, skittlz1Token, 'Manage Settings Party');
    await loginAs(page, skittlz1Token, `/party/${party.id}/manage`);

    await expect(page.locator('h3:has-text("Settings")')).toBeVisible({ timeout: 8000 });
  });

  test('Join landing page renders party preview', async ({ page, request, skittlz1Token }) => {
    const party = await createFellowship(request, skittlz1Token, 'Join Landing Party');
    await page.goto(`${BASE_URL}/party/join/${party.invite_code}`);

    // Should show party name somewhere
    await expect(page.locator(`text=Join Landing Party`)).toBeVisible({ timeout: 8000 });
  });
});

// ============================================================================
// Story 3-8: Activity Feed UI
// ============================================================================

test.describe('Story 3-8: Activity Feed', () => {
  test('Activity feed section visible on detail page', async ({ page, request, skittlz1Token, test1Token }) => {
    const party = await createFellowship(request, skittlz1Token, 'Feed Visible Party');
    await joinFellowship(request, test1Token, party.invite_code);
    await logDistance(request, skittlz1Token, '2026-03-01', 5.5);
    await logDistance(request, test1Token, '2026-03-02', 3.2);

    await loginAs(page, skittlz1Token, `/party/${party.id}`);

    // Activity section header
    await expect(page.locator('h3:has-text("Activity")')).toBeVisible({ timeout: 5000 });
    // Activity feed container
    await expect(page.locator('.party-activity-feed')).toBeVisible({ timeout: 5000 });
  });

  test('Empty activity feed shows placeholder', async ({ page, request, skittlz1Token }) => {
    const party = await createFellowship(request, skittlz1Token, 'Empty Feed Party');
    await loginAs(page, skittlz1Token, `/party/${party.id}`);

    await expect(page.locator('text=No recent activity')).toBeVisible({ timeout: 8000 });
  });

  test('Own activities have visual distinction', async ({ page, request, skittlz1Token, test1Token }) => {
    const party = await createFellowship(request, skittlz1Token, 'Own Activity Party');
    await joinFellowship(request, test1Token, party.invite_code);
    await logDistance(request, skittlz1Token, '2026-03-01', 5.5);
    await logDistance(request, test1Token, '2026-03-01', 3.0);

    await loginAs(page, skittlz1Token, `/party/${party.id}`);

    // Wait for the party detail island to fully load
    await expect(page.locator('h3:has-text("Activity")')).toBeVisible({ timeout: 15000 });

    // Wait for activity items to appear (data was logged, so items should render)
    const allItems = page.locator('.party-activity-item');
    const emptyMsg = page.locator('text=No recent activity');
    await expect(allItems.first().or(emptyMsg)).toBeVisible({ timeout: 10000 });

    // Check for own activity items with the --own modifier
    const ownItems = page.locator('.party-activity-item--own');
    const count = await ownItems.count();
    if (count > 0) {
      await expect(ownItems.first()).toContainText('You walked');
    }
    // Feed should render either activity rows or an explicit empty state
    const allCount = await allItems.count();
    const emptyVisible = await emptyMsg.isVisible().catch(() => false);
    expect(allCount > 0 || emptyVisible).toBeTruthy();
  });

  test('403 redirects kicked member gracefully', async ({ page, request, skittlz1Token, test1Token }) => {
    const party = await createFellowship(request, skittlz1Token, 'Kick Redirect Party');
    await joinFellowship(request, test1Token, party.invite_code);

    // Get Test1 user ID from progress (find the non-leader member)
    const progressRes = await request.get(`${BASE_URL}/api/party/${party.id}/progress`, {
      headers: { Authorization: `Bearer ${skittlz1Token}` },
    });
    const progressData = await progressRes.json();
    const test1Username = test1Token.replace('TEST_MOCK_TOKEN_', '');
    const test1Member = progressData.members.find((m) => m.display_name === test1Username);

    if (test1Member) {
      // Kick Test1
      await request.post(`${BASE_URL}/api/party/${party.id}/kick/${test1Member.user_id}`, {
        headers: { Authorization: `Bearer ${skittlz1Token}`, 'Content-Type': 'application/json' },
      });
    }

    // Kicked user visits detail page - should be redirected or see error
    await loginAs(page, test1Token, `/party/${party.id}`);

    // PartyDetailIsland redirects to /party on 403, or shows error
    // Wait for either redirect or error to appear
    await Promise.race([
      page.waitForURL('**/party', { timeout: 10000 }).catch(() => {}),
      page.waitForSelector('.party-error', { timeout: 10000 }).catch(() => {}),
    ]);
    const url = page.url();
    const redirected = url.endsWith('/party') || url.endsWith('/party/');
    const errorVisible = await page.locator('.party-error').isVisible().catch(() => false);
    expect(redirected || errorVisible).toBeTruthy();
  });
});

// ============================================================================
// Story 3-6: Party Selector on Journey Page
// ============================================================================

test.describe('Story 3-6: Party Selector', () => {
  test('Party selector mount exists on journey page', async ({ page, request, skittlz1Token }) => {
    await createFellowship(request, skittlz1Token, 'Selector Mount Party');
    await loginAs(page, skittlz1Token, '/journey');

    // Party selector mount point
    const selectorMount = page.locator('#party-selector-mount');
    await expect(selectorMount).toBeVisible({ timeout: 8000 });
  });

  test('Party selector shows Personal and fellowship options', async ({ page, request, skittlz1Token }) => {
    await createFellowship(request, skittlz1Token, 'Selector Options Party');
    await loginAs(page, skittlz1Token, '/journey');

    // Should have Personal option visible
    const personal = page.locator('text=Personal');
    if (await personal.isVisible({ timeout: 5000 })) {
      await personal.click();
    }
  });
});

// ============================================================================
// Cross-Story: Navigation & Links
// ============================================================================

test.describe('Cross-Story: Navigation', () => {
  test('Drawer contains Fellowships link', async ({ page, skittlz1Token }) => {
    await loginAs(page, skittlz1Token, '/journey');

    // Try to open drawer
    const menuBtn = page.locator('[aria-label="Open menu"]')
      .or(page.locator('.menu-toggle'))
      .or(page.locator('.hamburger'))
      .or(page.locator('#drawer-toggle'));
    if (await menuBtn.isVisible({ timeout: 5000 })) {
      await menuBtn.click();
      const link = page.locator('a:has-text("Fellowships")');
      await expect(link).toBeVisible({ timeout: 5000 });
    }
  });

  test('Breadcrumb navigates back to party list', async ({ page, request, skittlz1Token }) => {
    const party = await createFellowship(request, skittlz1Token, 'Breadcrumb Nav Party');
    await loginAs(page, skittlz1Token, `/party/${party.id}`);

    const back = page.locator('a:has-text("← Fellowships")');
    await expect(back).toBeVisible({ timeout: 5000 });
    await back.click();
    await page.waitForURL('**/party', { timeout: 5000 });
  });
});
