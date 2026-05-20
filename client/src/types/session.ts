/**
 * Session-related type definitions.
 *
 * Describes the shape of the `/api/session` endpoint response
 * and the user preferences that bridge to legacy globals.
 */

/**
 * Response shape from GET /api/session.
 */
export interface ActiveStoryline {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  pathKey: string;
  distanceOffset: number;
}

export interface SessionResponse {
  userId: number;
  username: string;
  avatarId: string | null;
  isAdmin: boolean;
  showFutureGoalsUnlocked: boolean;
  defaultViewMap: boolean;
  activeStoryline?: ActiveStoryline;
}

/**
 * User preference signals that mirror window.userPreferences.
 */
export interface UserPreferences {
  showFutureGoalsUnlocked: boolean;
  defaultViewMap: boolean;
}
