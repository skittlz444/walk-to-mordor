import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  isAuthenticated,
  userPreferences,
  getSessionToken,
  getAuthHeaders,
  clearSession,
  checkAuth,
  logout,
  loadPreferences,
  initializeApp,
} from './authStore';

const mockFetch = vi.fn() as Mock;

beforeEach(() => {
  // Reset signals
  isAuthenticated.value = false;
  userPreferences.value = {
    showFutureGoalsUnlocked: true,
    defaultViewMap: false,
  };

  // Reset mocks
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();

  // Reset localStorage
  localStorage.clear();

  // Reset body classes
  document.body.classList.remove('authenticated');

  // Reset location mock
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  });
});

describe('authStore', () => {
  describe('getSessionToken', () => {
    it('returns token from localStorage', () => {
      localStorage.setItem('sessionToken', 'abc123');
      expect(getSessionToken()).toBe('abc123');
    });

    it('returns null when no token', () => {
      expect(getSessionToken()).toBeNull();
    });
  });

  describe('getAuthHeaders', () => {
    it('returns auth header when token exists', () => {
      localStorage.setItem('sessionToken', 'test-token');
      expect(getAuthHeaders()).toEqual({
        Authorization: 'Bearer test-token',
      });
    });

    it('returns empty object when no token', () => {
      expect(getAuthHeaders()).toEqual({});
    });
  });

  describe('clearSession', () => {
    it('removes sessionToken from localStorage', () => {
      localStorage.setItem('sessionToken', 'test');
      clearSession();
      expect(localStorage.getItem('sessionToken')).toBeNull();
    });
  });

  describe('checkAuth', () => {
    it('redirects to /login when no token', async () => {
      const result = await checkAuth();
      expect(result).toBe(false);
      expect(window.location.href).toBe('/login');
    });

    it('returns true and sets isAuthenticated on valid session', async () => {
      localStorage.setItem('sessionToken', 'valid-token');
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await checkAuth();
      expect(result).toBe(true);
      expect(isAuthenticated.value).toBe(true);
    });

    it('clears session and redirects on invalid session', async () => {
      localStorage.setItem('sessionToken', 'invalid-token');
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await checkAuth();
      expect(result).toBe(false);
      expect(localStorage.getItem('sessionToken')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('redirects on fetch error', async () => {
      localStorage.setItem('sessionToken', 'token');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await checkAuth();
      expect(result).toBe(false);
      expect(window.location.href).toBe('/login');
      consoleSpy.mockRestore();
    });
  });

  describe('logout', () => {
    it('posts to /api/logout and clears session', async () => {
      localStorage.setItem('sessionToken', 'my-token');
      localStorage.setItem('defaultViewMap', 'true');
      mockFetch.mockResolvedValueOnce({});

      await logout();

      expect(mockFetch).toHaveBeenCalledWith('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'my-token' }),
      });
      expect(localStorage.getItem('sessionToken')).toBeNull();
      expect(localStorage.getItem('defaultViewMap')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('handles logout fetch error gracefully', async () => {
      localStorage.setItem('sessionToken', 'token');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await logout();

      expect(localStorage.getItem('sessionToken')).toBeNull();
      expect(window.location.href).toBe('/login');
      consoleSpy.mockRestore();
    });

    it('skips POST when no token', async () => {
      await logout();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(window.location.href).toBe('/login');
    });
  });

  describe('loadPreferences', () => {
    it('updates preferences from session response', async () => {
      localStorage.setItem('sessionToken', 'token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            showFutureGoalsUnlocked: false,
            defaultViewMap: true,
          }),
      });

      await loadPreferences();

      expect(userPreferences.value).toEqual({
        showFutureGoalsUnlocked: false,
        defaultViewMap: true,
      });
      expect(localStorage.getItem('defaultViewMap')).toBe('true');
    });

    it('keeps defaults when session returns no prefs', async () => {
      localStorage.setItem('sessionToken', 'token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await loadPreferences();

      expect(userPreferences.value).toEqual({
        showFutureGoalsUnlocked: true,
        defaultViewMap: false,
      });
    });

    it('handles fetch error gracefully', async () => {
      const consoleSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('Network'));

      await loadPreferences();

      expect(userPreferences.value).toEqual({
        showFutureGoalsUnlocked: true,
        defaultViewMap: false,
      });
      consoleSpy.mockRestore();
    });

    it('handles non-ok response', async () => {
      localStorage.setItem('sessionToken', 'token');
      mockFetch.mockResolvedValueOnce({ ok: false });

      await loadPreferences();

      expect(userPreferences.value).toEqual({
        showFutureGoalsUnlocked: true,
        defaultViewMap: false,
      });
    });
  });

  describe('initializeApp', () => {
    it('orchestrates auth check, prefs, and calendar init', async () => {
      localStorage.setItem('sessionToken', 'valid');
      const mockUpdateCalendar = vi.fn();
      vi.stubGlobal('updateCalendarAndTotal', mockUpdateCalendar);

      // checkAuth fetch
      mockFetch.mockResolvedValueOnce({ ok: true });
      // loadPreferences fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ showFutureGoalsUnlocked: false }),
      });

      await initializeApp();

      expect(isAuthenticated.value).toBe(true);
      expect(document.body.classList.contains('authenticated')).toBe(true);
      expect(mockUpdateCalendar).toHaveBeenCalled();
    });

    it('aborts when auth check fails', async () => {
      // No token — checkAuth will redirect
      await initializeApp();

      expect(document.body.classList.contains('authenticated')).toBe(false);
      expect(window.location.href).toBe('/login');
    });

    it('works without updateCalendarAndTotal', async () => {
      localStorage.setItem('sessionToken', 'valid');
      // Remove global if set
      // @ts-expect-error - clearing global for test
      delete window.updateCalendarAndTotal;

      mockFetch.mockResolvedValueOnce({ ok: true });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await initializeApp();

      expect(document.body.classList.contains('authenticated')).toBe(true);
    });
  });
});
