import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fetchWrappedStats } from './wrapped';

describe('fetchWrappedStats', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.setItem('sessionToken', 'test-token');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.removeItem('sessionToken');
  });

  it('throws when not authenticated', async () => {
    localStorage.removeItem('sessionToken');
    await expect(fetchWrappedStats()).rejects.toThrow('Not authenticated');
  });

  it('fetches wrapped stats with year param', async () => {
    const mockData = { year: 2025, total_distance_km: 100 };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockData),
    });

    const result = await fetchWrappedStats(2025);
    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/stats/wrapped?year=2025',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('fetches without year param when not provided', async () => {
    const mockData = { year: 2026 };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockData),
    });

    await fetchWrappedStats();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/stats/wrapped',
      expect.any(Object),
    );
  });

  it('throws on 403 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Admin access required' }),
    });

    await expect(fetchWrappedStats()).rejects.toThrow('Admin access required');
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal error' }),
    });

    await expect(fetchWrappedStats()).rejects.toThrow('HTTP 500');
  });
});
