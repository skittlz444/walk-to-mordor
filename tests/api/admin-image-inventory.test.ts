import { handleAdminImageInventory } from '../../src/admin-handlers';
import { DbClient } from '../../src/db';

// Mock auth-utils (needed by admin-handlers imports)
jest.mock('../../src/auth-utils', () => ({
  generateSalt: jest.fn(),
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateSessionId: jest.fn(),
  isValidEmail: jest.fn(),
  isValidPassword: jest.fn(),
  isValidUsername: jest.fn(),
  getSessionExpiry: jest.fn(),
  isSessionExpired: jest.fn(),
  generatePasswordResetToken: jest.fn(),
  getPasswordResetExpiry: jest.fn(),
  isPasswordResetTokenExpired: jest.fn(),
  generateEmailConfirmationToken: jest.fn(),
  getEmailConfirmationExpiry: jest.fn(),
  isEmailConfirmationTokenExpired: jest.fn()
}));

jest.mock('../../src/email-utils', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendConfirmationEmail: jest.fn()
}));

describe('handleAdminImageInventory', () => {
  let mockDB: { prepare: jest.Mock };
  let mockDb: DbClient;
  let mockAssets: { fetch: jest.Mock };
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    jest.clearAllMocks();
    originalConsoleError = console.error;
    console.error = jest.fn();

    mockDB = { prepare: jest.fn() };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };
    mockAssets = { fetch: jest.fn() };
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  function makeRequest(url = 'https://example.com/api/admin/images'): Request {
    return new Request(url, {
      headers: { Authorization: 'Bearer test-token' },
    });
  }

  function mockManifest(images: string[]) {
    const manifest = { generated: '2026-03-06T12:00:00Z', images, count: images.length };
    mockAssets.fetch.mockResolvedValue(
      new Response(JSON.stringify(manifest), { status: 200 })
    );
  }

  function mockGoalsQuery(rows: Array<{ id: number; title: string; image_id: string | null }>) {
    const mockAll = jest.fn().mockResolvedValue({ results: rows });
    mockDB.prepare.mockReturnValue({ all: mockAll });
  }

  it('should return correct inventory structure with matching images', async () => {
    mockManifest(['bag-end', 'rivendell', 'weathertop']);
    mockGoalsQuery([
      { id: 1, title: 'Bag End', image_id: 'bag-end' },
      { id: 2, title: 'Rivendell', image_id: 'rivendell' },
    ]);

    const res = await handleAdminImageInventory(makeRequest(), mockDb, mockAssets as unknown as Fetcher);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total).toBe(3);
    expect(data.images).toEqual([
      { image_id: 'bag-end', has_highres: true, has_thumb: true },
      { image_id: 'rivendell', has_highres: true, has_thumb: true },
    ]);
  });

  it('should detect orphaned images (in manifest but not assigned to any goal)', async () => {
    mockManifest(['bag-end', 'old-unused', 'rivendell']);
    mockGoalsQuery([
      { id: 1, title: 'Bag End', image_id: 'bag-end' },
    ]);

    const res = await handleAdminImageInventory(makeRequest(), mockDb, mockAssets as unknown as Fetcher);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.orphaned).toContain('old-unused');
    expect(data.orphaned).toContain('rivendell');
    expect(data.orphaned).not.toContain('bag-end');
  });

  it('should detect missing images (goal image_id not in manifest)', async () => {
    mockManifest(['bag-end']);
    mockGoalsQuery([
      { id: 1, title: 'Bag End', image_id: 'bag-end' },
      { id: 42, title: 'Some Goal', image_id: 'missing-slug' },
    ]);

    const res = await handleAdminImageInventory(makeRequest(), mockDb, mockAssets as unknown as Fetcher);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.missing).toEqual([
      { goal_id: 42, title: 'Some Goal', image_id: 'missing-slug' },
    ]);
  });

  it('should return 503 when manifest is not found (404)', async () => {
    mockAssets.fetch.mockResolvedValue(
      new Response('Not Found', { status: 404 })
    );
    mockGoalsQuery([]);

    const res = await handleAdminImageInventory(makeRequest(), mockDb, mockAssets as unknown as Fetcher);
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.error).toContain('manifest');
  });

  it('should return 503 when manifest fetch throws', async () => {
    mockAssets.fetch.mockRejectedValue(new Error('Network error'));
    mockGoalsQuery([]);

    const res = await handleAdminImageInventory(makeRequest(), mockDb, mockAssets as unknown as Fetcher);
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.error).toContain('manifest');
  });

  it('should return 503 when manifest JSON is malformed', async () => {
    mockAssets.fetch.mockResolvedValue(
      new Response('not-valid-json{{{', { status: 200 })
    );
    mockGoalsQuery([]);

    const res = await handleAdminImageInventory(makeRequest(), mockDb, mockAssets as unknown as Fetcher);
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.error).toContain('manifest');
    expect(data.error).toContain('malformed');
  });

  it('should handle empty manifest and empty goals', async () => {
    mockManifest([]);
    mockGoalsQuery([]);

    const res = await handleAdminImageInventory(makeRequest(), mockDb, mockAssets as unknown as Fetcher);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total).toBe(0);
    expect(data.images).toEqual([]);
    expect(data.orphaned).toEqual([]);
    expect(data.missing).toEqual([]);
  });

  it('should handle goals with no image_id (all filtered by query)', async () => {
    mockManifest(['bag-end', 'rivendell']);
    // Our SQL query filters out null/empty image_id, so results should be empty
    mockGoalsQuery([]);

    const res = await handleAdminImageInventory(makeRequest(), mockDb, mockAssets as unknown as Fetcher);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.images).toEqual([]);
    expect(data.orphaned).toEqual(['bag-end', 'rivendell']);
    expect(data.missing).toEqual([]);
  });

  it('should return 500 on database error', async () => {
    mockManifest(['bag-end']);
    mockDB.prepare.mockReturnValue({
      all: jest.fn().mockRejectedValue(new Error('DB error')),
    });

    const res = await handleAdminImageInventory(makeRequest(), mockDb, mockAssets as unknown as Fetcher);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain('Internal server error');
  });

  it('should sort images alphabetically by image_id', async () => {
    mockManifest(['weathertop', 'bag-end', 'rivendell']);
    mockGoalsQuery([
      { id: 3, title: 'Weathertop', image_id: 'weathertop' },
      { id: 1, title: 'Bag End', image_id: 'bag-end' },
      { id: 2, title: 'Rivendell', image_id: 'rivendell' },
    ]);

    const res = await handleAdminImageInventory(makeRequest(), mockDb, mockAssets as unknown as Fetcher);
    const data = await res.json();

    expect(data.images[0].image_id).toBe('bag-end');
    expect(data.images[1].image_id).toBe('rivendell');
    expect(data.images[2].image_id).toBe('weathertop');
  });

  it('should sort missing goals by goal_id', async () => {
    mockManifest([]);
    mockGoalsQuery([
      { id: 50, title: 'Goal B', image_id: 'slug-b' },
      { id: 10, title: 'Goal A', image_id: 'slug-a' },
    ]);

    const res = await handleAdminImageInventory(makeRequest(), mockDb, mockAssets as unknown as Fetcher);
    const data = await res.json();

    expect(data.missing[0].goal_id).toBe(10);
    expect(data.missing[1].goal_id).toBe(50);
  });
});
