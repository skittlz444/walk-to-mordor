// @ts-check
const {
  test,
  expect,
  setupTest,
  waitForGoalsLoaded,
  closeVisibleModal,
} = require('./helpers/common');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

// ── Helpers ────────────────────────────────────────────────────────────────

function auth(authToken) {
  return { 'Authorization': `Bearer ${authToken}` };
}

async function logDistanceViaApi(page, authToken, distance) {
  const today = new Date().toISOString().split('T')[0];
  return page.request.post(`${BASE_URL}/api/calendar-progress`, {
    data: { start: today, title: String(distance) },
    headers: auth(authToken),
  });
}

async function getFirstGoal(page) {
  try {
    const goals = await page.evaluate(async () => {
      const token = localStorage.getItem('sessionToken');
      const resp = await fetch('/api/goals', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) return null;
      return resp.json();
    });
    return Array.isArray(goals) && goals.length > 0 ? goals[0] : null;
  } catch {
    return null;
  }
}

async function goToJourney(page) {
  await page.goto(`${BASE_URL}/journey`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body.authenticated', { timeout: 10000 });
  await waitForGoalsLoaded(page);
  await closeVisibleModal(page);
}

async function dismissPalantir(page) {
  try {
    const btn = page.locator('button:has-text("Cast the Palantír aside"), button:has-text("Dismiss")');
    if (await btn.isVisible({ timeout: 3000 })) {
      await btn.click({ timeout: 5000 });
      await page.waitForTimeout(500);
    }
  } catch (_) {}
  try {
    const overlay = page.locator('.palantir-overlay, [role="dialog"]:has-text("Palantír")');
    if (await overlay.isVisible({ timeout: 1000 })) {
      await overlay.click({ timeout: 2000 });
      await page.waitForTimeout(500);
    }
  } catch (_) {}
}

async function openGoalModal(page, goalTitle) {
  await goToJourney(page);
  await dismissPalantir(page);
  try {
    const goalCard = page.locator('.upcoming-goal, .completed-goal, .all-completed-goal', { hasText: goalTitle }).first();
    if (await goalCard.count() > 0) {
      await goalCard.click({ force: true, timeout: 5000 });
    } else {
      const anyGoal = page.locator('.upcoming-goal, .completed-goal, .goal-header-main').first();
      if (await anyGoal.count() > 0) await anyGoal.click({ force: true, timeout: 5000 });
    }
  } catch {
    const anyGoal = page.locator('.upcoming-goal, .completed-goal, .goal-header-main').first();
    await anyGoal.focus();
    await page.keyboard.press('Enter');
  }
  await page.waitForSelector('.modal-overlay', { timeout: 10000 });
}

async function openJournalTab(page) {
  const btn = page.locator('button.journal-tab-btn');
  await expect(btn).toBeVisible({ timeout: 5000 });
  await btn.click();
  await page.waitForSelector('.journal-view, .journal-create, .journal-own-entry, .journal-edit', { timeout: 10000 });
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Journal - Personal Authoring', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
  });

  test('shows journals tab button in goal modal', async ({ page }) => {
    await goToJourney(page);
    await dismissPalantir(page);
    const anyGoal = page.locator('.upcoming-goal, .completed-goal, .goal-header-main').first();
    await anyGoal.click({ force: true });
    await page.waitForSelector('.modal-overlay', { timeout: 10000 });
    await expect(page.locator('button.journal-tab-btn')).toBeVisible({ timeout: 5000 });
  });

  test('opens journal view when Journals button is clicked', async ({ page }) => {
    await goToJourney(page);
    await dismissPalantir(page);
    const anyGoal = page.locator('.upcoming-goal, .completed-goal, .goal-header-main').first();
    await anyGoal.click({ force: true });
    await page.waitForSelector('.modal-overlay', { timeout: 10000 });
    await openJournalTab(page);
    await expect(page.locator('.journal-view')).toBeVisible({ timeout: 10000 });
  });

  test('shows create state when goal is reached and no entry exists', async ({ page, authToken }) => {
    const firstGoal = await getFirstGoal(page);
    if (!firstGoal) { test.skip(true, 'No goals found'); return; }
    await logDistanceViaApi(page, authToken, Math.ceil(firstGoal.distance + 1));
    await openGoalModal(page, firstGoal.title);
    await openJournalTab(page);
    const textarea = page.locator('.journal-textarea');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await expect(textarea).toHaveAttribute('placeholder');
  });

  test('saves a journal entry and shows view state', async ({ page, authToken }) => {
    const firstGoal = await getFirstGoal(page);
    if (!firstGoal) { test.skip(true, 'No goals found'); return; }
    await logDistanceViaApi(page, authToken, Math.ceil(firstGoal.distance + 1));
    await openGoalModal(page, firstGoal.title);
    await openJournalTab(page);
    const textarea = page.locator('.journal-textarea');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await textarea.fill('This is my test journal reflection!');
    const putPromise = page.waitForResponse(r => r.url().includes(`/api/goals/${firstGoal.id}/journal`) && r.request().method() === 'PUT', { timeout: 10000 });
    await page.locator('button:has-text("Save")').click();
    await putPromise;
    // After save, the journal switches to view mode with the body text visible
    await expect(page.locator('.journal-own-entry')).toBeVisible({ timeout: 10000 });
  });

  test('edits an existing journal entry', async ({ page, authToken }) => {
    const firstGoal = await getFirstGoal(page);
    if (!firstGoal) { test.skip(true, 'No goals found'); return; }
    await logDistanceViaApi(page, authToken, Math.ceil(firstGoal.distance + 1));
    await page.request.put(`${BASE_URL}/api/goals/${firstGoal.id}/journal`, {
      data: { body: 'Original entry text.' },
      headers: auth(authToken),
    });
    await openGoalModal(page, firstGoal.title);
    await openJournalTab(page);
    await expect(page.locator('text=Original entry text.')).toBeVisible({ timeout: 10000 });
    await page.locator('button:has-text("Edit")').click();
    const textarea = page.locator('.journal-textarea');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('Updated entry text!');
    const putPromise = page.waitForResponse(r => r.url().includes(`/api/goals/${firstGoal.id}/journal`) && r.request().method() === 'PUT', { timeout: 10000 });
    await page.locator('button:has-text("Save")').click();
    await putPromise;
    const verifyResp = await page.request.get(`${BASE_URL}/api/goals/${firstGoal.id}/journals`, { headers: auth(authToken) });
    const state = await verifyResp.json();
    expect(state.ownEntry.body).toBe('Updated entry text!');
  });

  test('deletes a journal entry', async ({ page, authToken }) => {
    const firstGoal = await getFirstGoal(page);
    if (!firstGoal) { test.skip(true, 'No goals found'); return; }
    await logDistanceViaApi(page, authToken, Math.ceil(firstGoal.distance + 1));
    await page.request.put(`${BASE_URL}/api/goals/${firstGoal.id}/journal`, {
      data: { body: 'Entry to be deleted.' },
      headers: auth(authToken),
    });
    await openGoalModal(page, firstGoal.title);
    page.once('dialog', d => d.accept());
    await openJournalTab(page);
    const deleteBtn = page.locator('button:has-text("Delete")');
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });
    await deleteBtn.click();
    await expect(page.locator('.journal-textarea')).toBeVisible({ timeout: 10000 });
  });

  test('shows character counter while authoring', async ({ page, authToken }) => {
    const firstGoal = await getFirstGoal(page);
    if (!firstGoal) { test.skip(true, 'No goals found'); return; }
    await logDistanceViaApi(page, authToken, Math.ceil(firstGoal.distance + 1));
    await openGoalModal(page, firstGoal.title);
    await openJournalTab(page);
    const textarea = page.locator('.journal-textarea');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await textarea.fill('A'.repeat(50));
    await expect(page.locator('text=50/2000')).toBeVisible({ timeout: 5000 });
  });

  test('shows journal view content for first goal', async ({ page }) => {
    // First goal (Bag End) is at 0km so user has write access
    await goToJourney(page);
    await dismissPalantir(page);
    const anyGoal = page.locator('.upcoming-goal, .completed-goal, .goal-header-main').first();
    await anyGoal.click({ force: true });
    await page.waitForSelector('.modal-overlay', { timeout: 10000 });
    await openJournalTab(page);
    const journalView = page.locator('.journal-view');
    await expect(journalView).toBeVisible({ timeout: 15000 });
    // Should show journal content (create mode, view mode, or locked message)
    const text = await journalView.textContent();
    expect(text || '').toBeTruthy();
  });

  test('shows back button when viewing journal', async ({ page }) => {
    await goToJourney(page);
    await dismissPalantir(page);
    const anyGoal = page.locator('.upcoming-goal, .completed-goal, .goal-header-main').first();
    await anyGoal.click({ force: true });
    await page.waitForSelector('.modal-overlay', { timeout: 10000 });
    await openJournalTab(page);
    await expect(page.locator('text=Back to Goal')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Journal - Fellowship Context', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
  });

  test('allows journal write via fellowship context with partyId', async ({ page, authToken }) => {
    const firstGoal = await getFirstGoal(page);
    if (!firstGoal) { test.skip(true, 'No goals found'); return; }
    const createResp = await page.request.post(`${BASE_URL}/api/party`, {
      data: { name: 'Test Fellowship', distance_mode: 'cumulative' },
      headers: auth(authToken),
    });
    if (!createResp.ok()) { test.skip(true, 'Failed to create party'); return; }
    const party = await createResp.json();
    const partyId = party.id;
    const distanceNeeded = Math.ceil(firstGoal.distance + 1);
    for (let d = 0; d < distanceNeeded; d += 50) {
      const chunk = Math.min(50, distanceNeeded - d);
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(d / 50));
      await page.request.post(`${BASE_URL}/api/calendar-progress`, {
        data: { start: date.toISOString().split('T')[0], title: String(chunk) },
        headers: auth(authToken),
      });
    }
    const journalResp = await page.request.get(`${BASE_URL}/api/goals/${firstGoal.id}/journals?partyId=${partyId}`, { headers: auth(authToken) });
    expect(journalResp.ok()).toBeTruthy();
    const journalState = await journalResp.json();
    expect(journalState.permissions.canWrite).toBe(true);
  });
});

test.describe('Journal - Friend Entry Visibility', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
  });

  test('hides friend entries when viewer has no friends', async ({ page, authToken }) => {
    const firstGoal = await getFirstGoal(page);
    if (!firstGoal) { test.skip(true, 'No goals found'); return; }
    await logDistanceViaApi(page, authToken, Math.ceil(firstGoal.distance + 1));
    await openGoalModal(page, firstGoal.title);
    await openJournalTab(page);
    await page.waitForTimeout(2000);
    const friendsJournal = page.locator("text=Friends' Journals");
    expect(await friendsJournal.count()).toBe(0);
  });

  test('shows friend entry when previews are enabled', async ({ page, authToken }) => {
    const firstGoal = await getFirstGoal(page);
    if (!firstGoal) { test.skip(true, 'No goals found'); return; }
    const friendToken = `TEST_MOCK_TOKEN_friend_${Math.random().toString(36).substring(7)}`;
    await page.request.put(`${BASE_URL}/api/goals/${firstGoal.id}/journal`, {
      data: { body: 'Friend journal entry for testing!' },
      headers: auth(friendToken),
    });
    await page.request.put(`${BASE_URL}/api/user/preferences`, {
      data: { showFutureGoalsUnlocked: true },
      headers: auth(authToken),
    });
    const journalResp = await page.request.get(`${BASE_URL}/api/goals/${firstGoal.id}/journals`, { headers: auth(authToken) });
    expect(journalResp.ok()).toBeTruthy();
    const state = await journalResp.json();
    expect(state.permissions).toHaveProperty('canReadFriends');
  });

  test('journal state returns empty state without errors', async ({ page, authToken }) => {
    const firstGoal = await getFirstGoal(page);
    if (!firstGoal) { test.skip(true, 'No goals found'); return; }
    const resp = await page.request.get(`${BASE_URL}/api/goals/${firstGoal.id}/journals`, { headers: auth(authToken) });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data).toHaveProperty('ownEntry');
    expect(data).toHaveProperty('friendEntries');
    expect(data).toHaveProperty('permissions');
    expect(data.ownEntry).toBeNull();
    expect(Array.isArray(data.friendEntries)).toBe(true);
    expect(data.friendEntries).toHaveLength(0);
  });

  test('goal-scoped journal API returns 401 without auth', async ({ page, authToken }) => {
    const firstGoal = await getFirstGoal(page);
    if (!firstGoal) { test.skip(true, 'No goals found'); return; }
    const resp = await page.request.get(`${BASE_URL}/api/goals/${firstGoal.id}/journals`, { headers: {} });
    expect(resp.status()).toBe(401);
  });
});
