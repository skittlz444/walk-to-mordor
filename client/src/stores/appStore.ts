/**
 * App-level State Management Store
 *
 * Unified session truth for the Preact layer. Hydrated from a single
 * `/api/session` fetch on page load. Domain stores (mapStore, partyStore)
 * read session-derived data from here instead of fetching independently.
 *
 * Keeps `window.userPreferences` in sync via `effect()` for legacy JS
 * compatibility. Listens for `preferenceChanged` CustomEvent to stay
 * up-to-date when preferences are changed from the profile modal.
 *
 * @see docs/architecture.md for Islands Architecture overview
 */

import { signal, computed, effect } from '@preact/signals';
import type { SessionResponse, UserPreferences } from '../types/session';

// ============================================================================
// Core Signals
// ============================================================================

/** Current user's ID. null until session is hydrated. */
export const userId = signal<number | null>(null);

/** Current user's display name. */
export const username = signal<string>('');

/** Current user's avatar ID (for map marker, etc.). */
export const avatarId = signal<string | null>(null);

/** Whether the current user has admin privileges. */
export const isAdmin = signal<boolean>(false);

/** User preference: show future goals as unlocked. Default true. */
export const showFutureGoalsUnlocked = signal<boolean>(true);

/** User preference: default view is map (vs journey list). */
export const defaultViewMap = signal<boolean>(false);

/** User's total walking distance in km. null until hydrated. */
export const totalDistance = signal<number | null>(null);

/** Whether the store has been initialized (hydrated from API). */
export const storeInitialized = signal<boolean>(false);

/** Error from initialization. null when successful. */
export const storeError = signal<string | null>(null);

/**
 * Session token signal wrapper.
 * Reads from localStorage on initialization but stays as a signal
 * for reactive consumers. Updated when initializeAppStore runs.
 */
export const sessionToken = signal<string | null>(
  typeof localStorage !== 'undefined' ? localStorage.getItem('sessionToken') || null : null,
);

// ============================================================================
// Computed Signals
// ============================================================================

/**
 * Whether the user is authenticated.
 * Derived from the sessionToken signal.
 */
export const isAuthenticated = computed<boolean>(() => {
  return sessionToken.value !== null;
});

/**
 * Combined preferences object for convenience.
 */
export const preferences = computed<UserPreferences>(() => ({
  showFutureGoalsUnlocked: showFutureGoalsUnlocked.value,
  defaultViewMap: defaultViewMap.value,
}));

/**
 * Current milestone the user has reached, based on totalDistance.
 * Returns the milestone object or null if no milestones loaded.
 *
 * Note: This depends on milestones being loaded in mapStore.
 * Returns null until mapStore is initialized.
 */
export const currentMilestone = computed(() => {
  const dist = totalDistance.value;
  if (dist === null) return null;

  // We read milestones from mapStore lazily to avoid circular deps.
  // For now, return the totalDistance; mapStore.nextMilestone provides the full data.
  return { totalDistance: dist };
});

// ============================================================================
// Bridge: window.userPreferences sync
// ============================================================================

declare global {
  interface Window {
    userPreferences?: {
      showFutureGoalsUnlocked: boolean;
      defaultViewMap: boolean;
    };
  }
}

/**
 * Keep `window.userPreferences` in sync whenever preference signals change.
 * Legacy JS (goals.js, main.js) reads this global directly.
 */
let _disposePreferenceEffect: (() => void) | null = null;

export function startPreferenceBridge(): void {
  // Dispose previous effect if re-initialized
  if (_disposePreferenceEffect) {
    _disposePreferenceEffect();
  }

  _disposePreferenceEffect = effect(() => {
    const prefs = preferences.value;
    window.userPreferences = {
      showFutureGoalsUnlocked: prefs.showFutureGoalsUnlocked,
      defaultViewMap: prefs.defaultViewMap,
    };
  });
}

// ============================================================================
// Bridge: preferenceChanged CustomEvent listener
// ============================================================================

let _preferenceListenerBound = false;

function onPreferenceChangedEvent(e: Event): void {
  const detail = (e as CustomEvent).detail;
  if (detail && typeof detail.showFutureGoalsUnlocked === 'boolean') {
    showFutureGoalsUnlocked.value = detail.showFutureGoalsUnlocked;
  }
  if (detail && typeof detail.defaultViewMap === 'boolean') {
    defaultViewMap.value = detail.defaultViewMap;
  }
}

export function startPreferenceListener(): void {
  if (_preferenceListenerBound) return;
  window.addEventListener('preferenceChanged', onPreferenceChangedEvent);
  _preferenceListenerBound = true;
}

export function stopPreferenceListener(): void {
  window.removeEventListener('preferenceChanged', onPreferenceChangedEvent);
  _preferenceListenerBound = false;
}

// ============================================================================
// Initialization
// ============================================================================

const SESSION_API_URL = '/api/session';
const TOTAL_DISTANCE_API_URL = '/api/total-distance';

/**
 * Initialize the app store by fetching `/api/session`.
 *
 * Hydrates all session signals from a single API call.
 * If the user is not authenticated (no token), signals stay at defaults.
 * On 401 response, signals remain at defaults (unauthenticated state).
 *
 * Also starts the preference bridge (effect → window.userPreferences)
 * and the preferenceChanged event listener.
 */
export async function initializeAppStore(): Promise<void> {
  storeError.value = null;

  // Refresh token signal from localStorage
  sessionToken.value = localStorage.getItem('sessionToken') || null;

  const token = sessionToken.value;
  if (!token) {
    storeInitialized.value = true;
    startPreferenceBridge();
    startPreferenceListener();
    return;
  }

  try {
    const response = await fetch(SESSION_API_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      // Token expired or invalid — clear and stay unauthenticated
      sessionToken.value = null;
      localStorage.removeItem('sessionToken');
      storeInitialized.value = true;
      startPreferenceBridge();
      startPreferenceListener();
      return;
    }

    if (!response.ok) {
      throw new Error(`Session fetch failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as SessionResponse;

    userId.value = data.userId;
    username.value = data.username;
    avatarId.value = data.avatarId;
    isAdmin.value = data.isAdmin;
    showFutureGoalsUnlocked.value =
      typeof data.showFutureGoalsUnlocked === 'boolean'
        ? data.showFutureGoalsUnlocked
        : true;
    defaultViewMap.value =
      typeof data.defaultViewMap === 'boolean'
        ? data.defaultViewMap
        : false;

    // Fetch total distance in parallel-safe manner (non-blocking on failure)
    try {
      const distResponse = await fetch(TOTAL_DISTANCE_API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (distResponse.ok) {
        const distData = (await distResponse.json()) as { totalDistance: number };
        totalDistance.value = distData.totalDistance;
      }
    } catch {
      // totalDistance remains null — non-critical
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load session';
    storeError.value = message;
    console.error('[appStore] Initialization failed:', message);
  } finally {
    storeInitialized.value = true;
    startPreferenceBridge();
    startPreferenceListener();
  }
}

/**
 * Reset all store signals to their initial state.
 * Useful for testing and logout flows.
 */
export function resetAppStore(): void {
  userId.value = null;
  username.value = '';
  avatarId.value = null;
  isAdmin.value = false;
  showFutureGoalsUnlocked.value = true;
  defaultViewMap.value = false;
  totalDistance.value = null;
  storeInitialized.value = false;
  storeError.value = null;
  sessionToken.value = null;

  stopPreferenceListener();

  if (_disposePreferenceEffect) {
    _disposePreferenceEffect();
    _disposePreferenceEffect = null;
  }
}
