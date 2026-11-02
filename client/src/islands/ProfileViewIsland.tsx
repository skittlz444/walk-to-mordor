import { useCallback, useEffect, useState } from 'preact/hooks';
import { Avatar } from '../components/Avatar';
import { AvatarPickerModal } from '../components/AvatarPickerModal';
import { getAuthHeaders } from '../utils/auth';
import type { ActiveStoryline } from '../types/session';

export interface ProfileOverview {
  username: string;
  avatarId: string | null;
  totalDistance: number;
  memberSince: string;
  currentGoalTitle: string | null;
  activeStoryline: ActiveStoryline | null;
  fellowships: Array<{ id: number; name: string }>;
}

function formatMemberSince(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Read-only profile view. The SSR renderer owns the `.party-page` wrapper so
 * the badge island that follows shares its width; this island renders its
 * hero, Settings CTA, and Fellowships content only.
 */
export function ProfileViewIsland() {
  const [overview, setOverview] = useState<ProfileOverview | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profile/overview', { headers: getAuthHeaders() });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const data = await response.json() as ProfileOverview;
      setOverview(data);
      setAvatarId(data.avatarId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  if (loading) {
    return (
      <div className="party-card friend-profile-header" aria-busy="true">
        <div className="profile-view-skeleton" aria-hidden="true">
          <span className="profile-view-skeleton-avatar" />
          <span className="profile-view-skeleton-text profile-view-skeleton-text--name" />
          <div className="friend-profile-stats">
            <span className="profile-view-skeleton-stat" />
            <span className="profile-view-skeleton-stat" />
          </div>
          <span className="profile-view-skeleton-text" />
        </div>
        <span className="profile-view-skeleton-status" role="status">Loading profile…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="party-card">
        <div className="party-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="party-btn party-btn--primary"
            onClick={() => { void fetchOverview(); }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  const activeStoryline = overview.activeStoryline;

  return (
    <>
      <div className="party-card friend-profile-header">
        <button
          type="button"
          className="profile-view-avatar-trigger"
          aria-label={`Change avatar for ${overview.username}`}
          aria-haspopup="dialog"
          onClick={() => setPickerOpen(true)}
        >
          <Avatar username={overview.username} avatarId={avatarId} size={128} />
          <span className="profile-view-avatar-edit" aria-hidden="true">
            <i className="fas fa-camera"></i>
          </span>
        </button>

        <h2 className="friend-profile-username">{overview.username}</h2>

        <div className="friend-profile-stats">
          <div className="friend-profile-stat">
            <span className="friend-profile-stat__value">
              {overview.totalDistance.toFixed(2)} km
            </span>
            <span className="friend-profile-stat__label">Total Distance</span>
          </div>
          <div className="friend-profile-stat">
            <span className="friend-profile-stat__value">
              {formatMemberSince(overview.memberSince)}
            </span>
            <span className="friend-profile-stat__label">Member Since</span>
          </div>
        </div>

        {overview.currentGoalTitle && (
          <div className="profile-view-heading">
            <i className="fas fa-map-marker-alt" aria-hidden="true"></i>{' '}
            Heading to: <strong>{overview.currentGoalTitle}</strong>
          </div>
        )}

        {activeStoryline && (
          <div className="profile-view-chip">
            <i className="fas fa-route" aria-hidden="true"></i>
            Journey: {activeStoryline.title}
          </div>
        )}
      </div>

      <div className="profile-view-cta">
        <a className="party-btn party-btn--gold party-btn--full" href="/profile/settings">
          <i className="fas fa-gear" aria-hidden="true"></i> Edit Profile &amp; Settings
        </a>
      </div>

      {overview.fellowships.length > 0 && (
        <div className="party-card">
          <h3>Fellowships</h3>
          {overview.fellowships.map((fellowship) => (
            <div key={fellowship.id} className="friend-fellowship-item">
              <span className="friend-fellowship-item__name">{fellowship.name}</span>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <AvatarPickerModal
          username={overview.username}
          avatarId={avatarId}
          onChange={setAvatarId}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
