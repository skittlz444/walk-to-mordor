/**
 * ActivityFeed – Displays recent party activity with auto-refresh.
 * Shows walk logs and messages in a unified feed with filtering and message input.
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { getMemberColor, PALETTE_SIZE } from '../utils/party-colors';

type ActivityType = 'walk' | 'message';
type FilterType = 'all' | 'walk' | 'message';

/** Raw activity item from API (may be legacy format without type) */
interface RawActivityItem {
  type?: ActivityType;
  user_id: number;
  display_name: string;
  avatar_id?: string | null;
  created_at?: string;
  distance?: number | null;
  date?: string | null;
  content?: string | null;
  message_id?: number | null;
  logged_at?: string;
}

/** Validated/normalized activity item */
interface ActivityItem {
  type: ActivityType;
  user_id: number;
  display_name: string;
  avatar_id?: string | null;
  created_at: string;
  distance?: number | null;
  date?: string | null;
  content?: string | null;
  message_id?: number | null;
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
const MAX_ITEMS = 20;
const MAX_MESSAGE_LENGTH = 200;

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

function formatRelativeTime(isoStr: string): string {
  // Handle D1/SQLite format (YYYY-MM-DD HH:MM:SS) by normalizing to ISO-8601
  let normalized = isoStr;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(isoStr)) {
    normalized = isoStr.replace(' ', 'T') + 'Z';
  }
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  if (date.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${date.getFullYear()}`;
}

function isValidActivity(item: unknown): item is RawActivityItem {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;

  // Must have basic fields
  if (typeof obj.user_id !== 'number' || typeof obj.display_name !== 'string') return false;

  // Unified format (has type field)
  if (typeof obj.type === 'string') {
    if (obj.type === 'walk') {
      return typeof obj.distance === 'number' && typeof obj.date === 'string';
    }
    if (obj.type === 'message') {
      return typeof obj.content === 'string';
    }
    return false;
  }

  // Legacy format (walk-only, no type field)
  if (typeof obj.distance === 'number' && typeof obj.date === 'string') {
    return true;
  }

  return false;
}

function normalizeActivity(item: RawActivityItem): ActivityItem {
  const created_at = item.created_at ?? item.logged_at ?? '';
  if (item.type) {
    return { ...item, type: item.type, created_at };
  }
  // Legacy format: treat as walk
  return { ...item, type: 'walk', created_at };
}

export function ActivityFeed({ partyId, currentUserId }: ActivityFeedProps) {
  const [state, setState] = useState<FeedState>({
    activities: [],
    loading: true,
    error: null,
    forbidden: false,
  });
  const [filter, setFilter] = useState<FilterType>('all');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const filterRef = useRef<FilterType>(filter);

  // Keep ref in sync so fetchActivities always uses current filter
  useEffect(() => { filterRef.current = filter; }, [filter]);

  const fetchActivities = useCallback(async () => {
    try {
      const token = localStorage.getItem('sessionToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const typeParam = filterRef.current !== 'all' ? `?type=${filterRef.current}` : '';
      const res = await fetch(`/api/party/${partyId}/activity${typeParam}`, {
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
        ? data.activities.filter(isValidActivity).map(normalizeActivity)
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

  // Re-fetch when filter changes
  useEffect(() => {
    void fetchActivities();
  }, [filter, fetchActivities]);

  const handleSendMessage = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH || sending) return;

    setSending(true);
    setSendError(null);

    try {
      const token = localStorage.getItem('sessionToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`/api/party/${partyId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? `Failed to send message (${res.status})`);
      }

      setMessageText('');
      // Refresh the feed to show the new message
      void fetchActivities();
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

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

  const charCount = messageText.trim().length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;

  return (
    <div className="party-activity-container">
      {/* Message Input */}
      <div className="party-message-form">
        <textarea
          className="party-message-input"
          placeholder="Send a message to your fellowship…"
          value={messageText}
          onInput={(e) => setMessageText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={2}
          disabled={sending}
          aria-label="Fellowship message"
        />
        <div className="party-message-form__footer">
          <span className={`party-message-char-count${isOverLimit ? ' party-message-char-count--over' : ''}`}>
            {charCount}/{MAX_MESSAGE_LENGTH}
          </span>
          <button
            className="party-btn party-btn--primary party-btn--small"
            onClick={() => void handleSendMessage()}
            disabled={sending || charCount === 0 || isOverLimit}
          >
            {sending ? <i className="fas fa-spinner fa-spin" aria-hidden="true" /> : <i className="fas fa-paper-plane" aria-hidden="true" />}
            {' '}Send
          </button>
        </div>
        {sendError && (
          <div className="party-message-error">{sendError}</div>
        )}
      </div>

      {/* Filter */}
      <div className="party-activity-filter">
        <label htmlFor="activity-filter" className="party-activity-filter__label">
          <i className="fas fa-filter" aria-hidden="true" /> Filter:
        </label>
        <select
          id="activity-filter"
          className="party-activity-filter__select"
          value={filter}
          onChange={(e) => setFilter((e.target as HTMLSelectElement).value as FilterType)}
        >
          <option value="all">All Activity</option>
          <option value="walk">Walks Only</option>
          <option value="message">Messages Only</option>
        </select>
      </div>

      {/* Feed Items */}
      {state.activities.length === 0 ? (
        <div className="party-activity-feed party-activity-feed--empty">
          <i className="fas fa-stream" aria-hidden="true" />
          <span>No recent activity</span>
        </div>
      ) : (
        <ul className="party-activity-feed" aria-label="Recent activity">
          {state.activities.map((item, index) => {
            const isOwn = item.user_id === currentUserId;
            const isMessage = item.type === 'message';
            const itemClass = [
              'party-activity-item',
              isOwn ? 'party-activity-item--own' : '',
              isMessage ? 'party-activity-item--message' : '',
            ].filter(Boolean).join(' ');
            const label = isOwn ? 'You' : item.display_name;
            const key = isMessage
              ? `msg-${item.message_id ?? index}`
              : `walk-${item.created_at}-${item.user_id}-${index}`;
            const userColor = isMessage ? getMemberColor(item.user_id % PALETTE_SIZE) : undefined;

            return (
              <li key={key} className={itemClass} style={userColor ? { borderLeftColor: userColor } : undefined}>
                {isMessage ? (
                  <div className="party-activity-item__message">
                    <span className="party-activity-item__message-header">
                      <strong>{label}</strong>
                      <span className="party-activity-item__time">{formatRelativeTime(item.created_at)}</span>
                    </span>
                    <span className="party-activity-item__message-content">{item.content}</span>
                  </div>
                ) : (() => {
                  const dateLabel = formatRelativeDate(item.date ?? '');
                  const isRelative = dateLabel === 'Today' || dateLabel === 'Yesterday';
                  return (
                    <span className="party-activity-item__text">
                      {label} walked {(item.distance ?? 0).toFixed(2)} km{' '}
                      {isRelative ? dateLabel : `on ${dateLabel}`}
                    </span>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
