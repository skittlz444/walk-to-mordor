import { useState, useEffect, useCallback } from 'preact/hooks';
import { Avatar } from '../components/Avatar';
import { isAuthenticated as appIsAuthenticated } from '../stores/appStore';
import { getAuthHeaders } from '../utils/auth';

interface ResolveData {
  id: number;
  username: string;
  avatar_id: string | null;
}

function getFriendCodeFromUrl(): string {
  const match = window.location.pathname.match(/^\/friends\/add\/([A-Za-z0-9]{8})$/);
  return match ? match[1] : '';
}

export function FriendAddIsland() {
  const friendCode = getFriendCodeFromUrl();
  const [preview, setPreview] = useState<ResolveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchPreview= useCallback(async () => {
    if (!friendCode) {
      setError('Invalid friend link');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Resolve endpoint is public — no auth required for preview
      const res = await fetch(`/api/friends/resolve/${encodeURIComponent(friendCode)}`);
      const data = await res.json() as ResolveData & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Invalid friend code');
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid friend code');
    } finally {
      setLoading(false);
    }
  }, [friendCode]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const handleSendRequest = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/friends/request/code', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ friend_code: friendCode }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        // Handle specific error states
        if (data.error?.includes('Already friends')) {
          setError('You are already friends with this user');
        } else if (data.error?.includes('pending')) {
          setError('A friend request is already pending');
        } else if (data.error?.includes('yourself')) {
          setError('You cannot add yourself as a friend');
        } else {
          throw new Error(data.error || 'Failed to send friend request');
        }
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send friend request');
    } finally {
      setSending(false);
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
          Loading…
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="party-page">
        <div className="party-card friend-add-success">
          <i className="fas fa-check-circle" aria-hidden="true"></i>
          <h3>Friend request sent!</h3>
          <p style={{ color: 'var(--text-secondary)' }}>They'll see your request on their Friends page.</p>
          <a href="/friends" className="party-btn party-btn--primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '1rem' }}>
            <i className="fas fa-arrow-left" aria-hidden="true"></i> Back to Friends
          </a>
        </div>
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div className="party-page">
        <div className="party-error">
          <p>{error}</p>
          <a href="/friends" className="party-btn party-btn--primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '0.5rem' }}>
            Go to Friends
          </a>
        </div>
      </div>
    );
  }

  // Not authenticated and couldn't resolve preview
  if (!appIsAuthenticated.value && !preview) {
    return (
      <div className="party-page">
        <div className="party-card friend-add-preview">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👤</div>
          <div className="friend-add-preview__username">You've been invited to connect!</div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Log in to add this person as a friend.</p>
          <div style={{ marginTop: '1.5rem' }}>
            <button className="party-btn party-btn--primary party-btn--full" onClick={handleLogin}>
              <i className="fas fa-sign-in-alt" aria-hidden="true"></i> Log in to Add Friend
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="party-page">
      <div className="party-card friend-add-preview">
        {preview && (
          <>
            <Avatar username={preview.username} avatarId={preview.avatar_id} size={128} />
            <div className="friend-add-preview__username">{preview.username}</div>
          </>
        )}
        {error && (
          <div className="party-toast party-toast--error" role="alert" style={{ marginTop: '1rem' }}>
            {error}
          </div>
        )}
        <div style={{ marginTop: '1.5rem' }}>
          {appIsAuthenticated.value ? (
            <button
              className="party-btn party-btn--gold party-btn--full"
              onClick={handleSendRequest}
              disabled={sending}
            >
              {sending
                ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Sending…</>
                : <><i className="fas fa-user-plus" aria-hidden="true"></i> Send Friend Request</>
              }
            </button>
          ) : (
            <button className="party-btn party-btn--primary party-btn--full" onClick={handleLogin}>
              <i className="fas fa-sign-in-alt" aria-hidden="true"></i> Log in to Add Friend
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
