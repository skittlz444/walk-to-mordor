import { useState, useEffect, useCallback } from 'preact/hooks';
import { getAuthHeaders } from '../utils/auth';

interface Party {
  id: number;
  name: string;
  role: string;
  distance_mode: string;
  leave_distance_behavior: string;
  dissolved_at: string | null;
  active_member_count: number;
}

interface PreviewData {
  name: string;
  member_count: number;
  distance_mode: string;
  leave_distance_behavior: string;
}

interface FellowshipInvite {
  id: number;
  party_id: number;
  party_name: string;
  member_count: number;
  total_distance: number;
  inviter_username: string;
  created_at: string;
}

interface StorylineOption {
  id: number;
  title: string;
  description: string | null;
  adminOnly?: boolean;
}

export function PartyListIsland() {
  const [parties, setParties] = useState<Party[]>([]);
  const [invites, setInvites] = useState<FellowshipInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showDissolved, setShowDissolved] = useState(false);
  const [inviteActionId, setInviteActionId] = useState<number | null>(null);

  // Create form state
  const [createName, setCreateName] = useState('');
  const [storylines, setStorylines] = useState<StorylineOption[]>([]);
  const [selectedStorylineId, setSelectedStorylineId] = useState('');
  const [distanceMode, setDistanceMode] = useState('incremental');
  const [leaveBehavior, setLeaveBehavior] = useState('keep');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join form state
  const [inviteCode, setInviteCode] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchParties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      const [res, invitesRes, storylinesRes] = await Promise.all([
        fetch('/api/user/parties?include_dissolved=true', { headers }),
        fetch('/api/user/fellowship-invites', { headers }),
        fetch('/api/storylines', { headers }),
      ]);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to load fellowships');
      }
      const data = await res.json();
      setParties(data.parties ?? []);

      if (invitesRes.ok) {
        const invitesData = await invitesRes.json() as { invites: FellowshipInvite[]; count: number };
        setInvites(invitesData.invites ?? []);
      }

      if (storylinesRes.ok) {
        const storylinesData = await storylinesRes.json() as { storylines?: StorylineOption[] };
        const options = Array.isArray(storylinesData.storylines) ? storylinesData.storylines : [];
        setStorylines(options);
        setSelectedStorylineId(current => current || (options[0]?.id ? String(options[0].id) : ''));
      } else {
        console.warn('Could not load storylines for party creation:', storylinesRes.status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fellowships');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchParties(); }, [fetchParties]);

  const activeParties = parties.filter(p => p.dissolved_at === null);
  const dissolvedParties = parties.filter(p => p.dissolved_at !== null);

  const handleAcceptInvite = async (inviteId: number) => {
    setInviteActionId(inviteId);
    try {
      const res = await fetch(`/api/user/fellowship-invites/${inviteId}/accept`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        throw new Error(data.error || 'Failed to accept invite');
      }
      setSuccessMsg('Fellowship invite accepted!');
      await fetchParties();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setInviteActionId(null);
    }
  };

  const handleDeclineInvite = async (inviteId: number) => {
    setInviteActionId(inviteId);
    try {
      const res = await fetch(`/api/user/fellowship-invites/${inviteId}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        throw new Error(data.error || 'Failed to decline invite');
      }
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline invite');
    } finally {
      setInviteActionId(null);
    }
  };

  const handleCreate= async (e: Event) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/party', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: createName.trim(),
          distance_mode: distanceMode,
          leave_distance_behavior: leaveBehavior,
          ...(selectedStorylineId ? { storylineId: Number(selectedStorylineId) } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create fellowship');
      setCreateName('');
      setShowCreate(false);
      setSuccessMsg(`Fellowship "${data.name}" created!`);
      await fetchParties();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create fellowship');
    } finally {
      setCreating(false);
    }
  };

  const handlePreview = async () => {
    if (inviteCode.length !== 8) return;
    setPreviewLoading(true);
    setJoinError(null);
    setPreview(null);
    try {
      const res = await fetch(`/api/party/join/${encodeURIComponent(inviteCode)}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid invite code');
      setPreview(data);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch(`/api/party/join/${encodeURIComponent(inviteCode)}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join fellowship');
      setInviteCode('');
      setPreview(null);
      setShowJoin(false);
      setSuccessMsg(`Joined "${data.party_name}"!`);
      await fetchParties();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join fellowship');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="party-page">
        <div className="party-loading">
          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading fellowships…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="party-page">
        <div className="party-error">
          <p>{error}</p>
          <button className="party-btn party-btn--primary" onClick={fetchParties}>Retry</button>
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

      {/* Pending Fellowship Invites */}
      {invites.length > 0 && (
        <>
          <h2>Pending Invites</h2>
          {invites.map(invite => (
            <div key={invite.id} className="party-card friend-invite-card">
              <div className="party-list-item__name">{invite.party_name}</div>
              <div className="friend-invite-card__detail">
                {invite.member_count} {invite.member_count === 1 ? 'member' : 'members'} · {invite.total_distance.toFixed(2)} km total
              </div>
              <div className="friend-invite-card__detail">
                Invited by: {invite.inviter_username}
              </div>
              <div className="friend-invite-actions">
                <button
                  className="party-btn party-btn--primary party-btn--small"
                  onClick={() => handleAcceptInvite(invite.id)}
                  disabled={inviteActionId === invite.id}
                >
                  {inviteActionId === invite.id ? <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> : 'Accept'}
                </button>
                <button
                  className="party-btn party-btn--danger party-btn--small"
                  onClick={() => handleDeclineInvite(invite.id)}
                  disabled={inviteActionId === invite.id}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <h2>Your Fellowships</h2>

      {/* Active parties list */}
      {activeParties.length === 0 && (
        <div className="party-empty">
          <i className="fas fa-users" aria-hidden="true"></i>
          You haven't joined a Fellowship yet
        </div>
      )}

      {activeParties.map(party => (
        <a
          key={party.id}
          href={`/party/${party.id}`}
          className="party-card party-card--clickable party-list-item"
          style={{ textDecoration: 'none' }}
        >
          <div>
            <div className="party-list-item__name">{party.name}</div>
            <div className="party-list-item__meta">
              {party.role === 'leader' ? <span>👑 Leader · </span> : <span>👤 Member · </span>}
              {party.active_member_count} {party.active_member_count === 1 ? 'member' : 'members'}
            </div>
          </div>
          <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)' }} aria-hidden="true"></i>
        </a>
      ))}

      {/* Create Fellowship */}
      <div style={{ marginTop: '1rem' }}>
        <button
          className="party-btn party-btn--gold party-btn--full"
          onClick={() => { setShowCreate(!showCreate); setShowJoin(false); }}
          aria-expanded={showCreate}
        >
          <i className="fas fa-plus" aria-hidden="true"></i> Create Fellowship
        </button>
      </div>

      {showCreate && (
        <div className="party-card" style={{ marginTop: '0.75rem' }}>
          <h3>Create a New Fellowship</h3>
          <form className="party-form" onSubmit={handleCreate}>
            <label>
              Fellowship Name
              <input
                type="text"
                value={createName}
                onInput={(e) => setCreateName((e.target as HTMLInputElement).value)}
                maxLength={50}
                placeholder="e.g. The Grey Company"
                required
                aria-describedby="name-helper"
              />
              <span className="helper-text" id="name-helper">{createName.length}/50 characters</span>
            </label>
            {storylines.length > 0 && (
              <label>
                Storyline
                <select value={selectedStorylineId} onChange={(e) => setSelectedStorylineId((e.target as HTMLSelectElement).value)}>
                  {storylines.map(storyline => (
                    <option key={storyline.id} value={storyline.id}>
                      {storyline.title}{storyline.adminOnly ? ' — Admin only' : ''}
                    </option>
                  ))}
                </select>
                <span className="helper-text">
                  Choose the route this fellowship will follow. Leaders can change it later from Manage Fellowship.
                </span>
              </label>
            )}
            <label>
              Distance Mode
              <select value={distanceMode} onChange={(e) => setDistanceMode((e.target as HTMLSelectElement).value)}>
                <option value="incremental">Since Join — Only distance walked after joining counts</option>
                <option value="cumulative">Cumulative — Everyone's walking adds together</option>
              </select>
              <span className="helper-text">
                {distanceMode === 'cumulative'
                  ? 'All members\' distance is summed. More walkers = faster progress.'
                  : 'Each member only contributes distance walked since joining this fellowship. Distance from before joining does not count.'}
              </span>
            </label>
            <label>
              When a Member Leaves
              <select value={leaveBehavior} onChange={(e) => setLeaveBehavior((e.target as HTMLSelectElement).value)}>
                <option value="keep">Keep — Their distance stays with the fellowship</option>
                <option value="remove">Remove — Their distance is subtracted</option>
              </select>
              <span className="helper-text">
                {leaveBehavior === 'keep'
                  ? 'Distance contributed by a departing member remains. The fellowship never goes backward.'
                  : 'When someone leaves or is kicked, their distance contribution is removed from the total.'}
              </span>
            </label>
            {createError && <div className="party-toast party-toast--error" role="alert">{createError}</div>}
            <button type="submit" className="party-btn party-btn--primary" disabled={creating || !createName.trim()}>
              {creating ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Creating…</> : 'Create Fellowship'}
            </button>
          </form>
        </div>
      )}

      {/* Join Fellowship */}
      <div style={{ marginTop: '0.5rem' }}>
        <button
          className="party-btn party-btn--secondary party-btn--full"
          onClick={() => { setShowJoin(!showJoin); setShowCreate(false); setPreview(null); setJoinError(null); }}
          aria-expanded={showJoin}
        >
          <i className="fas fa-link" aria-hidden="true"></i> Join Fellowship
        </button>
      </div>

      {showJoin && (
        <div className="party-card" style={{ marginTop: '0.75rem' }}>
          <h3>Join with Invite Code</h3>
          <div className="party-form">
            <label>
              Invite Code
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={inviteCode}
                  onInput={(e) => {
                    const val = (e.target as HTMLInputElement).value.replace(/[^A-Za-z0-9]/g, '');
                    setInviteCode(val.slice(0, 8));
                    setPreview(null);
                    setJoinError(null);
                  }}
                  maxLength={8}
                  placeholder="AbCd1234"
                  style={{ flex: 1 }}
                  aria-describedby="invite-helper"
                />
                <button
                  type="button"
                  className="party-btn party-btn--primary"
                  onClick={handlePreview}
                  disabled={inviteCode.length !== 8 || previewLoading}
                >
                  {previewLoading ? <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> : 'Preview'}
                </button>
              </div>
              <span className="helper-text" id="invite-helper">Enter the 8-character code from your invite link</span>
            </label>
            {joinError && <div className="party-toast party-toast--error" role="alert">{joinError}</div>}
            {preview && (
              <div className="party-card" style={{ background: 'var(--bg-dark-alt)' }}>
                <div className="party-join-preview">
                  <div className="party-join-preview__name">{preview.name}</div>
                  <div className="party-join-preview__detail">
                    {preview.member_count} {preview.member_count === 1 ? 'member' : 'members'}
                  </div>
                  <div className="party-join-preview__detail">
                    Mode: {preview.distance_mode === 'cumulative' ? 'Cumulative' : 'Average'}
                  </div>
                </div>
                <button
                  className="party-btn party-btn--gold party-btn--full"
                  onClick={handleJoin}
                  disabled={joining}
                >
                  {joining ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Joining…</> : 'Join Fellowship'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dissolved parties */}
      {dissolvedParties.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <button
            className={`party-collapsed-toggle ${showDissolved ? 'party-collapsed-toggle--open' : ''}`}
            onClick={() => setShowDissolved(!showDissolved)}
            aria-expanded={showDissolved}
          >
            <i className="fas fa-chevron-right" aria-hidden="true"></i>
            Past Fellowships ({dissolvedParties.length})
          </button>
          {showDissolved && dissolvedParties.map(party => (
            <div key={party.id} className="party-card" style={{ opacity: 0.6 }}>
              <div className="party-list-item">
                <div>
                  <div className="party-list-item__name">{party.name}</div>
                  <div className="party-list-item__meta">Dissolved</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
