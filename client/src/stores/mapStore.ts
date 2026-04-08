/**
 * Map State Management Store
 *
 * Centralized reactive state for the interactive journey map.
 * Uses Preact Signals for reactive updates across components.
 *
 * This store is the foundation for:
 * - User progress tracking
 * - Milestone/waypoint data
 * - Map viewport state (pan/zoom)
 * - Loading and error states
 *
 * @see docs/architecture.md#ADR-003 for Preact Signals decision
 */

import { signal, computed } from '@preact/signals';
import type {
  UserProgress,
  Milestone,
  MapViewState,
  MapLoadingState,
} from '../types/map';
import { getUserPosition, type Point } from '../utils/map-utils';
import { fellowshipPath } from '../data/paths/fellowship-path';
import { showFutureGoalsUnlocked as appShowFutureGoalsUnlocked } from './appStore';

// ============================================================================
// Core Signals
// ============================================================================

/**
 * User's current walking progress.
 * null until initial fetch completes.
 */
export const userProgress = signal<UserProgress | null>(null);

/**
 * All milestone waypoints with calculated coordinates.
 * Populated from /api/goals on map initialization.
 */
export const milestones = signal<Milestone[]>([]);

/**
 * Current map viewport state (pan position and zoom level).
 * May be restored from localStorage on initialization.
 */
export const mapViewState = signal<MapViewState>({
  x: 0,
  y: 0,
  scale: 1.0,
});

/**
 * Granular loading state for map initialization.
 */
export const loadingState = signal<MapLoadingState>('idle');

/**
 * Error from failed API calls or initialization.
 * null when no error.
 */
export const error = signal<Error | null>(null);

/**
 * User preference: whether future goals appear unlocked.
 * Derived from appStore (single session source of truth) via computed signal.
 * Automatically stays in sync — no manual snapshot needed.
 */
export const showFutureGoalsUnlocked = computed<boolean>(() => appShowFutureGoalsUnlocked.value);

// ============================================================================
// Computed Signals (defined in mapStore for full implementation)
// ============================================================================

/**
 * Boolean shorthand for loading state.
 */
export const isLoading = computed(() => loadingState.value === 'loading');

/**
 * Boolean shorthand for error state.
 */
export const hasError = computed(() => error.value !== null);

/**
 * Milestones the user has already reached (distance <= user's total).
 */
export const unlockedMilestones = computed(() => {
  const progress = userProgress.value;
  if (!progress) return [];
  return milestones.value.filter((m) => m.distance <= progress.totalDistance);
});

/**
 * The next milestone the user is approaching (first where distance > user's total).
 */
export const nextMilestone = computed(() => {
  const progress = userProgress.value;
  if (!progress) return undefined;
  return milestones.value.find((m) => m.distance > progress.totalDistance);
});

/**
 * Viewport dimensions for visibility calculations.
 * Set by MapIsland when canvas initializes or resizes.
 */
export const viewportSize = signal<{ width: number; height: number }>({ width: 0, height: 0 });

/**
 * User's current position on the map as {x, y} coordinates.
 * Calculated by interpolating along the fellowship path.
 *
 * Note: Uses miles internally for path calculation.
 * Distance is stored in km, converted via KM_TO_MILES constant.
 */
const KM_TO_MILES = 0.621371;

export const currentPosition = computed((): Point => {
  const progress = userProgress.value;
  if (!progress) return { x: 0, y: 0 };

  const distanceMiles = progress.totalDistance * KM_TO_MILES;
  return getUserPosition(fellowshipPath, distanceMiles);
});

/**
 * Milestones currently visible in the viewport.
 * Filters based on current pan position, zoom level, and viewport dimensions.
 * Adds padding (20%) to include milestones just outside the visible area.
 */
export const visibleMilestones = computed(() => {
  const { x: panX, y: panY, scale } = mapViewState.value;
  const { width, height } = viewportSize.value;

  // If viewport not initialized yet, return all milestones
  if (width === 0 || height === 0) return milestones.value;

  // Calculate visible bounds in map coordinates
  // panX/panY represent the stage position (negative when panned right/down)
  // Scale affects how much of the map is visible
  const padding = 0.2; // 20% padding for smooth transitions

  // Convert viewport bounds to map coordinates
  const visibleLeft = (-panX - width * padding) / scale;
  const visibleRight = (-panX + width + width * padding) / scale;
  const visibleTop = (-panY - height * padding) / scale;
  const visibleBottom = (-panY + height + height * padding) / scale;

  return milestones.value.filter((m) => {
    return m.x >= visibleLeft && m.x <= visibleRight && m.y >= visibleTop && m.y <= visibleBottom;
  });
});

// ============================================================================
// API Integration Functions
// ============================================================================

const PROGRESS_API_URL = '/api/total-distance';
const GOALS_API_URL = '/api/goals';

/**
 * API response shape from /api/total-distance
 */
interface TotalDistanceResponse {
  totalDistance: number;
}

/**
 * Goal data from /api/goals
 */
interface GoalResponse {
  id: number;
  distance: number;
  title: string;
  special?: string | null;
  description?: string | null;
  image_id?: string | null;
}

/**
 * Fetch user's total walking distance from the API.
 *
 * @returns UserProgress with totalDistance and lastUpdated timestamp.
 * @throws Error on non-ok response.
 */
export async function fetchUserProgress(): Promise<UserProgress> {
  const token = localStorage.getItem('sessionToken');
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(PROGRESS_API_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch progress: HTTP ${response.status}`);
  }

  const data = (await response.json()) as TotalDistanceResponse;

  return {
    totalDistance: data.totalDistance,
    lastUpdated: new Date(),
  };
}

/**
 * Fetch all goal milestones and calculate their map coordinates.
 *
 * Uses getWaypointCoordinates from waypoints.ts to derive x,y positions
 * by interpolating along the fellowship path.
 *
 * @returns Array of Milestone objects with coordinates.
 * @throws Error on non-ok response.
 */
export async function fetchMilestones(): Promise<Milestone[]> {
  const token = localStorage.getItem('sessionToken');
  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const response = await fetch(GOALS_API_URL, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch goals: HTTP ${response.status}`);
  }

  const goals = (await response.json()) as GoalResponse[];

  // Import dynamically to avoid circular dependencies
  const { getWaypointCoordinates } = await import('../data/waypoints');

  const waypoints = getWaypointCoordinates(fellowshipPath, goals);

  // Map waypoints back to Milestone format (preserving all Goal fields)
  return goals.map((goal, index) => ({
    ...goal,
    x: waypoints[index].x,
    y: waypoints[index].y,
  }));
}

// ============================================================================
// Store Actions
// ============================================================================

import {
  getCachedMilestones,
  cacheMilestones,
  getPersistedMapView,
  persistMapView,
} from '../utils/map-cache';

/** Default zoom level for centering on user position. */
const DEFAULT_ZOOM = 1.0;

/** Debounce delay for map view persistence (ms). */
const PERSIST_DEBOUNCE_MS = 500;

/** Debounce timer reference. */
let persistDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize the map state by fetching user progress and milestones.
 *
 * Strategy:
 * 1. Set loading state.
 * 2. Fetch user progress (always fresh).
 * 3. Try cached milestones, fall back to API if expired.
 * 4. Restore persisted map view if valid (< 24h), otherwise center on user.
 */
export async function initializeMap(): Promise<void> {
  loadingState.value = 'loading';
  error.value = null;

  try {
    // Fetch user progress (always fresh - no cache)
    const progress = await fetchUserProgress();
    userProgress.value = progress;

    // showFutureGoalsUnlocked is a computed from appStore — no manual sync needed.
    // Safe: initializeAppStore() completes before island hydration (see index.tsx bootstrap)

    // Try cached milestones first
    let milestonesData = getCachedMilestones();
    if (!milestonesData) {
      // Cache miss or expired - fetch from API
      milestonesData = await fetchMilestones();
      cacheMilestones(milestonesData);
    }
    milestones.value = milestonesData;

    // Restore persisted map view or center on current position
    const persistedView = getPersistedMapView();
    if (persistedView) {
      // Valid persisted state (< 24h old) - restore it
      mapViewState.value = persistedView;
    } else {
      // No valid persisted state - center on user's current position
      mapViewState.value = centerOnCurrentPosition();
    }

    loadingState.value = 'success';
  } catch (err) {
    error.value = err instanceof Error ? err : new Error(String(err));
    loadingState.value = 'error';
    console.error('[mapStore] Initialization failed:', err);
  }
}

/**
 * Retry loading after an error.
 * Clears the error and re-runs initialization.
 */
export async function retryLoad(): Promise<void> {
  error.value = null;
  await initializeMap();
}

/**
 * Update the map view state (position and/or scale).
 * Debounces persistence to localStorage.
 *
 * @param newState - Partial state to merge with existing state.
 */
export function updateMapView(newState: Partial<MapViewState>): void {
  mapViewState.value = {
    ...mapViewState.value,
    ...newState,
  };

  // Debounce persistence
  debouncedPersistMapView();
}

/**
 * Debounced persistence of map view state.
 * Waits 500ms after last call before writing to localStorage.
 */
function debouncedPersistMapView(): void {
  if (persistDebounceTimer) {
    clearTimeout(persistDebounceTimer);
  }
  persistDebounceTimer = setTimeout(() => {
    persistMapView(mapViewState.value);
    persistDebounceTimer = null;
  }, PERSIST_DEBOUNCE_MS);
}

/**
 * Refresh user progress from the API.
 * Used after logging a new walk (Story 2.8).
 */
export async function refreshUserProgress(): Promise<void> {
  try {
    const progress = await fetchUserProgress();
    userProgress.value = progress;
  } catch (err) {
    console.error('[mapStore] Failed to refresh user progress:', err);
    // Don't update error state - this is a background refresh
  }
}

/**
 * Calculate MapViewState to center the viewport on the user's current position.
 * Returns a new MapViewState with x,y offsets and default zoom.
 *
 * Note: This doesn't apply the state - it just calculates what it should be.
 * The viewport dimensions are assumed to be set elsewhere (MapIsland).
 */
export function centerOnCurrentPosition(): MapViewState {
  const position = currentPosition.value;

  // Return centered position at default zoom
  // Note: The actual viewport offset calculation requires viewport dimensions,
  // which are only known in MapIsland. This returns the user's map position
  // as the target center point. MapIsland will translate this to actual
  // stage position based on viewport size.
  return {
    x: position.x,
    y: position.y,
    scale: DEFAULT_ZOOM,
  };
}

/**
 * Update viewport dimensions.
 * Called by MapIsland when canvas initializes or window resizes.
 *
 * @param size - New viewport dimensions.
 */
export function setViewportSize(size: { width: number; height: number }): void {
  viewportSize.value = size;
}

/**
 * Set the user's goal visibility preference.
 * Called from profile modal or session initialization.
 *
 * @param value - true = unlocked (default), false = locked (surprise mode)
 */
export function setShowFutureGoalsUnlocked(value: boolean): void {
  appShowFutureGoalsUnlocked.value = value;
}

// ============================================================================
// Pan/Zoom Animation Actions
// ============================================================================

/** Animation frame ID for cleanup. */
let animationFrameId: number | null = null;

/** Default animation duration in ms. */
const PAN_ANIMATION_DURATION_MS = 500;

/**
 * Ease-out cubic function for smooth deceleration.
 * @param t - Progress from 0 to 1
 * @returns Eased value from 0 to 1
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Smoothly animate the map view to center on a specific position.
 *
 * @param position - Target position in map coordinates (x, y).
 * @param scale - Optional zoom level (default: current scale).
 * @param durationMs - Animation duration in ms (default: 500).
 */
export function panToPosition(
  position: { x: number; y: number },
  scale?: number,
  durationMs: number = PAN_ANIMATION_DURATION_MS,
): void {
  // Cancel any existing animation
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  const { width, height } = viewportSize.value;
  const currentState = mapViewState.value;
  const targetScale = scale ?? currentState.scale;

  // Calculate target stage position to center the given map coordinates
  // Stage position is negative of (mapPosition * scale - viewportSize/2)
  const targetX = -(position.x * targetScale - width / 2);
  const targetY = -(position.y * targetScale - height / 2);

  // Starting values
  const startX = currentState.x;
  const startY = currentState.y;
  const startScale = currentState.scale;
  const startTime = performance.now();

  function animate(currentTime: number): void {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    const easedProgress = easeOutCubic(progress);

    // Interpolate values
    const newX = startX + (targetX - startX) * easedProgress;
    const newY = startY + (targetY - startY) * easedProgress;
    const newScale = startScale + (targetScale - startScale) * easedProgress;

    // Update map view state
    mapViewState.value = {
      x: newX,
      y: newY,
      scale: newScale,
    };

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      animationFrameId = null;
      // Persist final position
      persistMapView(mapViewState.value);
    }
  }

  animationFrameId = requestAnimationFrame(animate);
}

/**
 * Smoothly animate the map view to center on the user's current position.
 *
 * Uses the currentPosition computed signal to get the user's location.
 * @param scale - Optional zoom level (default: current scale or 1.0).
 */
export function panToUserCurrentPosition(scale?: number): void {
  const position = currentPosition.value;
  const targetScale = scale ?? Math.max(mapViewState.value.scale, 1.0);
  panToPosition(position, targetScale);
}

/**
 * Cancel any ongoing pan animation.
 */
export function cancelPanAnimation(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

