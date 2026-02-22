import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  userProgress,
  milestones,
  mapViewState,
  loadingState,
  error,
  isLoading,
  hasError,
  unlockedMilestones,
  nextMilestone,
  currentPosition,
  viewportSize,
  visibleMilestones,
  showFutureGoalsUnlocked,
  fetchUserProgress,
  initializeMap,
  retryLoad,
  updateMapView,
  refreshUserProgress,
  centerOnCurrentPosition,
  setViewportSize,
  setShowFutureGoalsUnlocked,
} from './mapStore';

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

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('mapStore', () => {
  let mockStorage: Storage;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    // Reset signals to initial state
    userProgress.value = null;
    milestones.value = [];
    mapViewState.value = { x: 0, y: 0, scale: 1.0 };
    loadingState.value = 'idle';
    error.value = null;
    viewportSize.value = { width: 0, height: 0 };
    showFutureGoalsUnlocked.value = true;

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
    vi.clearAllTimers();
  });

  describe('initial state', () => {
    it('userProgress starts as null', () => {
      expect(userProgress.value).toBeNull();
    });

    it('milestones starts as empty array', () => {
      expect(milestones.value).toEqual([]);
    });

    it('mapViewState starts with default values', () => {
      expect(mapViewState.value).toEqual({ x: 0, y: 0, scale: 1.0 });
    });

    it('loadingState starts as idle', () => {
      expect(loadingState.value).toBe('idle');
    });

    it('error starts as null', () => {
      expect(error.value).toBeNull();
    });
  });

  describe('computed signals', () => {
    it('isLoading returns true when loading', () => {
      loadingState.value = 'loading';
      expect(isLoading.value).toBe(true);
    });

    it('isLoading returns false when not loading', () => {
      loadingState.value = 'success';
      expect(isLoading.value).toBe(false);
    });

    it('hasError returns true when error exists', () => {
      error.value = new Error('Test error');
      expect(hasError.value).toBe(true);
    });

    it('hasError returns false when no error', () => {
      error.value = null;
      expect(hasError.value).toBe(false);
    });

    it('unlockedMilestones filters correctly', () => {
      userProgress.value = { totalDistance: 150, lastUpdated: new Date() };
      milestones.value = [
        { id: 1, distance: 100, title: 'Goal 1', x: 0, y: 0 },
        { id: 2, distance: 200, title: 'Goal 2', x: 10, y: 10 },
        { id: 3, distance: 300, title: 'Goal 3', x: 20, y: 20 },
      ];

      expect(unlockedMilestones.value).toEqual([
        { id: 1, distance: 100, title: 'Goal 1', x: 0, y: 0 },
      ]);
    });

    it('unlockedMilestones returns empty when no progress', () => {
      userProgress.value = null;
      milestones.value = [
        { id: 1, distance: 100, title: 'Goal 1', x: 0, y: 0 },
      ];

      expect(unlockedMilestones.value).toEqual([]);
    });

    it('nextMilestone returns first locked milestone', () => {
      userProgress.value = { totalDistance: 150, lastUpdated: new Date() };
      milestones.value = [
        { id: 1, distance: 100, title: 'Goal 1', x: 0, y: 0 },
        { id: 2, distance: 200, title: 'Goal 2', x: 10, y: 10 },
        { id: 3, distance: 300, title: 'Goal 3', x: 20, y: 20 },
      ];

      expect(nextMilestone.value).toEqual({
        id: 2,
        distance: 200,
        title: 'Goal 2',
        x: 10,
        y: 10,
      });
    });

    it('nextMilestone returns undefined when no progress', () => {
      userProgress.value = null;
      milestones.value = [
        { id: 1, distance: 100, title: 'Goal 1', x: 0, y: 0 },
      ];

      expect(nextMilestone.value).toBeUndefined();
    });

    it('currentPosition returns origin when no progress', () => {
      userProgress.value = null;
      expect(currentPosition.value).toEqual({ x: 0, y: 0 });
    });

    it('currentPosition calculates position from progress', () => {
      // Set a known distance - at 0km should be at Bag End position
      userProgress.value = { totalDistance: 0, lastUpdated: new Date() };
      const pos = currentPosition.value;
      // Bag End is at (3165, 1529) in fellowship-path.ts
      expect(pos.x).toBe(3165);
      expect(pos.y).toBe(1529);
    });

    it('visibleMilestones returns all milestones when viewport not initialized', () => {
      viewportSize.value = { width: 0, height: 0 };
      milestones.value = [
        { id: 1, distance: 100, title: 'Goal 1', x: 100, y: 100 },
        { id: 2, distance: 200, title: 'Goal 2', x: 500, y: 500 },
      ];

      expect(visibleMilestones.value).toEqual(milestones.value);
    });

    it('visibleMilestones filters milestones within viewport bounds', () => {
      // Set viewport at origin with 200x200 size, scale 1
      viewportSize.value = { width: 200, height: 200 };
      mapViewState.value = { x: 0, y: 0, scale: 1.0 };
      milestones.value = [
        { id: 1, distance: 100, title: 'Inside', x: 100, y: 100 },
        { id: 2, distance: 200, title: 'Outside', x: 1000, y: 1000 },
      ];

      const visible = visibleMilestones.value;
      expect(visible).toHaveLength(1);
      expect(visible[0].title).toBe('Inside');
    });

    it('visibleMilestones includes milestones within padding area', () => {
      // Set viewport with padding (20%), milestone just outside but within padding
      viewportSize.value = { width: 100, height: 100 };
      mapViewState.value = { x: 0, y: 0, scale: 1.0 };
      // With 20% padding, visible range extends to -20 to 120 on each axis
      milestones.value = [
        { id: 1, distance: 100, title: 'In Padding', x: 110, y: 50 },
        { id: 2, distance: 200, title: 'Too Far', x: 200, y: 200 },
      ];

      const visible = visibleMilestones.value;
      expect(visible).toHaveLength(1);
      expect(visible[0].title).toBe('In Padding');
    });

    it('visibleMilestones adjusts for pan position', () => {
      viewportSize.value = { width: 100, height: 100 };
      // Pan to show area around (500, 500) - stage position is negative of map position
      mapViewState.value = { x: -500, y: -500, scale: 1.0 };
      milestones.value = [
        { id: 1, distance: 100, title: 'At Origin', x: 0, y: 0 },
        { id: 2, distance: 200, title: 'In View', x: 550, y: 550 },
      ];

      const visible = visibleMilestones.value;
      expect(visible).toHaveLength(1);
      expect(visible[0].title).toBe('In View');
    });

    it('visibleMilestones adjusts for zoom level', () => {
      viewportSize.value = { width: 100, height: 100 };
      mapViewState.value = { x: 0, y: 0, scale: 0.5 }; // Zoomed out = more visible
      // At scale 0.5, visible area is doubled: 0-200 instead of 0-100
      milestones.value = [
        { id: 1, distance: 100, title: 'In Zoomed View', x: 150, y: 150 },
        { id: 2, distance: 200, title: 'Too Far', x: 500, y: 500 },
      ];

      const visible = visibleMilestones.value;
      expect(visible).toHaveLength(1);
      expect(visible[0].title).toBe('In Zoomed View');
    });
  });

  describe('setViewportSize', () => {
    it('updates viewportSize signal', () => {
      setViewportSize({ width: 800, height: 600 });
      expect(viewportSize.value).toEqual({ width: 800, height: 600 });
    });
  });

  describe('fetchUserProgress', () => {
    it('fetches and returns user progress', async () => {
      mockStorage.setItem('sessionToken', 'test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalDistance: 500 }),
      });

      const progress = await fetchUserProgress();

      expect(progress.totalDistance).toBe(500);
      expect(progress.lastUpdated).toBeInstanceOf(Date);
      expect(mockFetch).toHaveBeenCalledWith('/api/total-distance', {
        headers: { Authorization: 'Bearer test-token' },
      });
    });

    it('throws when not authenticated', async () => {
      // No session token
      await expect(fetchUserProgress()).rejects.toThrow('Not authenticated');
    });

    it('throws on HTTP error', async () => {
      mockStorage.setItem('sessionToken', 'test-token');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchUserProgress()).rejects.toThrow('Failed to fetch progress: HTTP 500');
    });
  });

  describe('updateMapView', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('updates mapViewState signal', () => {
      updateMapView({ x: 100, y: 200 });
      expect(mapViewState.value.x).toBe(100);
      expect(mapViewState.value.y).toBe(200);
      expect(mapViewState.value.scale).toBe(1.0); // unchanged
    });

    it('merges partial updates', () => {
      mapViewState.value = { x: 50, y: 50, scale: 2.0 };
      updateMapView({ scale: 1.5 });
      expect(mapViewState.value).toEqual({ x: 50, y: 50, scale: 1.5 });
    });

    it('debounces localStorage persistence', () => {
      updateMapView({ x: 100 });
      updateMapView({ x: 200 });
      updateMapView({ x: 300 });

      // Before debounce completes
      expect(mockStorage.setItem).not.toHaveBeenCalled();

      // After debounce (500ms)
      vi.advanceTimersByTime(500);

      expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
      const savedState = JSON.parse(
        (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0][1],
      );
      expect(savedState.x).toBe(300);
    });
  });

  describe('centerOnCurrentPosition', () => {
    it('returns MapViewState centered on user position', () => {
      userProgress.value = { totalDistance: 0, lastUpdated: new Date() };
      const state = centerOnCurrentPosition();

      // Should return Bag End position at default zoom
      expect(state.x).toBe(3165);
      expect(state.y).toBe(1529);
      expect(state.scale).toBe(1.0);
    });

    it('returns origin when no user progress', () => {
      userProgress.value = null;
      const state = centerOnCurrentPosition();

      expect(state.x).toBe(0);
      expect(state.y).toBe(0);
      expect(state.scale).toBe(1.0);
    });
  });

  describe('initializeMap', () => {
    beforeEach(() => {
      mockStorage.setItem('sessionToken', 'test-token');
    });

    it('sets loading state during initialization', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ totalDistance: 100 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ showFutureGoalsUnlocked: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 1, distance: 50, title: 'Goal 1' },
          ],
        });

      const promise = initializeMap();
      expect(loadingState.value).toBe('loading');

      await promise;
      expect(loadingState.value).toBe('success');
    });

    it('sets error state on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await initializeMap();

      expect(loadingState.value).toBe('error');
      expect(error.value).toBeInstanceOf(Error);
      expect(error.value?.message).toBe('Network error');
    });

    it('restores persisted map view when valid', async () => {
      const persistedView = {
        x: 500,
        y: 600,
        scale: 2.0,
        timestamp: Date.now() - 1000, // 1 second ago - valid
      };
      mockStorage.setItem('walk-to-mordor-map-state', JSON.stringify(persistedView));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ totalDistance: 100 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ showFutureGoalsUnlocked: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      await initializeMap();

      expect(mapViewState.value.x).toBe(500);
      expect(mapViewState.value.y).toBe(600);
      expect(mapViewState.value.scale).toBe(2.0);
    });

    it('centers on current position when no persisted state', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ totalDistance: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ showFutureGoalsUnlocked: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      await initializeMap();

      // Should be centered on Bag End (user at 0km)
      expect(mapViewState.value.x).toBe(3165);
      expect(mapViewState.value.y).toBe(1529);
    });
  });

  describe('retryLoad', () => {
    it('clears error and re-initializes', async () => {
      error.value = new Error('Previous error');
      mockStorage.setItem('sessionToken', 'test-token');
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ totalDistance: 100 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ showFutureGoalsUnlocked: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      await retryLoad();

      expect(error.value).toBeNull();
      expect(loadingState.value).toBe('success');
    });
  });

  describe('refreshUserProgress', () => {
    it('updates userProgress signal', async () => {
      mockStorage.setItem('sessionToken', 'test-token');
      userProgress.value = { totalDistance: 100, lastUpdated: new Date() };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ totalDistance: 200 }),
      });

      await refreshUserProgress();

      expect(userProgress.value?.totalDistance).toBe(200);
    });

    it('does not update error state on failure', async () => {
      mockStorage.setItem('sessionToken', 'test-token');
      error.value = null;

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await refreshUserProgress();

      // Error state should remain unchanged (not set by background refresh)
      expect(error.value).toBeNull();
    });
  });

  describe('showFutureGoalsUnlocked', () => {
    it('defaults to true', () => {
      expect(showFutureGoalsUnlocked.value).toBe(true);
    });

    it('can be set via setShowFutureGoalsUnlocked', () => {
      setShowFutureGoalsUnlocked(false);
      expect(showFutureGoalsUnlocked.value).toBe(false);

      setShowFutureGoalsUnlocked(true);
      expect(showFutureGoalsUnlocked.value).toBe(true);
    });

    it('is loaded from session during initializeMap', async () => {
      mockStorage.setItem('sessionToken', 'test-token');
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ totalDistance: 100 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ showFutureGoalsUnlocked: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      await initializeMap();

      expect(showFutureGoalsUnlocked.value).toBe(false);
    });

    it('defaults to true if session response omits field', async () => {
      mockStorage.setItem('sessionToken', 'test-token');
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ totalDistance: 100 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      await initializeMap();

      expect(showFutureGoalsUnlocked.value).toBe(true);
    });
  });
});
