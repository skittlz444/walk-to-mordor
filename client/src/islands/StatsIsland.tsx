import { useSignal } from '@preact/signals';
import { isAdmin, storeInitialized } from '../stores/appStore';
import { PalantirInsightModal } from '../components/PalantirInsightModal';
import { HeatmapCalendar } from '../components/HeatmapCalendar';
import { WrappedIsland } from './WrappedIsland';

type StatsTab = 'palantir' | 'heatmap' | 'wrapped';

/**
 * StatsIsland — main content island for the /stats page.
 *
 * Provides a sub-navigation hub for stat views:
 *  - "The Palantír" tab: Weekly Insight Orb in always-open mode (no cooldown)
 *  - "Heatmap" tab: placeholder for a future heatmap view
 *  - "Year in Review" tab: Wrapped annual summary (admin only)
 *
 * The active tab is tracked client-side via a signal.
 * If the URL contains a hash (e.g. #heatmap), it is respected on load.
 */
export function StatsIsland() {
  const getInitialTab = (): StatsTab => {
    if (typeof window === 'undefined') return 'palantir';
    const hash = window.location.hash;
    if (hash === '#heatmap') return 'heatmap';
    if (hash === '#wrapped') return 'wrapped';
    return 'palantir';
  };

  const activeTab = useSignal<StatsTab>(getInitialTab());

  function selectTab(tab: StatsTab) {
    activeTab.value = tab;
    // Update hash so the URL is shareable / bookmarkable
    if (typeof window !== 'undefined') {
      window.location.hash = `#${tab}`;
    }
  }

  const showWrapped = storeInitialized.value && isAdmin.value;
  const visibleTab = activeTab.value === 'wrapped' && !showWrapped
    ? 'palantir'
    : activeTab.value;

  return (
    <div class="stats-page">
      {/* Sub-navigation */}
      <nav class="stats-subnav" aria-label="Stats sections">
        <button
          class={`stats-subnav-tab${visibleTab === 'palantir' ? ' active' : ''}`}
          onClick={() => selectTab('palantir')}
          aria-current={visibleTab === 'palantir' ? 'page' : undefined}
        >
          The Palantír
        </button>
        <button
          class={`stats-subnav-tab${visibleTab === 'heatmap' ? ' active' : ''}`}
          onClick={() => selectTab('heatmap')}
          aria-current={visibleTab === 'heatmap' ? 'page' : undefined}
        >
          Heatmap
        </button>
        {showWrapped && (
          <button
            class={`stats-subnav-tab${visibleTab === 'wrapped' ? ' active' : ''}`}
            onClick={() => selectTab('wrapped')}
            aria-current={visibleTab === 'wrapped' ? 'page' : undefined}
            data-testid="wrapped-tab"
          >
            Year in Review
          </button>
        )}
      </nav>

      {/* Tab panels */}
      <div class="stats-panel">
        {visibleTab === 'palantir' && (
          <PalantirInsightModal alwaysOpen />
        )}
        {visibleTab === 'heatmap' && (
          <HeatmapCalendar />
        )}
        {visibleTab === 'wrapped' && showWrapped && (
          <WrappedIsland />
        )}
      </div>
    </div>
  );
}
