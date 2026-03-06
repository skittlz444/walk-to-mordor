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
  test('non-admin user gets 403 when accessing /admin page', async ({ page, request, regularToken }) => {
    // Ensure user exists (non-admin by default)
    await ensureUserExists(request, regularToken);

    // Set auth token
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate((t) => localStorage.setItem('sessionToken', t), regularToken);

    // Try to access admin page
    const response = await request.get(`${BASE_URL}/admin`, {
      headers: { Authorization: `Bearer ${regularToken}` },
    });

    expect(response.status()).toBe(403);
  });

  test('unauthenticated user gets 401 when accessing /admin page', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/admin`);

    expect(response.status()).toBe(401);
  });

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

  test('/api/session includes isAdmin field for non-admin user', async ({ request, regularToken }) => {
    const sessionData = await ensureUserExists(request, regularToken);

    expect(sessionData).toHaveProperty('isAdmin');
    expect(sessionData.isAdmin).toBe(false);
  });

  test('mock token users are non-admin by default (AC8)', async ({ request, adminToken }) => {
    // Verify that users created via TEST_MOCK_TOKEN are non-admin by default
    await ensureUserExists(request, adminToken);

    // Even with an "admin"-named token, the user has is_admin=0 by default
    const response = await request.get(`${BASE_URL}/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Confirms mock auth creates non-admin users and admin guard rejects them
    expect(response.status()).toBe(403);
  });

  test('no admin content leaked in 403 response for /admin page', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);

    const response = await request.get(`${BASE_URL}/admin`, {
      headers: { Authorization: `Bearer ${regularToken}` },
    });

    expect(response.status()).toBe(403);
    const body = await response.text();
    // Ensure no admin-specific HTML/content is leaked
    expect(body).not.toContain('Admin Dashboard');
    expect(body).not.toContain('Dashboard coming soon');
  });

  test('no admin content leaked in 401 response for /admin page', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/admin`);

    expect(response.status()).toBe(401);
    const body = await response.text();
    expect(body).not.toContain('Admin Dashboard');
    expect(body).not.toContain('Dashboard coming soon');
  });

  test('401 response for /admin page has JSON content-type', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/admin`);

    expect(response.status()).toBe(401);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('application/json');
  });

  test('403 response for /admin page has JSON content-type', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);

    const response = await request.get(`${BASE_URL}/admin`, {
      headers: { Authorization: `Bearer ${regularToken}` },
    });

    expect(response.status()).toBe(403);
    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toContain('application/json');
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

  test('admin page returns 401 without auth and dashboard returns 403 for non-admin', async ({ request, regularToken }) => {
    await ensureUserExists(request, regularToken);

    // /admin page with no auth - should return 401
    const r1 = await request.get(`${BASE_URL}/admin`);
    expect(r1.status()).toBe(401);

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
