import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import {
  isAuthenticated,
  palantirCooldownElapsed,
  storeInitialized,
} from '../stores/appStore';
import { PalantirInsightModal } from '../components/PalantirInsightModal';
import { fetchPalantirWeeklyStats, type WeeklyStatsData } from '../utils/palantir';

/**
 * PalantirIsland — mounted via data-island="PalantirIsland" on the Journey page.
 *
 * Guards rendering behind:
 *  1. `storeInitialized` — so we read the real cooldown value, not an empty default.
 *  2. `palantirCooldownElapsed` — once-per-week cooldown stored in localStorage.
 *
 * The has_activity (30-day walks) check is enforced by the API inside the modal.
 */
export function PalantirIsland() {
  // Local dismissed flag: once the user clicks "Cast aside" we remove the modal
  // for this session even if they navigate without the cooldown ticking.
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
  }, [dismissed.value, isAuthenticated.value, palantirCooldownElapsed.value, storeInitialized.value]);

  // Do not render until the store has hydrated (prevents flash on cold load where
  // cooldown appears elapsed while localStorage hasn't been read yet).
  if (!storeInitialized.value) return null;

  // The popup is only for authenticated users. Unauthenticated users are redirected
  // by the page auth flow and should not see a transient Palantír error dialog.
  if (!isAuthenticated.value) return null;

  // Cooldown has not elapsed — do not show the modal.
  if (!palantirCooldownElapsed.value) return null;

  // Already dismissed this session.
  if (dismissed.value) return null;

  // The weekly popup is hidden entirely when the user has no recent activity.
  if (!initialStats.value) return null;

  return (
    <PalantirInsightModal
      initialStats={initialStats.value}
      onDismiss={() => {
        dismissed.value = true;
      }}
    />
  );
}
