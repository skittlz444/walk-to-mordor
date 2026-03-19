import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  userId,
  username,
  avatarId,
  isAdmin,
  preferences,
  sessionToken,
  initialized,
  initError,
  isAuthenticated,
  sessionState,
  initializeAppStore,
  updatePreference,
  refreshToken,
} from './appStore';

// Mock fetch globally
const mockFetch = vi.fn();

/**
 * Mock localStorage for testing.
 */
function createMockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
}

describe('appStore', () => {
  let mockStorage: Storage;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);

    // Reset all signals to initial state
    userId.value = null;
    username.value = null;
    avatarId.value = null;
    isAdmin.value = false;
    preferences.value = { showFutureGoalsUnlocked: true, defaultViewMap: false };
    sessionToken.value = null;
    initialized.value = false;
    initError.value = null;

    // Setup mock localStorage
    mockStorage = createMockStorage();
    originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
    });

    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Initial State
  // ==========================================================================

  describe('initial state', () => {
    it('userId starts as null', () => {
      expect(userId.value).toBeNull();
    });

    it('username starts as null', () => {
      expect(username.value).toBeNull();
    });

    it('avatarId starts as null', () => {
      expect(avatarId.value).toBeNull();
    });

    it('isAdmin starts as false', () => {
      expect(isAdmin.value).toBe(false);
    });

    it('preferences start with defaults', () => {
      expect(preferences.value).toEqual({
        showFutureGoalsUnlocked: true,
        defaultViewMap: false,
      });
    });

    it('initialized starts as false', () => {
      expect(initialized.value).toBe(false);
    });

    it('initError starts as null', () => {
      expect(initError.value).toBeNull();
    });
  });

  // ==========================================================================
  // Computed Signals
  // ==========================================================================

  describe('isAuthenticated', () => {
    it('returns false when no token', () => {
      sessionToken.value = null;
      expect(isAuthenticated.value).toBe(false);
    });

    it('returns true when token is present', () => {
      sessionToken.value = 'some-token';
      expect(isAuthenticated.value).toBe(true);
    });

    it('reacts to token changes', () => {
      expect(isAuthenticated.value).toBe(false);
      sessionToken.value = 'new-token';
      expect(isAuthenticated.value).toBe(true);
      sessionToken.value = null;
      expect(isAuthenticated.value).toBe(false);
    });
  });

  describe('sessionState', () => {
    it('aggregates all session signals', () => {
      userId.value = 42;
      username.value = 'frodo';
      avatarId.value = 'avatar-123';
      isAdmin.value = true;
      preferences.value = {
        showFutureGoalsUnlocked: false,
        defaultViewMap: true,
      };

      expect(sessionState.value).toEqual({
        userId: 42,
        username: 'frodo',
        avatarId: 'avatar-123',
        isAdmin: true,
        preferences: {
          showFutureGoalsUnlocked: false,
          defaultViewMap: true,
        },
      });
    });

    it('updates when individual signals change', () => {
      expect(sessionState.value.userId).toBeNull();
      userId.value = 7;
      expect(sessionState.value.userId).toBe(7);
    });
  });

  // ==========================================================================
  // Initialization
  // ==========================================================================

  describe('initializeAppStore', () => {
    it('marks initialized when no token is present', async () => {
      // No token in localStorage
      await initializeAppStore();

      expect(initialized.value).toBe(true);
      expect(userId.value).toBeNull();
      expect(initError.value).toBeNull();
    });

    it('hydrates all signals from session response', async () => {
      mockStorage.setItem('sessionToken', 'test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: 42,
          username: 'samwise',
          avatarId: 'sam-avatar',
          isAdmin: false,
          showFutureGoalsUnlocked: false,
          defaultViewMap: true,
        }),
      });

      await initializeAppStore();

      expect(initialized.value).toBe(true);
      expect(userId.value).toBe(42);
      expect(username.value).toBe('samwise');
      expect(avatarId.value).toBe('sam-avatar');
      expect(isAdmin.value).toBe(false);
      expect(preferences.value.showFutureGoalsUnlocked).toBe(false);
      expect(preferences.value.defaultViewMap).toBe(true);
      expect(sessionToken.value).toBe('test-token');
    });

    it('sends Authorization header with token', async () => {
      mockStorage.setItem('sessionToken', 'my-jwt');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: 1,
          username: 'user',
          avatarId: null,
          isAdmin: false,
          showFutureGoalsUnlocked: true,
          defaultViewMap: false,
        }),
      });

      await initializeAppStore();

      expect(mockFetch).toHaveBeenCalledWith('/api/session', {
        headers: { Authorization: 'Bearer my-jwt' },
      });
    });

    it('handles 401 gracefully (stale token)', async () => {
      mockStorage.setItem('sessionToken', 'expired-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await initializeAppStore();

      expect(initialized.value).toBe(true);
      expect(userId.value).toBeNull();
      expect(initError.value).toBeNull();
    });

    it('handles 403 gracefully', async () => {
      mockStorage.setItem('sessionToken', 'forbidden-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await initializeAppStore();

      expect(initialized.value).toBe(true);
      expect(userId.value).toBeNull();
      expect(initError.value).toBeNull();
    });

    it('sets initError on server error', async () => {
      mockStorage.setItem('sessionToken', 'test-token');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await initializeAppStore();

      expect(initialized.value).toBe(true);
      expect(initError.value).toBe('Session fetch failed: HTTP 500');
    });

    it('sets initError on network failure', async () => {
      mockStorage.setItem('sessionToken', 'test-token');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await initializeAppStore();

      expect(initialized.value).toBe(true);
      expect(initError.value).toBe('Network error');
    });

    it('defaults showFutureGoalsUnlocked to true when response omits it', async () => {
      mockStorage.setItem('sessionToken', 'test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: 1,
          username: 'user',
          avatarId: null,
          isAdmin: false,
        }),
      });

      await initializeAppStore();

      expect(preferences.value.showFutureGoalsUnlocked).toBe(true);
    });

    it('defaults defaultViewMap to false when response omits it', async () => {
      mockStorage.setItem('sessionToken', 'test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: 1,
          username: 'user',
          avatarId: null,
          isAdmin: false,
        }),
      });

      await initializeAppStore();

      expect(preferences.value.defaultViewMap).toBe(false);
    });

    it('handles null avatarId', async () => {
      mockStorage.setItem('sessionToken', 'test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: 1,
          username: 'user',
          avatarId: null,
          isAdmin: false,
          showFutureGoalsUnlocked: true,
          defaultViewMap: false,
        }),
      });

      await initializeAppStore();

      expect(avatarId.value).toBeNull();
    });

    it('can be called multiple times (re-fetch)', async () => {
      mockStorage.setItem('sessionToken', 'test-token');

      // First call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: 1,
          username: 'user1',
          avatarId: null,
          isAdmin: false,
          showFutureGoalsUnlocked: true,
          defaultViewMap: false,
        }),
      });
      await initializeAppStore();
      expect(username.value).toBe('user1');

      // Second call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: 1,
          username: 'user1-updated',
          avatarId: 'new-avatar',
          isAdmin: true,
          showFutureGoalsUnlocked: false,
          defaultViewMap: true,
        }),
      });
      await initializeAppStore();
      expect(username.value).toBe('user1-updated');
      expect(avatarId.value).toBe('new-avatar');
      expect(isAdmin.value).toBe(true);
    });
  });

  // ==========================================================================
  // Bridge Global Sync
  // ==========================================================================

  describe('bridge global sync', () => {
    it('updates window.userPreferences when preferences change', () => {
      preferences.value = {
        showFutureGoalsUnlocked: false,
        defaultViewMap: true,
      };

      expect(window.userPreferences).toEqual({
        showFutureGoalsUnlocked: false,
        defaultViewMap: true,
      });
    });

    it('keeps window.userPreferences in sync across multiple changes', () => {
      preferences.value = { showFutureGoalsUnlocked: true, defaultViewMap: false };
      expect(window.userPreferences?.showFutureGoalsUnlocked).toBe(true);

      preferences.value = { showFutureGoalsUnlocked: false, defaultViewMap: false };
      expect(window.userPreferences?.showFutureGoalsUnlocked).toBe(false);
    });

    it('window.userPreferences is set after initialization', async () => {
      mockStorage.setItem('sessionToken', 'test-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          userId: 1,
          username: 'user',
          avatarId: null,
          isAdmin: false,
          showFutureGoalsUnlocked: false,
          defaultViewMap: true,
        }),
      });

      await initializeAppStore();

      expect(window.userPreferences).toEqual({
        showFutureGoalsUnlocked: false,
        defaultViewMap: true,
      });
    });
  });

  // ==========================================================================
  // preferenceChanged CustomEvent integration
  // ==========================================================================

  describe('preferenceChanged event', () => {
    it('listens for preferenceChanged and updates signals', () => {
      preferences.value = { showFutureGoalsUnlocked: true, defaultViewMap: false };

      window.dispatchEvent(
        new CustomEvent('preferenceChanged', {
          detail: { showFutureGoalsUnlocked: false },
        }),
      );

      expect(preferences.value.showFutureGoalsUnlocked).toBe(false);
    });

    it('ignores events without showFutureGoalsUnlocked', () => {
      preferences.value = { showFutureGoalsUnlocked: true, defaultViewMap: false };

      window.dispatchEvent(
        new CustomEvent('preferenceChanged', {
          detail: { someOtherPref: 123 },
        }),
      );

      expect(preferences.value.showFutureGoalsUnlocked).toBe(true);
    });
  });

  // ==========================================================================
  // Actions
  // ==========================================================================

  describe('updatePreference', () => {
    it('updates a preference key', () => {
      updatePreference('showFutureGoalsUnlocked', false);
      expect(preferences.value.showFutureGoalsUnlocked).toBe(false);
    });

    it('dispatches preferenceChanged CustomEvent', () => {
      const handler = vi.fn();
      window.addEventListener('preferenceChanged', handler);

      updatePreference('defaultViewMap', true);

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.defaultViewMap).toBe(true);

      window.removeEventListener('preferenceChanged', handler);
    });

    it('updates window.userPreferences via bridge sync', () => {
      updatePreference('showFutureGoalsUnlocked', false);
      expect(window.userPreferences?.showFutureGoalsUnlocked).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('reads token from localStorage', () => {
      mockStorage.setItem('sessionToken', 'fresh-token');
      refreshToken();
      expect(sessionToken.value).toBe('fresh-token');
    });

    it('sets null when no token in localStorage', () => {
      sessionToken.value = 'old';
      refreshToken();
      expect(sessionToken.value).toBeNull();
    });

    it('updates isAuthenticated computed', () => {
      expect(isAuthenticated.value).toBe(false);
      mockStorage.setItem('sessionToken', 'some-token');
      refreshToken();
      expect(isAuthenticated.value).toBe(true);
    });
  });
});
