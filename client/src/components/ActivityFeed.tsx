/**
 * ActivityFeed – Displays recent party activity with auto-refresh.
 * Highlights current user's entries and formats dates relatively.
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';

interface ActivityItem {
  user_id: number;
  display_name: string;
  distance: number;
  date: string;
  logged_at: string;
}

interface ActivityFeedProps {
  partyId: number;
  currentUserId: number;
}

interface FeedState {
  activities: ActivityItem[];
  loading: boolean;
  error: string | null;
  forbidden: boolean;
}

const REFRESH_INTERVAL_MS = 60_000;
const MAX_ITEMS = 10;

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return 'Unknown date';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === yesterday.getTime()) return 'Yesterday';

  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();

  if (date.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${date.getFullYear()}`;
}

function isValidActivity(item: unknown): item is ActivityItem {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.user_id === 'number' &&
    typeof obj.display_name === 'string' &&
    typeof obj.distance === 'number' &&
    typeof obj.date === 'string' &&
    typeof obj.logged_at === 'string'
  );
}

export function ActivityFeed({ partyId, currentUserId }: ActivityFeedProps) {
  const [state, setState] = useState<FeedState>({
    activities: [],
    loading: true,
    error: null,
    forbidden: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      const token = localStorage.getItem('sessionToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`/api/party/${partyId}/activity`, {
        headers,
      });

      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (res.status === 403) {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setState({ activities: [], loading: false, error: null, forbidden: true });
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to load activity (${res.status})`);
      }

      const data = (await res.json()) as { activities: unknown[] };
      const valid = Array.isArray(data.activities)
        ? (data.activities.filter(isValidActivity) as ActivityItem[])
        : [];
      setState({
        activities: valid.slice(0, MAX_ITEMS),
        loading: false,
        error: null,
        forbidden: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setState((prev) => ({ ...prev, loading: false, error: message, forbidden: false }));
    }
  }, [partyId]);

  useEffect(() => {
    void fetchActivities();

    const startInterval = () => {
      intervalRef.current = setInterval(() => void fetchActivities(), REFRESH_INTERVAL_MS);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchActivities();
        if (intervalRef.current === null) {
          startInterval();
        }
      } else if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    startInterval();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchActivities]);

  if (state.loading) {
    return (
      <div className="party-activity-feed party-activity-feed--loading">
        <i className="fas fa-spinner fa-spin" aria-hidden="true" />
        <span>Loading activity…</span>
      </div>
    );
  }

  if (state.forbidden) {
    return (
      <div className="party-activity-feed party-activity-feed--error">
        <i className="fas fa-lock" aria-hidden="true" />
        <span>You no longer have access to this feed</span>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="party-activity-feed party-activity-feed--error">
        <i className="fas fa-exclamation-triangle" aria-hidden="true" />
        <span>{state.error}</span>
        <button
          className="party-btn party-btn--small"
          onClick={() => {
            setState((prev) => ({ ...prev, loading: true, error: null }));
            void fetchActivities();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.activities.length === 0) {
    return (
      <div className="party-activity-feed party-activity-feed--empty">
        <i className="fas fa-stream" aria-hidden="true" />
        <span>No recent activity</span>
      </div>
    );
  }

  return (
    <ul className="party-activity-feed" aria-label="Recent activity">
      {state.activities.map((item, index) => {
        const isOwn = item.user_id === currentUserId;
        const className = `party-activity-item${isOwn ? ' party-activity-item--own' : ''}`;
        const label = isOwn ? 'You' : item.display_name;
        const dateLabel = formatRelativeDate(item.date);

        return (
          <li key={`${item.logged_at}-${item.user_id}-${index}`} className={className}>
            <span className="party-activity-item__text">
              {label} walked {item.distance.toFixed(2)} km on {dateLabel}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
