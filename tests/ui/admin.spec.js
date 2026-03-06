// @ts-check
const { test: base, expect } = require('@playwright/test');
const { cleanupAllTestData } = require('./helpers/cleanup');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';

function uniqueId() {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Extend test with admin and non-admin auth fixtures.
 */
const test = base.extend({
  adminToken: async ({}, use) => {
    const token = `TEST_MOCK_TOKEN_AdminE2E_${uniqueId()}`;
    await use(token);
    await cleanupAllTestData(BASE_URL, token);
  },
  regularToken: async ({}, use) => {
    const token = `TEST_MOCK_TOKEN_RegularE2E_${uniqueId()}`;
    await use(token);
    await cleanupAllTestData(BASE_URL, token);
  },
});

/**
 * Ensure user exists via /api/session, then grant admin via test-only SQL endpoint.
 * Since there is no admin-grant API (by design), we use a direct DB approach:
 * first call /api/session to create the user, then use a special test endpoint
 * or accept that E2E admin tests require the user to already be admin.
 *
 * For this project, we use the test mock token pattern:
 * 1. Call /api/session with the token to ensure user exists
 * 2. Call a test-only admin-grant endpoint (if available), or
 * 3. Accept that admin E2E tests verify the 403/401 behavior for non-admin users
 *    and verify that the page renders correctly structurally
 */
async function ensureUserExists(request, token) {
  const response = await request.get(`${BASE_URL}/api/session`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), `Failed to create user: ${await response.text()}`).toBeTruthy();
  return response.json();
}

test.describe('Admin Routes - Access Control', () => {
  test('non-admin user gets 403 for /api/admin/* endpoints', async ({ request, regularToken }) => {
    // Ensure user exists
    await ensureUserExists(request, regularToken);

    const response = await request.get(`${BASE_URL}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${regularToken}` },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Admin access required');
  });

  test('unauthenticated user gets 401 for /api/admin/* endpoints', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/dashboard`);

    expect(response.status()).toBe(401);
  });

  test('admin page returns HTML shell for unauthenticated browser navigation', async ({ request }) => {
    // Browser navigation to /admin (no Authorization header) should return HTML shell
    // Auth is handled client-side by Preact islands which redirect to /login on 401
    const response = await request.get(`${BASE_URL}/admin`);

    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('text/html');
  });

  test('/api/session includes isAdmin field for non-admin user', async ({ request, regularToken }) => {
    const sessionData = await ensureUserExists(request, regularToken);

    expect(sessionData).toHaveProperty('isAdmin');
    expect(sessionData.isAdmin).toBe(false);
  });

  test('mock token users are non-admin by default (AC8)', async ({ request, adminToken }) => {
    // Verify that users created via TEST_MOCK_TOKEN are non-admin by default
    await ensureUserExists(request, adminToken);

    // Even with an "admin"-named token, the user has is_admin=0 by default
    // The API endpoint still enforces admin auth
    const response = await request.get(`${BASE_URL}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Confirms mock auth creates non-admin users and admin guard rejects them
    expect(response.status()).toBe(403);
  });

  test('403 response for /api/admin/* has JSON content-type', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);

    const response = await request.get(`${BASE_URL}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${regularToken}` },
    });

    expect(response.status()).toBe(403);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('application/json');
  });

  test('admin guard works for multiple /api/admin/* sub-paths', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);

    // Test several sub-paths under /api/admin/
    const paths = ['/api/admin/users', '/api/admin/goals', '/api/admin/audit-log'];
    for (const path of paths) {
      const response = await request.get(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${regularToken}` },
      });
      expect(response.status()).toBe(403);
    }
  });

  test('admin page HTML shell and API dashboard enforce auth separately', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);

    // /admin page with no auth - returns HTML shell (auth handled client-side)
    const r1 = await request.get(`${BASE_URL}/admin`);
    expect(r1.status()).toBe(200);
    const contentType = r1.headers()['content-type'] || '';
    expect(contentType).toContain('text/html');

    // /api/admin/dashboard with non-admin - should return 403
    const r2 = await request.get(`${BASE_URL}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${regularToken}` },
    });
    expect(r2.status()).toBe(403);
  });
});

test.describe('Admin Routes - No Admin Leaks in Non-Admin Pages', () => {
  test('login page does not contain admin-related content', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/login`);
    expect(response.ok()).toBeTruthy();

    const body = await response.text();
    // Should not reference admin dashboard or admin-only features
    expect(body).not.toContain('/admin');
    expect(body).not.toContain('Admin Dashboard');
    expect(body).not.toContain('admin-placeholder');
  });

  test('home page does not contain admin-related content', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);

    const response = await request.get(`${BASE_URL}/`, {
      headers: { Authorization: `Bearer ${regularToken}` },
    });

    const body = await response.text();
    expect(body).not.toContain('admin-placeholder');
    expect(body).not.toContain('Dashboard coming soon');
  });
});
