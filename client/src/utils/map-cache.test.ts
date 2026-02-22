import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CACHE_KEYS,
  getCachedMilestones,
  cacheMilestones,
  getPersistedMapView,
  persistMapView,
  clearMapCache,
} from './map-cache';
import type { Milestone, MapViewState } from '../types/map';

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

describe('map-cache', () => {
  let mockStorage: Storage;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
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

  describe('CACHE_KEYS', () => {
    it('has correct milestone key', () => {
      expect(CACHE_KEYS.MILESTONES).toBe('walk-to-mordor-milestones');
    });

    it('has correct map view key', () => {
      expect(CACHE_KEYS.MAP_VIEW).toBe('walk-to-mordor-map-state');
    });
  });

  describe('cacheMilestones / getCachedMilestones', () => {
    const mockMilestones: Milestone[] = [
      { id: 1, distance: 100, title: 'Test Goal', x: 10, y: 20 },
      { id: 2, distance: 200, title: 'Another Goal', x: 30, y: 40, special: 'Special!' },
    ];

    it('caches and retrieves milestones', () => {
      cacheMilestones(mockMilestones);
      const cached = getCachedMilestones();
      expect(cached).toEqual(mockMilestones);
    });

    it('returns null when no cached data', () => {
      const cached = getCachedMilestones();
      expect(cached).toBeNull();
    });

    it('returns null for expired cache (24h+)', () => {
      // Cache with a timestamp 25 hours ago
      const expired = {
        data: mockMilestones,
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
      };
      mockStorage.setItem(CACHE_KEYS.MILESTONES, JSON.stringify(expired));

      const cached = getCachedMilestones();
      expect(cached).toBeNull();
      // Should have removed the expired entry
      expect(mockStorage.removeItem).toHaveBeenCalledWith(CACHE_KEYS.MILESTONES);
    });

    it('returns data for valid cache (< 24h)', () => {
      // Cache with a timestamp 23 hours ago
      const valid = {
        data: mockMilestones,
        timestamp: Date.now() - 23 * 60 * 60 * 1000,
      };
      mockStorage.setItem(CACHE_KEYS.MILESTONES, JSON.stringify(valid));

      const cached = getCachedMilestones();
      expect(cached).toEqual(mockMilestones);
    });

    it('returns null for invalid JSON', () => {
      mockStorage.setItem(CACHE_KEYS.MILESTONES, 'not valid json');
      const cached = getCachedMilestones();
      expect(cached).toBeNull();
    });

    it('returns null for invalid structure (missing timestamp)', () => {
      mockStorage.setItem(CACHE_KEYS.MILESTONES, JSON.stringify({ data: mockMilestones }));
      const cached = getCachedMilestones();
      expect(cached).toBeNull();
    });

    it('returns null for invalid structure (missing data)', () => {
      mockStorage.setItem(CACHE_KEYS.MILESTONES, JSON.stringify({ timestamp: Date.now() }));
      const cached = getCachedMilestones();
      expect(cached).toBeNull();
    });
  });

  describe('persistMapView / getPersistedMapView', () => {
    const mockViewState: MapViewState = { x: 100, y: 200, scale: 1.5 };

    it('persists and retrieves map view state', () => {
      persistMapView(mockViewState);
      const persisted = getPersistedMapView();
      expect(persisted).toEqual(mockViewState);
    });

    it('returns null when no persisted data', () => {
      const persisted = getPersistedMapView();
      expect(persisted).toBeNull();
    });

    it('returns null for expired state (24h+)', () => {
      const expired = {
        ...mockViewState,
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
      };
      mockStorage.setItem(CACHE_KEYS.MAP_VIEW, JSON.stringify(expired));

      const persisted = getPersistedMapView();
      expect(persisted).toBeNull();
      expect(mockStorage.removeItem).toHaveBeenCalledWith(CACHE_KEYS.MAP_VIEW);
    });

    it('returns data for valid state (< 24h)', () => {
      const valid = {
        ...mockViewState,
        timestamp: Date.now() - 23 * 60 * 60 * 1000,
      };
      mockStorage.setItem(CACHE_KEYS.MAP_VIEW, JSON.stringify(valid));

      const persisted = getPersistedMapView();
      expect(persisted).toEqual(mockViewState);
    });

    it('returns null for invalid JSON', () => {
      mockStorage.setItem(CACHE_KEYS.MAP_VIEW, 'invalid json');
      const persisted = getPersistedMapView();
      expect(persisted).toBeNull();
    });

    it('returns null for invalid structure (missing x)', () => {
      mockStorage.setItem(
        CACHE_KEYS.MAP_VIEW,
        JSON.stringify({ y: 200, scale: 1.5, timestamp: Date.now() }),
      );
      const persisted = getPersistedMapView();
      expect(persisted).toBeNull();
    });

    it('returns null for invalid structure (missing timestamp)', () => {
      mockStorage.setItem(CACHE_KEYS.MAP_VIEW, JSON.stringify(mockViewState));
      const persisted = getPersistedMapView();
      expect(persisted).toBeNull();
    });
  });

  describe('clearMapCache', () => {
    it('removes all cache entries', () => {
      cacheMilestones([{ id: 1, distance: 100, title: 'Test', x: 0, y: 0 }]);
      persistMapView({ x: 0, y: 0, scale: 1 });

      clearMapCache();

      expect(mockStorage.removeItem).toHaveBeenCalledWith(CACHE_KEYS.MILESTONES);
      expect(mockStorage.removeItem).toHaveBeenCalledWith(CACHE_KEYS.MAP_VIEW);
    });
  });

  describe('localStorage unavailable', () => {
    it('cacheMilestones handles error gracefully', () => {
      const errorStorage = {
        ...mockStorage,
        setItem: vi.fn(() => {
          throw new Error('QuotaExceeded');
        }),
      };
      Object.defineProperty(globalThis, 'localStorage', {
        value: errorStorage,
        writable: true,
      });

      // Should not throw
      expect(() => cacheMilestones([{ id: 1, distance: 100, title: 'Test', x: 0, y: 0 }])).not.toThrow();
    });

    it('persistMapView handles error gracefully', () => {
      const errorStorage = {
        ...mockStorage,
        setItem: vi.fn(() => {
          throw new Error('QuotaExceeded');
        }),
      };
      Object.defineProperty(globalThis, 'localStorage', {
        value: errorStorage,
        writable: true,
      });

      // Should not throw
      expect(() => persistMapView({ x: 0, y: 0, scale: 1 })).not.toThrow();
    });
  });
});
