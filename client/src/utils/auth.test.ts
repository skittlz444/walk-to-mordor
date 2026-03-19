import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAuthHeaders } from './auth';

describe('getAuthHeaders', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns Authorization and Content-Type when token exists', () => {
    store['sessionToken'] = 'my-token';

    const headers = getAuthHeaders();

    expect(headers).toEqual({
      Authorization: 'Bearer my-token',
      'Content-Type': 'application/json',
    });
  });

  it('returns only Content-Type when no token', () => {
    const headers = getAuthHeaders();

    expect(headers).toEqual({
      'Content-Type': 'application/json',
    });
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('reads token from localStorage each call (not cached)', () => {
    store['sessionToken'] = 'first-token';
    const headers1 = getAuthHeaders();
    expect(headers1.Authorization).toBe('Bearer first-token');

    store['sessionToken'] = 'second-token';
    const headers2 = getAuthHeaders();
    expect(headers2.Authorization).toBe('Bearer second-token');
  });

  it('uses Bearer scheme in Authorization header', () => {
    store['sessionToken'] = 'abc123';

    const headers = getAuthHeaders();

    expect(headers.Authorization).toMatch(/^Bearer /);
  });
});
