/**
 * Session-related type definitions for the unified app store.
 *
 * These types model the `/api/session` response and the hydrated
 * session state shared across all Preact islands.
 */

/**
 * Shape of the `/api/session` API response (camelCase from server).
 */
export interface SessionResponse {
  userId: number;
  username: string;
  avatarId: string | null;
  isAdmin: boolean;
  showFutureGoalsUnlocked: boolean;
  defaultViewMap: boolean;
}

/**
 * Hydrated session state held in appStore signals.
 * null fields indicate the store hasn't been initialized yet.
 */
export interface SessionState {
  userId: number | null;
  username: string | null;
  avatarId: string | null;
  isAdmin: boolean;
  preferences: SessionPreferences;
}

/**
 * User preference subset surfaced as reactive signals.
 */
export interface SessionPreferences {
  showFutureGoalsUnlocked: boolean;
  defaultViewMap: boolean;
}
