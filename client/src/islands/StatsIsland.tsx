import { useSignal } from '@preact/signals';
import { PalantirInsightModal } from '../components/PalantirInsightModal';

type StatsTab = 'palantir' | 'heatmap';

/**
 * StatsIsland — main content island for the /stats page.
 *
 * Provides a sub-navigation hub for stat views:
 *  - "The Palantír" tab: Weekly Insight Orb in always-open mode (no cooldown)
 *  - "Heatmap" tab: placeholder for a future heatmap view
 *
 * The active tab is tracked client-side via a signal.
 * If the URL contains a hash (e.g. #heatmap), it is respected on load.
 */
export function StatsIsland() {
  const initialTab: StatsTab =
    typeof window !== 'undefined' && window.location.hash === '#heatmap'
      ? 'heatmap'
      : 'palantir';

  const activeTab = useSignal<StatsTab>(initialTab);

  function selectTab(tab: StatsTab) {
    activeTab.value = tab;
    // Update hash so the URL is shareable / bookmarkable
    if (typeof window !== 'undefined') {
      window.location.hash = tab === 'palantir' ? '#palantir' : '#heatmap';
    }
  }

  return (
    <div class="stats-page">
      {/* Sub-navigation */}
      <nav class="stats-subnav" aria-label="Stats sections">
        <button
          class={`stats-subnav-tab${activeTab.value === 'palantir' ? ' active' : ''}`}
          onClick={() => selectTab('palantir')}
          aria-current={activeTab.value === 'palantir' ? 'page' : undefined}
        >
          The Palantír
        </button>
        <button
          class={`stats-subnav-tab${activeTab.value === 'heatmap' ? ' active' : ''}`}
          onClick={() => selectTab('heatmap')}
          aria-current={activeTab.value === 'heatmap' ? 'page' : undefined}
          disabled
        >
          Heatmap
          <span class="stats-subnav-coming-soon">Coming soon</span>
        </button>
      </nav>

      {/* Tab panels */}
      <div class="stats-panel">
        {activeTab.value === 'palantir' && (
          <PalantirInsightModal alwaysOpen />
        )}
        {activeTab.value === 'heatmap' && (
          <div class="stats-coming-soon">
            <p>The Heatmap is being forged in the fires of Mount Doom…</p>
          </div>
        )}
      </div>
    </div>
  );
}
