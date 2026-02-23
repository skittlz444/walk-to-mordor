/**
 * Journey Page State Management Store
 *
 * Centralized reactive state for the goals section on the Journey page.
 * Uses Preact Signals for reactive updates across components.
 */

import { signal, computed } from '@preact/signals';
import type { Goal } from '../types/goal';

declare global {
  interface Window {
    getAuthHeaders: () => Record<string, string>;
    userPreferences?: {
      showFutureGoalsUnlocked?: boolean;
    };
  }
}

// ============================================================================
// Core Signals
// ============================================================================

/** All goals sorted by distance */
export const goals = signal<Goal[]>([]);

/** User's current total walking distance */
export const currentDistance = signal<number>(0);

/** Whether goals are being fetched */
export const loading = signal<boolean>(false);

/** Error message from last fetch, or null */
export const error = signal<string | null>(null);

/** Whether future goals are unlocked (clickable) — synced from window.userPreferences */
export const showFutureGoalsUnlocked = signal<boolean>(true);

// ============================================================================
// Computed Signals
// ============================================================================

/** Goals the user has already passed */
export const completedGoals = computed<Goal[]>(() =>
  goals.value.filter((g) => currentDistance.value >= g.distance)
);

/** Goals the user has not yet reached */
export const upcomingGoals = computed<Goal[]>(() =>
  goals.value.filter((g) => currentDistance.value < g.distance)
);

/** The immediate next goal (first upcoming) */
export const nextGoal = computed<Goal | null>(() =>
  upcomingGoals.value.length > 0 ? upcomingGoals.value[0] : null
);

/** Last 3 completed goals (most recent by distance) */
export const lastCompleted = computed<Goal[]>(() =>
  completedGoals.value.slice(-3)
);

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches goals from the API and updates store state.
 * @param distance - the user's current walking distance
 */
export async function fetchGoals(distance: number): Promise<void> {
  loading.value = true;
  error.value = null;
  currentDistance.value = distance;

  // Sync preference from window
  syncPreference();

  try {
    const headers =
      typeof window.getAuthHeaders === 'function'
        ? window.getAuthHeaders()
        : {};

    const res = await fetch('/api/goals', { headers });
    if (!res.ok) {
      throw new Error(`Goals API error: ${res.status} ${res.statusText}`);
    }

    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid goals data: expected array');
    }

    const sorted = (data as Goal[]).slice().sort(
      (a: Goal, b: Goal) => a.distance - b.distance
    );
    goals.value = sorted;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown error loading goals';
    error.value = message;
    console.error('Error loading goals:', err);
  } finally {
    loading.value = false;
  }
}

/**
 * Checks if any goals were newly passed between two distance totals.
 * Returns the highest-distance newly-passed goal, or null.
 */
export async function checkForNewlyPassedGoals(
  previousTotal: number,
  newTotal: number
): Promise<Goal | null> {
  try {
    const headers =
      typeof window.getAuthHeaders === 'function'
        ? window.getAuthHeaders()
        : {};

    const res = await fetch('/api/goals', { headers });
    if (!res.ok) {
      throw new Error(`Goals API error: ${res.status} ${res.statusText}`);
    }

    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid goals data: expected array');
    }

    const sorted = (data as Goal[]).slice().sort(
      (a: Goal, b: Goal) => a.distance - b.distance
    );

    const newlyPassed = sorted.filter(
      (goal: Goal) => previousTotal < goal.distance && newTotal >= goal.distance
    );

    return newlyPassed.length > 0 ? newlyPassed[newlyPassed.length - 1] : null;
  } catch (err: unknown) {
    console.error('Error checking for newly passed goals:', err);
    return null;
  }
}

/** Sync the showFutureGoalsUnlocked signal from window.userPreferences */
export function syncPreference(): void {
  if (
    window.userPreferences &&
    typeof window.userPreferences.showFutureGoalsUnlocked === 'boolean'
  ) {
    showFutureGoalsUnlocked.value =
      window.userPreferences.showFutureGoalsUnlocked;
  }
}
