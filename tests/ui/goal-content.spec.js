// @ts-check
const { test: base, expect } = require('@playwright/test');
const { cleanupAllTestData } = require('./helpers/cleanup');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

function uniqueId() {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Auth fixtures. Mock-token users are non-admin by default and there is no
 * admin-grant API, so admin authoring flows are exercised through their
 * access-control contract (401/403) while user-facing unlock semantics are
 * exercised end-to-end via the public goal-content API.
 */
const test = base.extend({
  adminToken: async ({}, use) => {
    const token = `TEST_MOCK_TOKEN_ContentAdminE2E_${uniqueId()}`;
    await use(token);
    await cleanupAllTestData(BASE_URL, token);
  },
  regularToken: async ({}, use) => {
    const token = `TEST_MOCK_TOKEN_ContentRegularE2E_${uniqueId()}`;
    await use(token);
    await cleanupAllTestData(BASE_URL, token);
  },
});

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function ensureUserExists(request, token) {
  const response = await request.get(`${BASE_URL}/api/session`, {
    headers: auth(token),
  });
  expect(response.ok(), `Failed to create user: ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function getGoals(request, token) {
  const response = await request.get(`${BASE_URL}/api/goals`, { headers: auth(token) });
  expect(response.ok(), `Failed to load goals: ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function logDistance(request, token, distance) {
  const today = new Date().toISOString().split('T')[0];
  return request.post(`${BASE_URL}/api/calendar-progress`, {
    data: { start: today, title: String(distance) },
    headers: auth(token),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Admin goal-content authoring — access control contract
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Goal Content - Admin Access Control', () => {
  test('unauthenticated user gets 401 for admin goal-content endpoints', async ({ request }) => {
    const list = await request.get(`${BASE_URL}/api/admin/goals/1/content`);
    expect(list.status()).toBe(401);

    const create = await request.post(`${BASE_URL}/api/admin/goals/1/content`, {
      data: { type: 'story', title: 'X', body: 'Y', sort_order: 0 },
    });
    expect(create.status()).toBe(401);
  });

  test('non-admin user gets 403 for admin goal-content endpoints', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);

    const list = await request.get(`${BASE_URL}/api/admin/goals/1/content`, {
      headers: auth(regularToken),
    });
    expect(list.status()).toBe(403);

    const create = await request.post(`${BASE_URL}/api/admin/goals/1/content`, {
      headers: auth(regularToken),
      data: { type: 'story', title: 'X', body: 'Y', sort_order: 0 },
    });
    expect(create.status()).toBe(403);

    const update = await request.put(`${BASE_URL}/api/admin/goals/1/content/1`, {
      headers: auth(regularToken),
      data: { type: 'story', title: 'X', body: 'Y', sort_order: 0 },
    });
    expect(update.status()).toBe(403);

    const del = await request.delete(`${BASE_URL}/api/admin/goals/1/content/1`, {
      headers: auth(regularToken),
    });
    expect(del.status()).toBe(403);
  });

  test('admin goal edit page returns an HTML shell for browser navigation', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/admin/goals/1`);
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('text/html');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Public goal-content — content-presence and locked/unlocked flows
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Goal Content - Public Read Flows', () => {
  test('GET /api/goals includes has_content boolean on every goal', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);
    const goals = await getGoals(request, regularToken);

    expect(Array.isArray(goals)).toBeTruthy();
    expect(goals.length).toBeGreaterThan(0);
    for (const goal of goals) {
      expect(goal).toHaveProperty('has_content');
      expect(typeof goal.has_content).toBe('boolean');
    }
  });

  test('locked goal content returns 403 for a fresh user', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);
    const goals = await getGoals(request, regularToken);

    // Fresh user has zero distance; the furthest goal is guaranteed locked.
    const furthest = goals.reduce((max, g) => (g.distance > max.distance ? g : max), goals[0]);

    const response = await request.get(`${BASE_URL}/api/goals/${furthest.id}/content`, {
      headers: auth(regularToken),
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('unlocked goal content returns 200 with an entries array', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);
    const goals = await getGoals(request, regularToken);

    // Unlock the nearest goal by logging enough distance to pass it.
    const nearest = goals.reduce((min, g) => (g.distance < min.distance ? g : min), goals[0]);
    const logResp = await logDistance(request, regularToken, Math.ceil(nearest.distance) + 5);
    expect(logResp.ok(), `Failed to log distance: ${await logResp.text()}`).toBeTruthy();

    const response = await request.get(`${BASE_URL}/api/goals/${nearest.id}/content`, {
      headers: auth(regularToken),
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('entries');
    expect(Array.isArray(body.entries)).toBeTruthy();
  });

  test('invalid goalId returns 400', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);
    const response = await request.get(`${BASE_URL}/api/goals/abc/content`, {
      headers: auth(regularToken),
    });
    expect(response.status()).toBe(400);
  });

  test('goal content read requires authentication', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/goals/1/content`);
    expect(response.status()).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Discovery analytics — best-effort event recording
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Goal Content - Discovery Analytics', () => {
  test('valid discovery event is accepted (202)', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);
    const response = await request.post(`${BASE_URL}/api/goals/1/content/events`, {
      headers: auth(regularToken),
      data: { event_type: 'teaser_impression', context_type: 'personal' },
    });
    expect(response.status()).toBe(202);
  });

  test('invalid event_type is rejected (400)', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);
    const response = await request.post(`${BASE_URL}/api/goals/1/content/events`, {
      headers: auth(regularToken),
      data: { event_type: 'nope', context_type: 'personal' },
    });
    expect(response.status()).toBe(400);
  });

  test('discovery event requires authentication (401)', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/goals/1/content/events`, {
      data: { event_type: 'content_open', context_type: 'personal' },
    });
    expect(response.status()).toBe(401);
  });
});
