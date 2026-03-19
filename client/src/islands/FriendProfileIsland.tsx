import { useState, useEffect, useCallback } from 'preact/hooks';
import { Avatar } from '../components/Avatar';
import { getAuthHeaders } from '../utils/auth';

interface FriendProfile {
  username: string;
  avatar_id: string | null;
  total_distance: number;
  member_since: string;
  current_goal_title: string;
  friendship_id: number;
  fellowships: Array<{
    id: number;
    name: string;
    is_shared: boolean;
  }>;
}

function getUserIdFromUrl(): number {
  const match = window.location.pathname.match(/^\/friends\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

export function FriendProfileIsland() {
  const userId = getUserIdFromUrl();
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!userId) { setError('Invalid user ID'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/friends/${userId}/profile`, { headers: getAuthHeaders() });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (res.status === 404) {
        setError('User not found or not a friend');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json() as FriendProfile;
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleRemove = async () => {
    if (!profile) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/friends/${profile.friendship_id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        throw new Error(data.error || 'Failed to remove friend');
      }
      window.location.href = '/friends';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove friend');
      setShowRemoveConfirm(false);
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="party-page">
        <div className="party-loading">
          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading profile…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="party-page">
        <nav className="party-breadcrumb" aria-label="Breadcrumb">
          <a href="/friends">← Friends</a>
        </nav>
        <div className="party-error">
          <p>{error}</p>
          <button className="party-btn party-btn--primary" onClick={fetchProfile}>Retry</button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="party-page">
      {/* Breadcrumb */}
      <nav className="party-breadcrumb" aria-label="Breadcrumb">
        <a href="/friends">← Friends</a>
        <span className="separator">/</span>
        <span className="current">{profile.username}</span>
      </nav>

      {/* Profile Header */}
      <div className="party-card friend-profile-header">
        <Avatar username={profile.username} avatarId={profile.avatar_id} size={128} />
        <h2 className="friend-profile-username">{profile.username}</h2>

        <div className="friend-profile-stats">
          <div className="friend-profile-stat">
            <span className="friend-profile-stat__value">{profile.total_distance.toFixed(2)} km</span>
            <span className="friend-profile-stat__label">Total Distance</span>
          </div>
          <div className="friend-profile-stat">
            <span className="friend-profile-stat__value">
              {new Date(profile.member_since).toLocaleDateString()}
            </span>
            <span className="friend-profile-stat__label">Member Since</span>
          </div>
        </div>

        {profile.current_goal_title && (
          <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <i className="fas fa-map-marker-alt" aria-hidden="true" style={{ color: 'var(--accent-gold)' }}></i>
            {' '}Heading to: <strong style={{ color: 'var(--text-primary)' }}>{profile.current_goal_title}</strong>
          </div>
        )}
      </div>

      {/* Fellowships */}
      {profile.fellowships.length > 0 && (
        <div className="party-card">
          <h3>Fellowships</h3>
          {profile.fellowships.map(f => (
            <div key={f.id} className="friend-fellowship-item">
              <span className="friend-fellowship-item__name">{f.name}</span>
              {f.is_shared && (
                <span className="friend-fellowship-shared">✦ Shared</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Remove Friend */}
      <div style={{ marginTop: '1rem' }}>
        <button className="party-btn party-btn--danger party-btn--full" onClick={() => setShowRemoveConfirm(true)}>
          <i className="fas fa-user-minus" aria-hidden="true"></i> Remove Friend
        </button>
      </div>

      {/* Remove Confirmation Dialog */}
      {showRemoveConfirm && (
        <div className="party-confirm-overlay" onClick={() => setShowRemoveConfirm(false)}>
          <div className="party-confirm-dialog" role="dialog" aria-label="Remove Friend" onClick={(e) => e.stopPropagation()}>
            <h3>Remove Friend?</h3>
            <p>
              Are you sure you want to remove <strong>{profile.username}</strong> from your friends list?
            </p>
            <div className="party-confirm-actions">
              <button className="party-btn party-btn--secondary" onClick={() => setShowRemoveConfirm(false)} disabled={removing}>Cancel</button>
              <button className="party-btn party-btn--danger" onClick={handleRemove} disabled={removing}>
                {removing ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Removing…</> : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
