import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { Avatar } from '../components/Avatar';

interface Friend {
  id: number;
  username: string;
  avatar_id: string | null;
  last_progressed: string | null;
}

interface PendingRequest {
  id: number;
  username: string;
  avatar_id: string | null;
  created_at: string;
}

interface SearchResult {
  id: number;
  username: string;
  avatar_id: string | null;
  friendship_status: string | null;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'No activity yet';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export function FriendsListIsland() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(true);
  const [copied, setCopied] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<number | null>(null);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      const [friendsRes, pendingRes] = await Promise.all([
        fetch('/api/friends', { headers }),
        fetch('/api/friends/pending', { headers }),
      ]);

      if (!friendsRes.ok) {
        if (friendsRes.status === 401) { window.location.href = '/login'; return; }
        throw new Error('Failed to load friends');
      }
      if (!pendingRes.ok) throw new Error('Failed to load pending requests');

      const friendsData = await friendsRes.json() as { friends: Friend[]; friend_code: string | null };
      const pendingData = await pendingRes.json() as { pending: PendingRequest[]; count: number };

      setFriends(friendsData.friends ?? []);
      setFriendCode(friendsData.friend_code ?? null);
      setPending(pendingData.pending ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim().length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery.trim())}`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json() as { results: SearchResult[] };
          setSearchResults(data.results ?? []);
        }
      } catch {
        // Silently ignore search errors
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const handleAccept = async (friendshipId: number) => {
    setActioningId(friendshipId);
    try {
      const res = await fetch(`/api/friends/${friendshipId}/accept`, { method: 'POST', headers: getAuthHeaders() });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        throw new Error(data.error || 'Failed to accept');
      }
      setSuccessMsg('Friend request accepted!');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept request');
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (friendshipId: number) => {
    setActioningId(friendshipId);
    try {
      const res = await fetch(`/api/friends/${friendshipId}/reject`, { method: 'POST', headers: getAuthHeaders() });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        throw new Error(data.error || 'Failed to reject');
      }
      setPending(prev => prev.filter(p => p.id !== friendshipId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setActioningId(null);
    }
  };

  const handleSendRequest = async (userId: number) => {
    setSendingRequest(userId);
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        throw new Error(data.error || 'Failed to send request');
      }
      // Update search result to show pending status
      setSearchResults(prev => prev.map(r => r.id === userId ? { ...r, friendship_status: 'pending' } : r));
      setSuccessMsg('Friend request sent!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setSendingRequest(null);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/friends/add/${friendCode ?? ''}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/friends/add/${friendCode ?? ''}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Add me as a friend on Walk to Mordor!',
          text: 'Join me on my journey to Mordor!',
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  const handleFriendClick = (userId: number) => {
    window.location.href = `/friends/${userId}`;
  };

  if (loading) {
    return (
      <div className="party-page">
        <div className="party-loading">
          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading friends…
        </div>
      </div>
    );
  }

  if (error && !friends.length && !pending.length) {
    return (
      <div className="party-page">
        <div className="party-error">
          <p>{error}</p>
          <button className="party-btn party-btn--primary" onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="party-page">
      {successMsg && (
        <div className="party-toast party-toast--success" role="status">
          {successMsg}
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: '0.5rem', cursor: 'pointer' }}
            onClick={() => setSuccessMsg(null)}
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {error && (
        <div className="party-toast party-toast--error" role="alert">
          {error}
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: '0.5rem', cursor: 'pointer' }}
            onClick={() => setError(null)}
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div className="friend-pending-section">
          <button
            type="button"
            className={`friend-pending-toggle${showPending ? ' friend-pending-toggle--open' : ''}`}
            onClick={() => setShowPending(!showPending)}
            aria-expanded={showPending}
          >
            <i className="fas fa-chevron-right" aria-hidden="true"></i>
            Pending Requests
            <span className="friend-pending-badge">{pending.length}</span>
          </button>
          {showPending && (
            <div className="party-card">
              {pending.map(req => (
                <div key={req.id} className="friend-pending-item">
                  <Avatar username={req.username} avatarId={req.avatar_id} size={32} />
                  <div className="friend-list-item__info">
                    <div className="friend-list-item__name">{req.username}</div>
                  </div>
                  <div className="friend-pending-actions">
                    <button
                      className="party-btn party-btn--primary party-btn--small"
                      onClick={() => handleAccept(req.id)}
                      disabled={actioningId === req.id}
                    >
                      {actioningId === req.id ? <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> : 'Accept'}
                    </button>
                    <button
                      className="party-btn party-btn--danger party-btn--small"
                      onClick={() => handleReject(req.id)}
                      disabled={actioningId === req.id}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="party-card">
        <h3>Find Friends</h3>
        <div className="friend-search-wrap">
          <i className="fas fa-search friend-search-icon" aria-hidden="true"></i>
          <input
            type="text"
            placeholder="Search by username (min 3 chars)…"
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            aria-label="Search friends by username"
          />
        </div>
        {searching && (
          <div style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-muted)' }}>
            <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Searching…
          </div>
        )}
        {searchQuery.trim().length >= 3 && !searching && searchResults.length === 0 && (
          <div style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No users found
          </div>
        )}
        {searchResults.map(user => (
          <div key={user.id} className="friend-list-item" style={{ cursor: 'default' }}>
            <Avatar username={user.username} avatarId={user.avatar_id} size={32} />
            <div className="friend-list-item__info">
              <div className="friend-list-item__name">{user.username}</div>
            </div>
            {user.friendship_status === 'accepted' ? (
              <span className="friend-status-badge friend-status-badge--friends">Friends ✓</span>
            ) : user.friendship_status === 'pending' ? (
              <span className="friend-status-badge friend-status-badge--pending">Pending</span>
            ) : (
              <button
                className="party-btn party-btn--primary party-btn--small"
                onClick={() => handleSendRequest(user.id)}
                disabled={sendingRequest === user.id}
              >
                {sendingRequest === user.id ? <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> : (
                  <><i className="fas fa-user-plus" aria-hidden="true"></i> Add</>
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Friends List */}
      <h2 style={{ marginTop: '1rem' }}>Your Friends</h2>
      {friends.length === 0 ? (
        <div className="party-empty">
          <i className="fas fa-user-friends" aria-hidden="true"></i>
          No friends yet — search above or share your link below!
        </div>
      ) : (
        <div className="party-card">
          {friends.map(friend => (
            <div
              key={friend.id}
              className="friend-list-item"
              role="link"
              tabIndex={0}
              onClick={() => handleFriendClick(friend.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFriendClick(friend.id); } }}
              aria-label={`View ${friend.username}'s profile`}
            >
              <Avatar username={friend.username} avatarId={friend.avatar_id} size={32} />
              <div className="friend-list-item__info">
                <div className="friend-list-item__name">{friend.username}</div>
                <div className="friend-list-item__meta">Last progressed: {relativeTime(friend.last_progressed)}</div>
              </div>
              <i className="fas fa-chevron-right friend-list-item__chevron" aria-hidden="true"></i>
            </div>
          ))}
        </div>
      )}

      {/* Share Friend Link */}
      {friendCode && (
        <div className="party-card friend-share-section">
          <h3>Share Your Friend Link</h3>
          <div className="friend-share-url" aria-label="Friend link URL">
            {window.location.origin}/friends/add/{friendCode}
          </div>
          <div className="party-invite__actions">
            <button className="party-btn party-btn--primary party-btn--small" onClick={handleCopyLink}>
              <i className="fas fa-copy" aria-hidden="true"></i>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button className="party-btn party-btn--secondary party-btn--small" onClick={handleShare}>
              <i className="fas fa-share-alt" aria-hidden="true"></i>
              Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
