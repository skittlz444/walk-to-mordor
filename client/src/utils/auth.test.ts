import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAuthHeaders, getSessionToken } from './auth';

describe('auth utilities', () => {
  let mockStorage: Storage;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    const store: Record<string, string> = {};
    mockStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
      get length() { return Object.keys(store).length; },
      key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    };
    originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  });

  describe('getSessionToken', () => {
    it('returns null when no token', () => {
      expect(getSessionToken()).toBeNull();
    });

    it('returns the token when present', () => {
      mockStorage.setItem('sessionToken', 'jwt-abc');
      expect(getSessionToken()).toBe('jwt-abc');
    });
  });

  describe('getAuthHeaders', () => {
    it('returns only Content-Type when no token', () => {
      expect(getAuthHeaders()).toEqual({ 'Content-Type': 'application/json' });
    });

    it('returns Authorization + Content-Type when token is present', () => {
      mockStorage.setItem('sessionToken', 'jwt-xyz');
      expect(getAuthHeaders()).toEqual({
        Authorization: 'Bearer jwt-xyz',
        'Content-Type': 'application/json',
      });
    });
  });
});
