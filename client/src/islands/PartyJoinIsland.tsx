import { useState, useEffect, useCallback } from 'preact/hooks';
import { isAuthenticated as appIsAuthenticated, initializeAppStore, initialized } from '../stores/appStore';
import { getAuthHeaders } from '../utils/auth';

interface PreviewData {
  name: string;
  member_count: number;
  distance_mode: string;
  leave_distance_behavior: string;
}

function getInviteCodeFromUrl(): string {
  const match = window.location.pathname.match(/^\/party\/join\/([A-Za-z0-9]{8})$/);
  return match ? match[1] : '';
}

export function PartyJoinIsland() {
  const inviteCode = getInviteCodeFromUrl();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const isAuthenticated = appIsAuthenticated.value || initialized.value && appIsAuthenticated.value;

  const fetchPreview = useCallback(async () => {
    if (!inviteCode) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/party/join/${encodeURIComponent(inviteCode)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid invite code');
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setLoading(false);
    }
  }, [inviteCode]);

  useEffect(() => {
    initializeAppStore();
    fetchPreview();
  }, [fetchPreview]);

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/party/join/${encodeURIComponent(inviteCode)}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join fellowship');
      // Redirect to the party detail page
      window.location.href = `/party/${data.party_id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join fellowship');
      setJoining(false);
    }
  };

  const handleLogin = () => {
    const returnTo = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?returnTo=${returnTo}`;
  };

  if (loading) {
    return (
      <div className="party-page">
        <div className="party-loading">
          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading fellowship preview…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="party-page">
        <div className="party-error">
          <p>{error}</p>
          <a href="/party" className="party-btn party-btn--primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '0.5rem' }}>
            Go to Fellowships
          </a>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="party-page">
      <div className="party-card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
        <div className="party-join-preview">
          <div className="party-join-preview__name">{preview.name}</div>
          <div className="party-join-preview__detail">
            {preview.member_count} {preview.member_count === 1 ? 'member' : 'members'}
          </div>
          <div className="party-join-preview__detail">
            {preview.distance_mode === 'cumulative'
              ? '🏃 Everyone\'s distance adds together'
              : '📊 Progress is averaged across members'}
          </div>
          <div className="party-join-preview__detail">
            {preview.leave_distance_behavior === 'keep'
              ? '✅ Distance stays if someone leaves'
              : '↩️ Distance removed if someone leaves'}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          {isAuthenticated ? (
            <button
              className="party-btn party-btn--gold party-btn--full"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining
                ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Joining…</>
                : <><i className="fas fa-users" aria-hidden="true"></i> Join Fellowship</>
              }
            </button>
          ) : (
            <button
              className="party-btn party-btn--primary party-btn--full"
              onClick={handleLogin}
            >
              <i className="fas fa-sign-in-alt" aria-hidden="true"></i> Log in to Join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
