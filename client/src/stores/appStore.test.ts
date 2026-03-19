import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  userId,
  username,
  avatarId,
  isAdmin,
  showFutureGoalsUnlocked,
  defaultViewMap,
  totalDistance,
  storeInitialized,
  storeError,
  sessionToken,
  isAuthenticated,
  preferences,
  currentMilestone,
  initializeAppStore,
  resetAppStore,
  startPreferenceBridge,
  startPreferenceListener,
  stopPreferenceListener,
} from './appStore';

// Mock fetch globally
const mockFetch = vi.fn();

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('appStore', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    // Reset store before each test
    resetAppStore();

    // Setup mock localStorage
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
    });

    // Setup mock fetch
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();

    // Clean up window.userPreferences
    delete window.userPreferences;
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    resetAppStore();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('userId starts as null', () => {
      expect(userId.value).toBeNull();
    });

    it('username starts as empty string', () => {
      expect(username.value).toBe('');
    });

    it('avatarId starts as null', () => {
      expect(avatarId.value).toBeNull();
    });

    it('isAdmin starts as false', () => {
      expect(isAdmin.value).toBe(false);
    });

    it('showFutureGoalsUnlocked starts as true', () => {
      expect(showFutureGoalsUnlocked.value).toBe(true);
    });

    it('defaultViewMap starts as false', () => {
      expect(defaultViewMap.value).toBe(false);
    });

    it('totalDistance starts as null', () => {
      expect(totalDistance.value).toBeNull();
    });

    it('storeInitialized starts as false', () => {
      expect(storeInitialized.value).toBe(false);
    });

    it('storeError starts as null', () => {
      expect(storeError.value).toBeNull();
    });
  });

  describe('computed signals', () => {
    it('isAuthenticated returns false when no token', () => {
      expect(isAuthenticated.value).toBe(false);
    });

    it('isAuthenticated returns true when token exists', () => {
      sessionToken.value = 'test-token';
      expect(isAuthenticated.value).toBe(true);
    });

    it('preferences returns combined preference object', () => {
      showFutureGoalsUnlocked.value = false;
      defaultViewMap.value = true;
      expect(preferences.value).toEqual({
        showFutureGoalsUnlocked: false,
        defaultViewMap: true,
      });
    });

    it('currentMilestone returns null when no totalDistance', () => {
      totalDistance.value = null;
      expect(currentMilestone.value).toBeNull();
    });

    it('currentMilestone returns distance when set', () => {
      totalDistance.value = 150;
      expect(currentMilestone.value).toEqual({ totalDistance: 150 });
    });
  });

  describe('initializeAppStore', () => {
    it('marks store as initialized when no token', async () => {
      // No token in localStorage
      await initializeAppStore();
      await flushPromises();

      expect(storeInitialized.value).toBe(true);
      expect(userId.value).toBeNull();
      expect(storeError.value).toBeNull();
    });

    it('marks the store initialized before background distance hydration completes', async () => {
      store['sessionToken'] = 'test-token';

      let resolveDistance:
        | ((value: { ok: boolean; json: () => Promise<{ totalDistance: number }> }) => void)
        | null = null;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: 42,
          username: 'Frodo',
          avatarId: 'avatar-123',
          isAdmin: false,
          showFutureGoalsUnlocked: false,
          defaultViewMap: true,
        }),
      });
      mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
        resolveDistance = resolve;
      }));

      await initializeAppStore();

      expect(storeInitialized.value).toBe(true);
      expect(userId.value).toBe(42);
      expect(totalDistance.value).toBeNull();

      resolveDistance?.({
        ok: true,
        json: async () => ({ totalDistance: 125.5 }),
      });
      await flushPromises();

      expect(totalDistance.value).toBe(125.5);
    });

    it('does not call fetch when no token', async () => {
      await initializeAppStore();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches and hydrates session data', async () => {
      store['sessionToken'] = 'test-token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: 42,
          username: 'Frodo',
          avatarId: 'avatar-123',
          isAdmin: false,
          showFutureGoalsUnlocked: false,
          defaultViewMap: true,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalDistance: 125.5 }),
      });

      await initializeAppStore();
      await flushPromises();

      expect(userId.value).toBe(42);
      expect(username.value).toBe('Frodo');
      expect(avatarId.value).toBe('avatar-123');
      expect(isAdmin.value).toBe(false);
      expect(showFutureGoalsUnlocked.value).toBe(false);
      expect(defaultViewMap.value).toBe(true);
      expect(totalDistance.value).toBe(125.5);
      expect(storeInitialized.value).toBe(true);
      expect(storeError.value).toBeNull();
    });

    it('sends correct authorization header', async () => {
      store['sessionToken'] = 'my-secret-token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: 1,
          username: 'test',
          avatarId: null,
          isAdmin: false,
          showFutureGoalsUnlocked: true,
          defaultViewMap: false,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalDistance: 0 }),
      });

      await initializeAppStore();

      expect(mockFetch).toHaveBeenCalledWith('/api/session', {
        headers: { Authorization: 'Bearer my-secret-token' },
      });
      expect(mockFetch).toHaveBeenCalledWith('/api/total-distance', {
        headers: { Authorization: 'Bearer my-secret-token' },
      });
    });

    it('skips background distance hydration on the map route', async () => {
      store['sessionToken'] = 'map-token';
      window.history.pushState({}, '', '/map');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: 1,
          username: 'Sam',
          avatarId: null,
          isAdmin: false,
          showFutureGoalsUnlocked: true,
          defaultViewMap: false,
        }),
      });

      await initializeAppStore();
      await flushPromises();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/session', {
        headers: { Authorization: 'Bearer map-token' },
      });
      expect(totalDistance.value).toBeNull();
    });

    it('handles 401 response gracefully', async () => {
      store['sessionToken'] = 'expired-token';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await initializeAppStore();
      await flushPromises();

      expect(storeInitialized.value).toBe(true);
      expect(userId.value).toBeNull();
      expect(storeError.value).toBeNull();
      expect(sessionToken.value).toBeNull();
      expect(isAuthenticated.value).toBe(false);
    });

    it('handles non-401 error response', async () => {
      store['sessionToken'] = 'test-token';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await initializeAppStore();
      await flushPromises();

      expect(storeInitialized.value).toBe(true);
      expect(storeError.value).toBe('Session fetch failed: HTTP 500');
    });

    it('handles network errors', async () => {
      store['sessionToken'] = 'test-token';

      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await initializeAppStore();

      expect(storeInitialized.value).toBe(true);
      expect(storeError.value).toBe('Network failure');
    });

    it('defaults showFutureGoalsUnlocked to true when missing from response', async () => {
      store['sessionToken'] = 'test-token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: 1,
          username: 'test',
          avatarId: null,
          isAdmin: false,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalDistance: 0 }),
      });

      await initializeAppStore();

      expect(showFutureGoalsUnlocked.value).toBe(true);
    });

    it('defaults defaultViewMap to false when missing from response', async () => {
      store['sessionToken'] = 'test-token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: 1,
          username: 'test',
          avatarId: null,
          isAdmin: false,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalDistance: 0 }),
      });

      await initializeAppStore();

      expect(defaultViewMap.value).toBe(false);
    });

    it('handles null avatarId', async () => {
      store['sessionToken'] = 'test-token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: 1,
          username: 'Gandalf',
          avatarId: null,
          isAdmin: true,
          showFutureGoalsUnlocked: true,
          defaultViewMap: false,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalDistance: 0 }),
      });

      await initializeAppStore();

      expect(avatarId.value).toBeNull();
      expect(isAdmin.value).toBe(true);
    });

    it('leaves totalDistance null when distance fetch fails', async () => {
      store['sessionToken'] = 'test-token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: 1,
          username: 'test',
          avatarId: null,
          isAdmin: false,
          showFutureGoalsUnlocked: true,
          defaultViewMap: false,
        }),
      });
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await initializeAppStore();

      expect(totalDistance.value).toBeNull();
      expect(storeError.value).toBeNull();
      expect(storeInitialized.value).toBe(true);
    });

    it('leaves totalDistance null when distance endpoint returns non-ok', async () => {
      store['sessionToken'] = 'test-token';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: 1,
          username: 'test',
          avatarId: null,
          isAdmin: false,
          showFutureGoalsUnlocked: true,
          defaultViewMap: false,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await initializeAppStore();

      expect(totalDistance.value).toBeNull();
      expect(storeError.value).toBeNull();
    });
  });

  describe('bridge global sync', () => {
    it('writes window.userPreferences when bridge starts', async () => {
      await initializeAppStore();

      expect(window.userPreferences).toEqual({
        showFutureGoalsUnlocked: true,
        defaultViewMap: false,
      });
    });

    it('updates window.userPreferences when preferences change', async () => {
      await initializeAppStore();

      showFutureGoalsUnlocked.value = false;
      // effect() runs synchronously in Preact Signals
      expect(window.userPreferences?.showFutureGoalsUnlocked).toBe(false);
    });

    it('updates window.userPreferences when defaultViewMap changes', async () => {
      await initializeAppStore();

      defaultViewMap.value = true;
      expect(window.userPreferences?.defaultViewMap).toBe(true);
    });

    it('starts preference bridge even on unauthenticated init', async () => {
      // No token
      await initializeAppStore();

      expect(window.userPreferences).toEqual({
        showFutureGoalsUnlocked: true,
        defaultViewMap: false,
      });
    });

    it('starts preference bridge even on error', async () => {
      store['sessionToken'] = 'test-token';
      mockFetch.mockRejectedValueOnce(new Error('fail'));

      await initializeAppStore();

      expect(window.userPreferences).toBeDefined();
    });
  });

  describe('preferenceChanged event listener', () => {
    it('updates showFutureGoalsUnlocked from CustomEvent', async () => {
      await initializeAppStore();

      const event = new CustomEvent('preferenceChanged', {
        detail: { showFutureGoalsUnlocked: false },
      });
      window.dispatchEvent(event);

      expect(showFutureGoalsUnlocked.value).toBe(false);
    });

    it('updates defaultViewMap from CustomEvent', async () => {
      await initializeAppStore();

      const event = new CustomEvent('preferenceChanged', {
        detail: { defaultViewMap: true },
      });
      window.dispatchEvent(event);

      expect(defaultViewMap.value).toBe(true);
    });

    it('updates both preferences from CustomEvent', async () => {
      await initializeAppStore();

      const event = new CustomEvent('preferenceChanged', {
        detail: { showFutureGoalsUnlocked: false, defaultViewMap: true },
      });
      window.dispatchEvent(event);

      expect(showFutureGoalsUnlocked.value).toBe(false);
      expect(defaultViewMap.value).toBe(true);
    });

    it('ignores CustomEvent with no relevant fields', async () => {
      await initializeAppStore();

      const event = new CustomEvent('preferenceChanged', {
        detail: { unrelated: 'value' },
      });
      window.dispatchEvent(event);

      // Values remain at defaults
      expect(showFutureGoalsUnlocked.value).toBe(true);
      expect(defaultViewMap.value).toBe(false);
    });

    it('stopPreferenceListener removes the listener', async () => {
      await initializeAppStore();

      stopPreferenceListener();

      const event = new CustomEvent('preferenceChanged', {
        detail: { showFutureGoalsUnlocked: false },
      });
      window.dispatchEvent(event);

      // Should not have changed since listener was removed
      expect(showFutureGoalsUnlocked.value).toBe(true);
    });
  });

  describe('resetAppStore', () => {
    it('resets all signals to defaults', async () => {
      store['sessionToken'] = 'test-token';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          userId: 42,
          username: 'Frodo',
          avatarId: 'avatar-123',
          isAdmin: true,
          showFutureGoalsUnlocked: false,
          defaultViewMap: true,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalDistance: 99.9 }),
      });

      await initializeAppStore();

      // Verify hydrated state
      expect(userId.value).toBe(42);
      expect(storeInitialized.value).toBe(true);

      resetAppStore();

      expect(userId.value).toBeNull();
      expect(username.value).toBe('');
      expect(avatarId.value).toBeNull();
      expect(isAdmin.value).toBe(false);
      expect(showFutureGoalsUnlocked.value).toBe(true);
      expect(defaultViewMap.value).toBe(false);
      expect(totalDistance.value).toBeNull();
      expect(storeInitialized.value).toBe(false);
      expect(storeError.value).toBeNull();
    });

    it('stops preference listener on reset', async () => {
      await initializeAppStore();
      resetAppStore();

      const event = new CustomEvent('preferenceChanged', {
        detail: { showFutureGoalsUnlocked: false },
      });
      window.dispatchEvent(event);

      // Listener was stopped, so value should remain at default
      expect(showFutureGoalsUnlocked.value).toBe(true);
    });
  });

  describe('startPreferenceBridge', () => {
    it('can be called multiple times without duplicating effects', () => {
      startPreferenceBridge();
      startPreferenceBridge();

      showFutureGoalsUnlocked.value = false;

      expect(window.userPreferences?.showFutureGoalsUnlocked).toBe(false);
    });
  });

  describe('startPreferenceListener', () => {
    it('can be called multiple times without duplicating listeners', async () => {
      startPreferenceListener();
      startPreferenceListener();

      showFutureGoalsUnlocked.value = true;

      const event = new CustomEvent('preferenceChanged', {
        detail: { showFutureGoalsUnlocked: false },
      });
      window.dispatchEvent(event);

      // Should only fire once
      expect(showFutureGoalsUnlocked.value).toBe(false);
    });
  });

  describe('signal reactivity', () => {
    it('preferences computed updates when showFutureGoalsUnlocked changes', () => {
      expect(preferences.value.showFutureGoalsUnlocked).toBe(true);

      showFutureGoalsUnlocked.value = false;

      expect(preferences.value.showFutureGoalsUnlocked).toBe(false);
    });

    it('preferences computed updates when defaultViewMap changes', () => {
      expect(preferences.value.defaultViewMap).toBe(false);

      defaultViewMap.value = true;

      expect(preferences.value.defaultViewMap).toBe(true);
    });

    it('currentMilestone reacts to totalDistance changes', () => {
      expect(currentMilestone.value).toBeNull();

      totalDistance.value = 250;
      expect(currentMilestone.value).toEqual({ totalDistance: 250 });

      totalDistance.value = 500;
      expect(currentMilestone.value).toEqual({ totalDistance: 500 });
    });
  });
});
