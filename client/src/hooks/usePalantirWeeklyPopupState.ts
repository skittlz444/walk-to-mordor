import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import {
  isAuthenticated,
  palantirCooldownElapsed,
  storeInitialized,
} from '../stores/appStore';
import { fetchPalantirWeeklyStats, type WeeklyStatsData } from '../utils/palantir';
import type { Signal } from '@preact/signals';

export interface PalantirPopupState {
  /** Pre-fetched stats to pass as `initialStats` to PalantirInsightModal. null = not yet ready or no activity. */
  initialStats: Signal<WeeklyStatsData | null>;
  /** Set to true when the user dismisses the popup; prevents re-showing in the same session. */
  dismissed: Signal<boolean>;
}

/**
 * Shared hook that encapsulates the fetch + eligibility logic for the Palantír
 * weekly popup on both the Journey (PalantirIsland) and Map (MapIsland) pages.
 *
 * Guards behind:
 *  1. `storeInitialized` — ensures cooldown is read from localStorage, not the default.
 *  2. `isAuthenticated`  — unauthenticated users should never see a Palantír error flash.
 *  3. `palantirCooldownElapsed` — once-per-week cooldown stored in localStorage.
 *  4. `dismissed` (session-local) — hides the modal after the user clicks "Cast aside".
 *
 * Returns `{ initialStats, dismissed }`.  `initialStats` is null until the API
 * confirms `has_activity === true`, so callers can gate rendering on it being non-null.
 */
export function usePalantirWeeklyPopupState(): PalantirPopupState {
  const dismissed = useSignal(false);
  const initialStats = useSignal<WeeklyStatsData | null>(null);

  useEffect(() => {
    initialStats.value = null;

    if (
      !storeInitialized.value
      || !isAuthenticated.value
      || !palantirCooldownElapsed.value
      || dismissed.value
    ) {
      return;
    }

    let cancelled = false;

    void fetchPalantirWeeklyStats()
      .then((data) => {
        if (cancelled) return;
        initialStats.value = data.has_activity ? data : null;
      })
      .catch(() => {
        if (cancelled) return;
        initialStats.value = null;
      });

    return () => {
      cancelled = true;
    };
  }, [
    dismissed.value,
    isAuthenticated.value,
    palantirCooldownElapsed.value,
    storeInitialized.value,
  ]);

  return { initialStats, dismissed };
}
