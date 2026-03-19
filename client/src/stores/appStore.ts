/**
 * Unified App State Store
 *
 * Single source of session truth for the Preact layer.
 * Hydrates from one `/api/session` call, then exposes reactive signals
 * consumed by mapStore, partyStore, and all islands.
 *
 * Bridge globals (`window.userPreferences`) are kept in sync via effects.
 *
 * @see docs/architecture.md for Preact Signals decision
 */

import { signal, computed, effect } from '@preact/signals';
import type { SessionResponse, SessionState, SessionPreferences } from '../types/session';
import { getSessionToken } from '../utils/auth';

// ============================================================================
// Window augmentation for legacy bridge globals
// ============================================================================

declare global {
  interface Window {
    userPreferences?: {
      showFutureGoalsUnlocked: boolean;
      defaultViewMap: boolean;
    };
  }
}

// ============================================================================
// Core Signals
// ============================================================================

/** User ID from session. null until initialized. */
export const userId = signal<number | null>(null);

/** Username from session. null until initialized. */
export const username = signal<string | null>(null);

/** Avatar identifier from session. null until set or if user has no avatar. */
export const avatarId = signal<string | null>(null);

/** Whether the user has admin privileges. */
export const isAdmin = signal<boolean>(false);

/** User preferences (goal visibility, default view). */
export const preferences = signal<SessionPreferences>({
  showFutureGoalsUnlocked: true,
  defaultViewMap: false,
});

/**
 * Session token signal.
 * Reads from localStorage on access; updated when `initializeAppStore()` runs.
 * Token storage itself stays in localStorage (AuthForms writes it there).
 */
export const sessionToken = signal<string | null>(getSessionToken());

/** Whether the store has completed its initial hydration. */
export const initialized = signal<boolean>(false);

/** Error from the initialization fetch, if any. */
export const initError = signal<string | null>(null);

// ============================================================================
// Computed Signals
// ============================================================================

/** Whether the user is authenticated (has a valid-looking token). */
export const isAuthenticated = computed(() => sessionToken.value !== null);

/**
 * Aggregated session state snapshot for convenience.
 */
export const sessionState = computed<SessionState>(() => ({
  userId: userId.value,
  username: username.value,
  avatarId: avatarId.value,
  isAdmin: isAdmin.value,
  preferences: preferences.value,
}));

// ============================================================================
// Bridge Global Sync
// ============================================================================

/**
 * Keep `window.userPreferences` in sync whenever preference signals change.
 * This satisfies legacy JS (goals.js, progress.js) that reads the global.
 */
effect(() => {
  const prefs = preferences.value;
  if (typeof window !== 'undefined') {
    window.userPreferences = {
      showFutureGoalsUnlocked: prefs.showFutureGoalsUnlocked,
      defaultViewMap: prefs.defaultViewMap,
    };
  }
});

// ============================================================================
// Listen for external preference changes (e.g. ProfileIsland toggle)
// ============================================================================

if (typeof window !== 'undefined') {
  window.addEventListener('preferenceChanged', ((e: CustomEvent) => {
    const detail = e.detail;
    if (detail && typeof detail.showFutureGoalsUnlocked === 'boolean') {
      preferences.value = {
        ...preferences.value,
        showFutureGoalsUnlocked: detail.showFutureGoalsUnlocked,
      };
    }
  }) as EventListener);
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Hydrate all session signals from a single `/api/session` call.
 *
 * Safe to call multiple times — subsequent calls re-fetch.
 * If no token is present the store marks itself as initialized
 * but leaves signals at their defaults (unauthenticated state).
 */
export async function initializeAppStore(): Promise<void> {
  initError.value = null;

  // Refresh token signal from localStorage in case AuthForms wrote it
  sessionToken.value = getSessionToken();

  if (!sessionToken.value) {
    // Not authenticated — nothing to fetch
    initialized.value = true;
    return;
  }

  try {
    const res = await fetch('/api/session', {
      headers: { Authorization: `Bearer ${sessionToken.value}` },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        // Token is stale — treat as unauthenticated (don't clear it here,
        // that's the responsibility of main.js / AuthForms).
        initialized.value = true;
        return;
      }
      throw new Error(`Session fetch failed: HTTP ${res.status}`);
    }

    const data: SessionResponse = await res.json();

    userId.value = data.userId;
    username.value = data.username;
    avatarId.value = data.avatarId;
    isAdmin.value = data.isAdmin;
    preferences.value = {
      showFutureGoalsUnlocked:
        typeof data.showFutureGoalsUnlocked === 'boolean'
          ? data.showFutureGoalsUnlocked
          : true,
      defaultViewMap:
        typeof data.defaultViewMap === 'boolean'
          ? data.defaultViewMap
          : false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    initError.value = message;
    console.error('[appStore] initialization failed:', message);
  } finally {
    initialized.value = true;
  }
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Update a single preference and dispatch the `preferenceChanged` CustomEvent
 * so legacy listeners (MapIsland, goals.js) react.
 */
export function updatePreference<K extends keyof SessionPreferences>(
  key: K,
  value: SessionPreferences[K],
): void {
  preferences.value = { ...preferences.value, [key]: value };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('preferenceChanged', {
        detail: { [key]: value },
      }),
    );
  }
}

/**
 * Refresh the session token signal from localStorage.
 * Call after login/logout events.
 */
export function refreshToken(): void {
  sessionToken.value = getSessionToken();
}
