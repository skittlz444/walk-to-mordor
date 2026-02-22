/**
 * Map Cache Utilities
 *
 * LocalStorage caching layer for map state persistence.
 * Handles milestone caching and map view state persistence
 * with TTL (time-to-live) validation.
 */

import type {
  Milestone,
  MapViewState,
  CachedMilestones,
  PersistedMapView,
} from '../types/map';

// ============================================================================
// Cache Keys
// ============================================================================

export const CACHE_KEYS = {
  /** Cache key for milestone data. */
  MILESTONES: 'walk-to-mordor-milestones',
  /** Cache key for map view state (position + zoom). */
  MAP_VIEW: 'walk-to-mordor-map-state',
} as const;

// ============================================================================
// TTL Configuration
// ============================================================================

/** 24 hours in milliseconds. */
const TTL_24_HOURS = 24 * 60 * 60 * 1000;

// ============================================================================
// Milestone Caching
// ============================================================================

/**
 * Get cached milestones from localStorage.
 *
 * @returns Cached milestones array if valid and not expired, null otherwise.
 */
export function getCachedMilestones(): Milestone[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.MILESTONES);
    if (!raw) return null;

    const cached = JSON.parse(raw) as CachedMilestones;

    // Validate structure
    if (!cached || typeof cached.timestamp !== 'number' || !Array.isArray(cached.data)) {
      return null;
    }

    // Check TTL (24 hours)
    const age = Date.now() - cached.timestamp;
    if (age >= TTL_24_HOURS) {
      // Expired - remove from cache
      localStorage.removeItem(CACHE_KEYS.MILESTONES);
      return null;
    }

    return cached.data;
  } catch {
    // Invalid JSON or localStorage error
    return null;
  }
}

/**
 * Cache milestones to localStorage with timestamp.
 *
 * @param milestones - Array of milestones to cache.
 */
export function cacheMilestones(milestones: Milestone[]): void {
  try {
    const cached: CachedMilestones = {
      data: milestones,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEYS.MILESTONES, JSON.stringify(cached));
  } catch {
    // Quota exceeded or localStorage unavailable - fail silently
    console.warn('[map-cache] Failed to cache milestones');
  }
}

// ============================================================================
// Map View State Persistence
// ============================================================================

/**
 * Get persisted map view state from localStorage.
 *
 * @returns MapViewState if valid and not expired (< 24h), null otherwise.
 */
export function getPersistedMapView(): MapViewState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.MAP_VIEW);
    if (!raw) return null;

    const persisted = JSON.parse(raw) as PersistedMapView;

    // Validate structure
    if (
      !persisted ||
      typeof persisted.x !== 'number' ||
      typeof persisted.y !== 'number' ||
      typeof persisted.scale !== 'number' ||
      typeof persisted.timestamp !== 'number'
    ) {
      return null;
    }

    // Check TTL (24 hours)
    const age = Date.now() - persisted.timestamp;
    if (age >= TTL_24_HOURS) {
      // Expired - remove from cache
      localStorage.removeItem(CACHE_KEYS.MAP_VIEW);
      return null;
    }

    // Return only the MapViewState fields (exclude timestamp)
    return {
      x: persisted.x,
      y: persisted.y,
      scale: persisted.scale,
    };
  } catch {
    // Invalid JSON or localStorage error
    return null;
  }
}

/**
 * Persist map view state to localStorage with timestamp.
 *
 * @param state - MapViewState to persist.
 */
export function persistMapView(state: MapViewState): void {
  try {
    const persisted: PersistedMapView = {
      ...state,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEYS.MAP_VIEW, JSON.stringify(persisted));
  } catch {
    // Quota exceeded or localStorage unavailable - fail silently
    console.warn('[map-cache] Failed to persist map view state');
  }
}

/**
 * Clear all map-related cache entries.
 * Useful for testing or forced refresh.
 */
export function clearMapCache(): void {
  try {
    localStorage.removeItem(CACHE_KEYS.MILESTONES);
    localStorage.removeItem(CACHE_KEYS.MAP_VIEW);
  } catch {
    // localStorage unavailable - fail silently
  }
}
