import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

interface MetricsSummary {
  totalGroupDistanceKm: number;
  activeWalkers: number;
  milestonesUnlocked: number;
}

interface LeaderboardRow {
  id: number;
  username: string;
  email: string;
  distance_km: number;
}

interface LeaderboardResponse {
  rows: LeaderboardRow[];
  start: string | null;
  end: string | null;
  maxDistanceKm: number;
}

interface TimelinePoint {
  date: string;
  distance_km: number;
}

interface TimelineResponse {
  points: TimelinePoint[];
  maxDistanceKm: number;
}

type RangeKey = 'all' | '7' | '30' | 'custom';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function getTodayOffset(daysAgo: number): string {
  const now = new Date();
  const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  utcDate.setUTCDate(utcDate.getUTCDate() - daysAgo);
  return utcDate.toISOString().slice(0, 10);
}

function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`;
}

export function AdminMetricsIsland() {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('all');
  const [customStart, setCustomStart] = useState(getTodayOffset(29));
  const [customEnd, setCustomEnd] = useState(getTodayOffset(0));

  const handleAuthResponse = useCallback((status: number) => {
    if (status === 401) {
      window.location.href = '/login';
      return true;
    }
    if (status === 403) {
      window.location.href = '/journey';
      return true;
    }
    return false;
  }, []);

  const loadStaticMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [summaryResponse, timelineResponse] = await Promise.all([
        fetch('/api/admin/metrics', { headers: getAuthHeaders() }),
        fetch('/api/admin/metrics/timeline', { headers: getAuthHeaders() }),
      ]);

      if (handleAuthResponse(summaryResponse.status) || handleAuthResponse(timelineResponse.status)) {
        return;
      }
      if (!summaryResponse.ok || !timelineResponse.ok) {
        throw new Error('Failed to load metrics');
      }

      const [summaryData, timelineData] = await Promise.all([
        summaryResponse.json() as Promise<MetricsSummary>,
        timelineResponse.json() as Promise<TimelineResponse>,
      ]);

      setSummary(summaryData);
      setTimeline(timelineData);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [handleAuthResponse]);

  const loadLeaderboard = useCallback(async (nextRange: RangeKey, startOverride?: string, endOverride?: string) => {
    setLeaderboardLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (nextRange === '7') {
        params.set('start', getTodayOffset(6));
        params.set('end', getTodayOffset(0));
      } else if (nextRange === '30') {
        params.set('start', getTodayOffset(29));
        params.set('end', getTodayOffset(0));
      } else if (nextRange === 'custom') {
        params.set('start', startOverride ?? customStart);
        params.set('end', endOverride ?? customEnd);
      }

      const url = params.toString()
        ? `/api/admin/metrics/leaderboard?${params.toString()}`
        : '/api/admin/metrics/leaderboard';
      const response = await fetch(url, { headers: getAuthHeaders() });

      if (handleAuthResponse(response.status)) return;
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to load leaderboard' }));
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to load leaderboard');
      }

      setLeaderboard(await response.json());
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load leaderboard');
    } finally {
      setLeaderboardLoading(false);
    }
  }, [customEnd, customStart, handleAuthResponse]);

  useEffect(() => {
    loadStaticMetrics();
    loadLeaderboard('all');
  }, [loadLeaderboard, loadStaticMetrics]);

  const heroCards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: 'Total Group Distance',
        value: `${summary.totalGroupDistanceKm.toLocaleString()} km`,
        icon: 'fas fa-route',
      },
      {
        label: 'Active Walkers (7 days)',
        value: summary.activeWalkers.toLocaleString(),
        icon: 'fas fa-shoe-prints',
      },
      {
        label: 'Milestones Unlocked',
        value: summary.milestonesUnlocked.toLocaleString(),
        icon: 'fas fa-trophy',
      },
    ];
  }, [summary]);

  if (loading && !summary && !timeline) {
    return (
      <section className="admin-metrics">
        <div className="admin-section-heading">
          <div>
            <h2>Fellowship Momentum</h2>
            <p>Loading the community leaderboard and recent activity…</p>
          </div>
        </div>
        <div className="admin-stats-grid">
          {[1, 2, 3].map((card) => (
            <div key={card} className="admin-stat-card admin-stat-card--skeleton">
              <div className="admin-stat-card__icon" aria-hidden="true"></div>
              <div className="admin-stat-card__value">—</div>
              <div className="admin-stat-card__label">Loading</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="admin-metrics">
      <div className="admin-section-heading">
        <div>
          <h2>Fellowship Momentum</h2>
          <p>Celebrate the group’s latest push toward Mordor with friendly, time-based competition.</p>
        </div>
      </div>

      {error ? (
        <div className="admin-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="admin-error__btn"
            onClick={() => {
              loadStaticMetrics();
              loadLeaderboard(range);
            }}
          >
            <i className="fas fa-redo" aria-hidden="true"></i> Retry
          </button>
        </div>
      ) : null}

      <div className="admin-stats-grid">
        {heroCards.map((card) => (
          <div key={card.label} className="admin-stat-card">
            <div className="admin-stat-card__icon admin-stat-card__icon--distance" aria-hidden="true">
              <i className={card.icon}></i>
            </div>
            <div className="admin-stat-card__value">{card.value}</div>
            <div className="admin-stat-card__label">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="admin-metrics-grid">
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Dynamic Leaderboard</h3>
              <p>Everyone stays visible, even during quiet stretches.</p>
            </div>
            <div className="admin-metrics-filters" role="group" aria-label="Leaderboard time range">
              <button type="button" className={`admin-filter-chip ${range === 'all' ? 'admin-filter-chip--active' : ''}`} onClick={() => { setRange('all'); loadLeaderboard('all'); }}>All Time</button>
              <button type="button" className={`admin-filter-chip ${range === '7' ? 'admin-filter-chip--active' : ''}`} onClick={() => { setRange('7'); loadLeaderboard('7'); }}>Last 7 Days</button>
              <button type="button" className={`admin-filter-chip ${range === '30' ? 'admin-filter-chip--active' : ''}`} onClick={() => { setRange('30'); loadLeaderboard('30'); }}>Last 30 Days</button>
              <button type="button" className={`admin-filter-chip ${range === 'custom' ? 'admin-filter-chip--active' : ''}`} onClick={() => setRange('custom')}>Custom</button>
            </div>
          </div>

          {range === 'custom' ? (
            <form
              className="admin-custom-range"
              onSubmit={(event) => {
                event.preventDefault();
                loadLeaderboard('custom', customStart, customEnd);
              }}
            >
              <label>
                Start
                <input type="date" value={customStart} onInput={(event) => setCustomStart((event.target as HTMLInputElement).value)} />
              </label>
              <label>
                End
                <input type="date" value={customEnd} onInput={(event) => setCustomEnd((event.target as HTMLInputElement).value)} />
              </label>
              <button type="submit" className="admin-btn admin-btn-secondary">Apply</button>
            </form>
          ) : null}

          <div className="admin-leaderboard" aria-busy={leaderboardLoading}>
            {leaderboard?.rows.map((row, index) => {
              const denominator = leaderboard.maxDistanceKm > 0 ? leaderboard.maxDistanceKm : 1;
              const width = Math.max((row.distance_km / denominator) * 100, row.distance_km > 0 ? 8 : 0);
              return (
                <div key={row.id} className="admin-leaderboard-row">
                  <div className="admin-leaderboard-row__meta">
                    <strong>{index + 1}. {row.username}</strong>
                    <span>{row.email}</span>
                  </div>
                  <div className="admin-leaderboard-row__bar-wrap">
                    <div className="admin-leaderboard-row__bar" style={{ width: `${width}%` }}></div>
                  </div>
                  <div className="admin-leaderboard-row__value">{formatDistance(row.distance_km)}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <h3>Group Activity Timeline</h3>
              <p>Total kilometers logged by the whole fellowship each day for the last 30 days.</p>
            </div>
          </div>

          <div className="admin-timeline" role="img" aria-label="Group activity over the last 30 days">
            {timeline?.points.map((point) => {
              const maxDistance = timeline.maxDistanceKm > 0 ? timeline.maxDistanceKm : 1;
              const height = point.distance_km > 0 ? Math.max((point.distance_km / maxDistance) * 100, 6) : 4;
              return (
                <div key={point.date} className="admin-timeline__column">
                  <div
                    className="admin-timeline__bar"
                    style={{ height: `${height}%` }}
                    title={`${point.date}: ${formatDistance(point.distance_km)}`}
                  ></div>
                  <span>{point.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
