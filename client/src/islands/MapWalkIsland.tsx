/**
 * MapWalkIsland - Walk Logging Orchestrator for the Map View
 *
 * Manages the walk logging flow from the Map view:
 * 1. Renders the FAB button to trigger walk logging
 * 2. Opens the legacy distance modal via window.showDistanceModal
 * 3. Listens for walk save/dismiss via window.onWalkSaved/onWalkDismiss
 * 4. Refreshes user progress and checks for newly unlocked milestones
 * 5. Shows congratulations modals for each unlocked milestone in sequence
 * 6. Pans map to user's new position after all modals are dismissed
 *
 * @see Story 2.8 - Map Walk Logging
 */

import { h } from 'preact';
import { useEffect, useRef, useCallback } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { MapWalkButton } from '../components/map/MapWalkButton';
import { GoalModal } from './GoalModal';
import {
  userProgress,
  milestones,
  refreshUserProgress,
  panToUserCurrentPosition,
} from '../stores/mapStore';
import { checkNewlyUnlockedGoals } from '../utils/goal-unlock-check';
import type { Milestone } from '../types/map';

/**
 * Global window interface extension for legacy JS integration
 */
declare global {
  interface Window {
    showDistanceModal?: (event: Event | null, date: Date) => void;
    showCalendarModal?: () => void;
    onWalkSaved?: (callback: ((data: WalkSavedData) => void) | null) => void;
    onWalkDismiss?: (callback: (() => void) | null) => void;
    onCalendarDismiss?: (callback: (() => void) | null) => void;
    /** Update MapIsland's user distance (in km) - exposed by MapIsland */
    updateMapDistance?: (distanceKm: number) => void;
  }
}

interface WalkSavedData {
  action: 'save' | 'update' | 'delete';
  date: string;
  distance?: number;
}

export interface MapWalkIslandProps {
  /**
   * Current user distance in km at render time.
   *
   * NOTE: This intentionally co-exists with the `userProgress` signal:
   * - The server / legacy map code passes this value into the island as an explicit prop.
   * - MapWalkIsland forwards it to children (e.g. GoalModal) that may rely on the
   *   initial distance when the flow starts, while `userProgress` is used for
   *   refreshed progress after a walk is saved.
   *
   * Do not remove without auditing all MapWalkIsland callers and GoalModal usage;
   * this prop is part of the public API and is kept for compatibility and clarity.
   */
  currentDistanceKm: number;
}

/**
 * Walk Logging Orchestrator Component.
 *
 * Renders a FAB button and handles the walk logging flow,
 * including congratulations modals for newly unlocked milestones.
 */
export function MapWalkIsland({ currentDistanceKm }: MapWalkIslandProps): h.JSX.Element {
  // Congratulations queue for newly unlocked milestones
  const congratsQueue = useSignal<Milestone[]>([]);
  const showingCongrats = useSignal<Milestone | null>(null);
  
  // Store old progress for comparison after walk is logged
  const oldProgressRef = useRef<number>(0);

  /**
   * Handle FAB click - open the calendar modal.
   */
  const handleFabClick = () => {
    // Store current progress for comparison after save
    oldProgressRef.current = userProgress.value?.totalDistance ?? 0;

    // Open calendar modal (clicking a date will open the distance modal)
    if (window.showCalendarModal) {
      window.showCalendarModal();
    } else {
      console.warn('[MapWalkIsland] window.showCalendarModal not available');
    }
  };

  /**
   * Handle walk saved - refresh progress and check for new milestones.
   */
  const handleWalkSaved = useCallback(async () => {
    try {
      // Refresh user progress from API
      await refreshUserProgress();

      const newProgress = userProgress.value?.totalDistance ?? 0;
      const oldProgress = oldProgressRef.current;

      // Update MapIsland's visual state with the new distance
      if (window.updateMapDistance) {
        window.updateMapDistance(newProgress);
      }

      // Check for newly unlocked milestones
      const newlyUnlocked = checkNewlyUnlockedGoals(
        oldProgress,
        newProgress,
        milestones.value,
      );

      if (newlyUnlocked.length > 0) {
        // Queue all newly unlocked milestones
        congratsQueue.value = newlyUnlocked;
        // Show first one
        showingCongrats.value = newlyUnlocked[0];
      } else {
        // No new milestones - just pan to new position
        panToUserCurrentPosition();
      }
    } catch (err) {
      console.error('[MapWalkIsland] Error handling walk save:', err);
    }
  }, []);

  /**
   * Handle dismiss button on walk modal (no save).
   * Just clears the ref, no action needed.
   */
  const handleWalkDismiss = useCallback(() => {
    // Nothing to do - user cancelled
  }, []);

  /**
   * Handle closing a congratulations modal.
   * Shows next in queue or pans to user position if queue is empty.
   */
  const handleCongratsClose = () => {
    const queue = [...congratsQueue.value];
    
    // Remove the first item (which we just showed)
    queue.shift();
    congratsQueue.value = queue;

    if (queue.length > 0) {
      // Show next milestone
      showingCongrats.value = queue[0];
    } else {
      // Queue exhausted - pan to new position
      showingCongrats.value = null;
      panToUserCurrentPosition();
    }
  };

  /**
   * Register callbacks with legacy JS on mount, cleanup on unmount.
   */
  useEffect(() => {
    // Register callbacks
    if (window.onWalkSaved) {
      window.onWalkSaved(handleWalkSaved);
    }
    if (window.onWalkDismiss) {
      window.onWalkDismiss(handleWalkDismiss);
    }

    // Cleanup on unmount
    return () => {
      if (window.onWalkSaved) {
        window.onWalkSaved(null);
      }
      if (window.onWalkDismiss) {
        window.onWalkDismiss(null);
      }
    };
  }, [handleWalkSaved, handleWalkDismiss]);

  return (
    <>
      {/* Walk Logging FAB */}
      <MapWalkButton onClick={handleFabClick} />

      {/* Congratulations Modal */}
      {showingCongrats.value && (
        <GoalModal
          goal={showingCongrats.value}
          currentDistance={currentDistanceKm}
          isCongratulations={true}
          onClose={handleCongratsClose}
        />
      )}
    </>
  );
}
