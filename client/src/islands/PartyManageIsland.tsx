import { useState, useEffect, useCallback } from 'preact/hooks';

interface PartyMember {
  user_id: number;
  display_name: string;
  contribution: number;
  status: string;
  color: number;
}

interface PartyInfo {
  id: number;
  name: string;
  role: string;
  leave_distance_behavior: string;
}

interface PartyProgressData {
  total_distance: number;
  member_count: number;
  distance_mode: string;
  leave_distance_behavior: string;
  members: PartyMember[];
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function getPartyIdFromUrl(): number {
  const match = window.location.pathname.match(/^\/party\/(\d+)\/manage$/);
  return match ? parseInt(match[1], 10) : 0;
}

export function PartyManageIsland() {
  const partyId = getPartyIdFromUrl();
  const [partyInfo, setPartyInfo] = useState<PartyInfo | null>(null);
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Settings form
  const [settingsName, setSettingsName] = useState('');
  const [settingsLeaveBehavior, setSettingsLeaveBehavior] = useState('keep');
  const [saving, setSaving] = useState(false);

  // Kick state
  const [kickTarget, setKickTarget] = useState<PartyMember | null>(null);
  const [kickRemoveDistance, setKickRemoveDistance] = useState(false);
  const [kicking, setKicking] = useState(false);

  // Transfer state
  const [transferTarget, setTransferTarget] = useState<number | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Regenerate invite
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!partyId) { setError('Invalid party ID'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      // Get current user ID from session
      const sessionRes = await fetch('/api/session', { headers: getAuthHeaders() });
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        setCurrentUserId(sessionData.userId ?? null);
      }

      // Get party info
      const partiesRes = await fetch('/api/user/parties', { headers: getAuthHeaders() });
      if (!partiesRes.ok) {
        if (partiesRes.status === 401) { window.location.href = '/login'; return; }
        throw new Error('Failed to load parties');
      }
      const partiesData = await partiesRes.json();
      const info = (partiesData.parties ?? []).find((p: PartyInfo) => p.id === partyId);
      if (!info) { window.location.href = '/party'; return; }

      // Redirect if not leader
      if (info.role !== 'leader') {
        window.location.href = `/party/${partyId}`;
        return;
      }

      setPartyInfo(info);
      setSettingsName(info.name);
      setSettingsLeaveBehavior(info.leave_distance_behavior);

      // Get members
      const progressRes = await fetch(`/api/party/${partyId}/progress`, { headers: getAuthHeaders() });
      if (progressRes.ok) {
        const progressData: PartyProgressData = await progressRes.json();
        setMembers(progressData.members.filter(m => m.status === 'active'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveSettings = async (e: Event) => {
    e.preventDefault();
    if (!settingsName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/party/${partyId}/settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: settingsName.trim(),
          leave_distance_behavior: settingsLeaveBehavior,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update settings');
      setSuccessMsg('Settings updated!');
      setPartyInfo(prev => prev ? { ...prev, name: settingsName.trim(), leave_distance_behavior: settingsLeaveBehavior } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleKick = async () => {
    if (!kickTarget) return;
    setKicking(true);
    setError(null);
    try {
      const res = await fetch(`/api/party/${partyId}/kick/${kickTarget.user_id}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ remove_distance: kickRemoveDistance }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to kick member');
      setSuccessMsg(`${kickTarget.display_name} has been removed.`);
      setKickTarget(null);
      setKickRemoveDistance(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to kick member');
    } finally {
      setKicking(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    setTransferring(true);
    setError(null);
    try {
      const res = await fetch(`/api/party/${partyId}/transfer-leadership`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ new_leader_id: transferTarget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to transfer leadership');
      setSuccessMsg('Leadership transferred!');
      // Redirect since we're no longer leader
      setTimeout(() => { window.location.href = `/party/${partyId}`; }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer leadership');
      setShowTransferConfirm(false);
      setTransferring(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/party/${partyId}/invite`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate invite code');
      setSuccessMsg('Invite code regenerated! Share the new link with your friends.');
      setShowRegenConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate invite code');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="party-page">
        <div className="party-loading">
          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading management…
        </div>
      </div>
    );
  }

  if (error && !partyInfo) {
    return (
      <div className="party-page">
        <div className="party-error">
          <p>{error}</p>
          <button className="party-btn party-btn--primary" onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  if (!partyInfo) return null;

  // Filter self from kick/transfer targets
  const otherMembers = currentUserId ? members.filter(m => m.user_id !== currentUserId) : members;

  return (
    <div className="party-page">
      {/* Breadcrumb */}
      <nav className="party-breadcrumb" aria-label="Breadcrumb">
        <a href={`/party/${partyId}`}>← {partyInfo.name}</a>
        <span className="separator">/</span>
        <span className="current">Manage</span>
      </nav>

      {successMsg && (
        <div className="party-toast party-toast--success" role="status">
          {successMsg}
          <button type="button" style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: '0.5rem', cursor: 'pointer' }} onClick={() => setSuccessMsg(null)} aria-label="Dismiss">×</button>
        </div>
      )}
      {error && (
        <div className="party-toast party-toast--error" role="alert">
          {error}
          <button type="button" style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: '0.5rem', cursor: 'pointer' }} onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Settings */}
      <div className="party-manage-section">
        <h3><i className="fas fa-cog" aria-hidden="true" style={{ marginRight: '0.4em' }}></i>Settings</h3>
        <form className="party-form" onSubmit={handleSaveSettings}>
          <label>
            Fellowship Name
            <input
              type="text"
              value={settingsName}
              onInput={(e) => setSettingsName((e.target as HTMLInputElement).value)}
              maxLength={50}
              required
            />
          </label>
          <label>
            When a Member Leaves
            <select value={settingsLeaveBehavior} onChange={(e) => setSettingsLeaveBehavior((e.target as HTMLSelectElement).value)}>
              <option value="keep">Keep — Their distance stays with the fellowship</option>
              <option value="remove">Remove — Their distance is subtracted</option>
            </select>
            <span className="helper-text">
              {settingsLeaveBehavior === 'keep'
                ? 'Distance contributed by a departing member remains.'
                : 'When someone leaves, their distance is removed.'}
            </span>
          </label>
          <button type="submit" className="party-btn party-btn--primary" disabled={saving || !settingsName.trim()}>
            {saving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Saving…</> : 'Save Settings'}
          </button>
        </form>
      </div>

      {/* Members / Kick */}
      <div className="party-manage-section">
        <h3><i className="fas fa-users" aria-hidden="true" style={{ marginRight: '0.4em' }}></i>Members</h3>
        {otherMembers.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No other members to manage.</p>
        ) : (
          otherMembers.map(member => (
            <div key={member.user_id} className="party-kick-row">
              <div>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{member.display_name}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5em' }}>
                  {member.contribution.toFixed(2)} km
                </span>
              </div>
              <button
                className="party-btn party-btn--danger party-btn--small"
                onClick={() => { setKickTarget(member); setKickRemoveDistance(false); }}
              >
                Kick
              </button>
            </div>
          ))
        )}
      </div>

      {/* Transfer Leadership */}
      <div className="party-manage-section">
        <h3><i className="fas fa-crown" aria-hidden="true" style={{ marginRight: '0.4em' }}></i>Transfer Leadership</h3>
        {otherMembers.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No other members to transfer to.</p>
        ) : (
          <div className="party-form">
            <label>
              New Leader
              <select value={transferTarget ?? ''} onChange={(e) => setTransferTarget(Number((e.target as HTMLSelectElement).value) || null)}>
                <option value="">Select a member…</option>
                {otherMembers.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                ))}
              </select>
            </label>
            <button
              className="party-btn party-btn--gold"
              disabled={!transferTarget}
              onClick={() => setShowTransferConfirm(true)}
            >
              Transfer Leadership
            </button>
          </div>
        )}
      </div>

      {/* Regenerate Invite */}
      <div className="party-manage-section">
        <h3><i className="fas fa-link" aria-hidden="true" style={{ marginRight: '0.4em' }}></i>Invite Link</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          Regenerating the invite code will invalidate the old link. Anyone with the old link will no longer be able to join.
        </p>
        <button className="party-btn party-btn--secondary" onClick={() => setShowRegenConfirm(true)}>
          <i className="fas fa-sync-alt" aria-hidden="true"></i> Regenerate Invite Code
        </button>
      </div>

      {/* Kick Confirmation Dialog */}
      {kickTarget && (
        <div className="party-confirm-overlay" onClick={() => setKickTarget(null)}>
          <div className="party-confirm-dialog" role="dialog" aria-label="Kick Member" onClick={(e) => e.stopPropagation()}>
            <h3>Kick {kickTarget.display_name}?</h3>
            <p>
              Are you sure you want to remove <strong>{kickTarget.display_name}</strong> from the fellowship?
            </p>
            <div className="party-toggle">
              <input
                type="checkbox"
                id="remove-distance-toggle"
                checked={kickRemoveDistance}
                onChange={(e) => setKickRemoveDistance((e.target as HTMLInputElement).checked)}
              />
              <label htmlFor="remove-distance-toggle">
                Remove their distance contribution ({kickTarget.contribution.toFixed(2)} km)
              </label>
            </div>
            <div className="party-confirm-actions">
              <button className="party-btn party-btn--secondary" onClick={() => setKickTarget(null)} disabled={kicking}>Cancel</button>
              <button className="party-btn party-btn--danger" onClick={handleKick} disabled={kicking}>
                {kicking ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Kicking…</> : 'Kick Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Confirmation Dialog */}
      {showTransferConfirm && (
        <div className="party-confirm-overlay" onClick={() => setShowTransferConfirm(false)}>
          <div className="party-confirm-dialog" role="dialog" aria-label="Transfer Leadership" onClick={(e) => e.stopPropagation()}>
            <h3>Transfer Leadership?</h3>
            <p>
              Are you sure you want to transfer leadership to <strong>{members.find(m => m.user_id === transferTarget)?.display_name}</strong>?
              You will no longer be able to manage the fellowship.
            </p>
            <div className="party-confirm-actions">
              <button className="party-btn party-btn--secondary" onClick={() => setShowTransferConfirm(false)} disabled={transferring}>Cancel</button>
              <button className="party-btn party-btn--gold" onClick={handleTransfer} disabled={transferring}>
                {transferring ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Transferring…</> : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Confirmation Dialog */}
      {showRegenConfirm && (
        <div className="party-confirm-overlay" onClick={() => setShowRegenConfirm(false)}>
          <div className="party-confirm-dialog" role="dialog" aria-label="Regenerate Invite Code" onClick={(e) => e.stopPropagation()}>
            <h3>Regenerate Invite Code?</h3>
            <p>
              This will create a new invite code and invalidate the old one.
              Anyone who has the current link will need the new one to join.
            </p>
            <div className="party-confirm-actions">
              <button className="party-btn party-btn--secondary" onClick={() => setShowRegenConfirm(false)} disabled={regenerating}>Cancel</button>
              <button className="party-btn party-btn--primary" onClick={handleRegenerate} disabled={regenerating}>
                {regenerating ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Regenerating…</> : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
