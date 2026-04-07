import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { markPalantirViewed } from '../stores/appStore';
import { fetchPalantirWeeklyStats, type WeeklyStatsData } from '../utils/palantir';

// ── Props ──────────────────────────────────────────────────────────────────

export interface PalantirInsightModalProps {
  /**
   * Called when the user dismisses the popup.
   * The component will also call markPalantirViewed() automatically.
   * Not needed in alwaysOpen mode.
   */
  onDismiss?: () => void;
  /**
   * When true (used on /stats page), renders the modal content inline
   * without an overlay and without a dismiss button.
   * No cooldown is applied in this mode.
   */
  alwaysOpen?: boolean;
  /**
   * Optional pre-fetched stats used by popup wrappers so the modal does not
   * perform a second request after the eligibility check.
   */
  initialStats?: WeeklyStatsData | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function paceArrow(trend: 'up' | 'down' | 'same'): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function paceClass(trend: 'up' | 'down' | 'same'): string {
  if (trend === 'up') return 'pace-up';
  if (trend === 'down') return 'pace-down';
  return 'pace-same';
}

// ── Component ──────────────────────────────────────────────────────────────

export function PalantirInsightModal({
  onDismiss,
  alwaysOpen = false,
  initialStats = null,
}: PalantirInsightModalProps) {
  const stats = useSignal<WeeklyStatsData | null>(null);
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Fetch weekly stats on mount
  useEffect(() => {
    if (initialStats) {
      stats.value = initialStats;
      loading.value = false;
      error.value = null;
      return;
    }

    let cancelled = false;
    loading.value = true;
    error.value = null;

    fetchPalantirWeeklyStats()
      .then((data) => {
        if (cancelled) return;
        stats.value = data;
        loading.value = false;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        error.value = err instanceof Error && err.message === 'Not authenticated'
          ? 'Not authenticated'
          : 'The Palantír clouds over… try again later.';
        loading.value = false;
      });

    return () => {
      cancelled = true;
    };
  }, [initialStats]);

  // Handle Escape key and initial focus (only in modal/popup mode)
  useEffect(() => {
    if (alwaysOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    document.addEventListener('keydown', handleKeyDown);

    // Focus the dialog on mount
    dialogRef.current?.focus();

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [alwaysOpen]);

  function handleDismiss() {
    if (!alwaysOpen && stats.value?.has_activity) {
      markPalantirViewed();
    }
    onDismiss?.();
  }

  function handleOverlayClick(e: Event) {
    if ((e.target as HTMLElement).classList.contains('palantir-overlay')) {
      handleDismiss();
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const orbSection = (
    <div class="palantir-orb-section">
      <div class="palantir-orb" role="img" aria-label="Palantír orb" />
      <div class="palantir-pedestal" />
      <div class="palantir-pedestal-base" />
      <p class="palantir-title">The Palantír</p>
      <p class="palantir-subtitle">Weekly Insight Orb</p>
    </div>
  );

  const body = (() => {
    if (loading.value) {
      return <p class="palantir-loading">The orb stirs… divining your path…</p>;
    }
    if (error.value) {
      return <p class="palantir-error">{error.value}</p>;
    }
    if (!stats.value || !stats.value.has_activity) {
      return (
        <p class="palantir-no-walks">
          The Palantír sees no journeys in recent days… Lace up your boots, traveller.
        </p>
      );
    }

    const data = stats.value;

    if (data.no_walks_this_week) {
      return (
        <>
          <div class="palantir-divider" />
          <div class="palantir-stats">
            <p class="palantir-no-walks" style="padding:0; text-align:left;">
              The Palantír sees no movement this week… perhaps tomorrow?
            </p>
            {data.prev_week_km !== undefined && data.prev_week_km > 0 && (
              <div class="palantir-stat-row">
                <span class="palantir-stat-label">Previous week</span>
                <span class="palantir-stat-value">{data.prev_week_km.toFixed(1)} km</span>
              </div>
            )}
          </div>
        </>
      );
    }

    const trend = data.pace_trend ?? 'same';
    const pct = data.pace_change_pct;
    const isFirstActiveWeek = trend === 'up'
      && (data.prev_week_km ?? 0) === 0
      && (data.this_week_km ?? 0) > 0
      && pct === null;
    const trendLabel =
      trend === 'same'
        ? `${paceArrow(trend)} Same pace`
        : isFirstActiveWeek
          ? `${paceArrow(trend)} First active week`
          : `${paceArrow(trend)} ${Math.abs(pct ?? 0)}% vs last week`;

    return (
      <>
        <div class="palantir-divider" />
        <div class="palantir-stats">
          {/* This week distance */}
          <div class="palantir-stat-row">
            <span class="palantir-stat-label">This week</span>
            <span class="palantir-stat-value">{(data.this_week_km ?? 0).toFixed(1)} km</span>
          </div>

          {/* Pace trend */}
          <div class="palantir-stat-row">
            <span class="palantir-stat-label">Pace</span>
            <span class={`palantir-stat-value ${paceClass(trend)}`}>{trendLabel}</span>
          </div>

          {/* Projection */}
          {data.projection && (
            <>
              <div class="palantir-divider" />
              <div class="palantir-projection">
                {data.projection.km_to_next !== undefined
                  ? <><strong>{data.projection.km_to_next} km</strong> to <strong>{data.projection.title}</strong> — at this pace, ~{data.projection.days_away} day{data.projection.days_away !== 1 ? 's' : ''} away.</>
                  : <>At this pace, you'll reach <strong>{data.projection.title}</strong> in ~{data.projection.days_away} day{data.projection.days_away !== 1 ? 's' : ''}.</>}
              </div>
            </>
          )}

          {/* Fellowship contributions */}
          {data.fellowships && data.fellowships.length > 0 && (
            <>
              <div class="palantir-divider" />
              <div class="palantir-stat-label" style="margin-bottom: 0.25rem;">
                Fellowship contributions this week
              </div>
              <div class="palantir-fellowships">
                {data.fellowships.map((f) => (
                  <div class="palantir-fellowship-item" key={f.party_id}>
                    <span class="palantir-fellowship-name">{f.party_name}</span>
                    <span class="palantir-fellowship-pct">{f.contribution_pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </>
    );
  })();

  const content = (
    <div
      class="palantir-dialog"
      ref={dialogRef}
      role="dialog"
      aria-modal={alwaysOpen ? 'false' : 'true'}
      aria-label="The Palantír — Weekly Insight"
      tabIndex={-1}
    >
      {orbSection}
      {body}
      {!alwaysOpen && (
        <div class="palantir-footer">
          <button class="palantir-dismiss-btn" onClick={handleDismiss}>
            Cast the Palantír aside
          </button>
        </div>
      )}
    </div>
  );

  if (alwaysOpen) {
    return <div class="palantir-inline">{content}</div>;
  }

  return (
    <div class="palantir-overlay" onClick={handleOverlayClick}>
      {content}
    </div>
  );
}
