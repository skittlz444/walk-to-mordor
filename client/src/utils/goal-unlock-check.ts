/**
 * Goal Unlock Check Utility
 *
 * Detects newly unlocked milestones when user progress changes.
 * Used by MapWalkIsland to trigger congratulations modals.
 *
 * @see Story 2.8 - Map Walk Logging
 */

import type { Milestone } from '../types/map';

/**
 * Identifies the furthest milestone newly unlocked when progress changed.
 *
 * A milestone is "newly unlocked" if:
 * - Its distance is greater than oldProgress (wasn't unlocked before)
 * - Its distance is less than or equal to newProgress (is now unlocked)
 *
 * Only the furthest milestone is returned (not all passed milestones).
 *
 * @param oldProgress - User's previous total distance (km)
 * @param newProgress - User's new total distance (km)
 * @param milestones - All available milestones with distance values
 * @returns Array with only the furthest newly unlocked milestone, or empty if none
 */
export function checkNewlyUnlockedGoals(
  oldProgress: number,
  newProgress: number,
  milestones: Milestone[],
): Milestone[] {
  // If progress didn't increase, no new milestones can be unlocked
  if (newProgress <= oldProgress) {
    return [];
  }

  // Find milestones where: oldProgress < distance <= newProgress
  const newlyUnlocked = milestones.filter(
    (m) => m.distance > oldProgress && m.distance <= newProgress,
  );

  if (newlyUnlocked.length === 0) {
    return [];
  }

  // Return only the furthest milestone (highest distance)
  const furthest = newlyUnlocked.reduce((max, m) =>
    m.distance > max.distance ? m : max,
  );
  return [furthest];
}
