/**
 * Map-specific type definitions for state management.
 *
 * These types support the mapStore signals and are used across
 * all map components for consistent state handling.
 */

import type { Goal } from './goal';

/**
 * User's current walking progress.
 */
export interface UserProgress {
  /** Total distance walked in kilometers. */
  totalDistance: number;
  /** When the progress was last fetched/updated. */
  lastUpdated: Date;
}

/**
 * A milestone on the journey map with calculated coordinates.
 * Extends Goal with map-specific positioning data.
 */
export interface Milestone extends Goal {
  /** X coordinate on the map canvas. */
  x: number;
  /** Y coordinate on the map canvas. */
  y: number;
}

/**
 * Current map viewport state (pan position and zoom level).
 */
export interface MapViewState {
  /** Horizontal pan offset (stage position x). */
  x: number;
  /** Vertical pan offset (stage position y). */
  y: number;
  /** Zoom scale factor (1.0 = default, range: 0.5 - 3.0). */
  scale: number;
}

/**
 * Granular loading state for map initialization.
 */
export type MapLoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Cached milestone data structure for localStorage.
 */
export interface CachedMilestones {
  /** The milestone data array. */
  data: Milestone[];
  /** Unix timestamp when cached (Date.now()). */
  timestamp: number;
}

/**
 * Persisted map view state structure for localStorage.
 */
export interface PersistedMapView {
  /** Horizontal pan offset. */
  x: number;
  /** Vertical pan offset. */
  y: number;
  /** Zoom scale factor. */
  scale: number;
  /** Unix timestamp when saved (Date.now()) - expires after 24h. */
  timestamp: number;
}

/**
 * Viewport dimensions for visibility calculations.
 */
export interface ViewportSize {
  /** Viewport width in pixels. */
  width: number;
  /** Viewport height in pixels. */
  height: number;
}
