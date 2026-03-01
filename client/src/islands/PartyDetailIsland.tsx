import { useState, useEffect, useCallback } from 'preact/hooks';
import { GoalModal } from './GoalModal';
import type { Goal } from '../types/goal';

interface MilestoneData {
  id: number;
  title: string;
  distance: number;
  description?: string | null;
  image_id?: string | null;
  special?: string | null;
}

interface PartyMember {
  user_id: number;
  display_name: string;
  contribution: number;
  status: string;
  color: number;
}

interface PartyProgressData {
  total_distance: number;
  member_count: number;
  calculated_position: MilestoneData | null;
  next_position: MilestoneData | null;
  leave_distance_behavior: string;
  members: PartyMember[];
  newly_passed_milestones: Array<{ id: number; title: string; distance: number }>;
}

interface PartyInfo {
  id: number;
  name: string;
  role: string;
  invite_code: string;
  leader_id: number;
}

const MEMBER_COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
  '#469990', '#dcbeff',
];

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function getPartyIdFromUrl(): number {
  const match = window.location.pathname.match(/^\/party\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function milestoneToGoal(m: MilestoneData): Goal {
  return { id: m.id, title: m.title, distance: m.distance, description: m.description ?? null, image_id: m.image_id ?? null, special: m.special ?? null };
}

export function PartyDetailIsland() {
  const partyId = getPartyIdFromUrl();
  const [progress, setProgress] = useState<PartyProgressData | null>(null);
  const [partyInfo, setPartyInfo] = useState<PartyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [modalGoal, setModalGoal] = useState<Goal | null>(null);

  const fetchData = useCallback(async () => {
    if (!partyId) { setError('Invalid party ID'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const headers = getAuthHeaders();
      // Parallel fetch for party info and progress
      const [partiesRes, progressRes] = await Promise.all([
        fetch('/api/user/parties?include_dissolved=true', { headers }),
        fetch(`/api/party/${partyId}/progress`, { headers }),
      ]);

      if (!partiesRes.ok) {
        if (partiesRes.status === 401) { window.location.href = '/login'; return; }
        throw new Error('Failed to load party info');
      }
      const partiesData = await partiesRes.json();
      const info = (partiesData.parties ?? []).find((p: PartyInfo) => p.id === partyId);
      if (!info) { setError('Fellowship not found'); setLoading(false); return; }
      setPartyInfo(info);

      if (!progressRes.ok) {
        if (progressRes.status === 403) { window.location.href = '/party'; return; }
        if (progressRes.status === 404) { setError('Fellowship not found'); setLoading(false); return; }
        throw new Error('Failed to load progress');
      }
      setProgress(await progressRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLeave = async () => {
    setLeaving(true);
    try {
      const res = await fetch(`/api/party/${partyId}/leave`, { method: 'POST', headers: getAuthHeaders() });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to leave fellowship');
      }
      window.location.href = '/party';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave fellowship');
      setShowLeaveConfirm(false);
      setLeaving(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/party/join/${partyInfo?.invite_code ?? ''}`;
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
    const url = `${window.location.origin}/party/join/${partyInfo?.invite_code ?? ''}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${partyInfo?.name ?? 'Fellowship'}`,
          text: `Join my Fellowship "${partyInfo?.name ?? ''}" on Walk to Mordor!`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  if (loading) {
    return (
      <div className="party-page">
        <div className="party-loading">
          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading fellowship…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="party-page">
        <div className="party-error">
          <p>{error}</p>
          <button className="party-btn party-btn--primary" onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  if (!progress || !partyInfo) return null;

  const isLeader = partyInfo.role === 'leader';

  return (
    <div className="party-page">
      {/* Breadcrumb */}
      <nav className="party-breadcrumb" aria-label="Breadcrumb">
        <a href="/party">← Fellowships</a>
        <span className="separator">/</span>
        <span className="current">{partyInfo.name}</span>
      </nav>

      <h2>{partyInfo.name}</h2>

      {/* Progress Stats */}
      <div className="party-progress">
        <div className="party-progress__stat">
          <span className="party-progress__stat-value">{progress.total_distance.toFixed(2)} km</span>
          <span className="party-progress__stat-label">Total Progress</span>
        </div>
        <div className="party-progress__stat">
          <span className="party-progress__stat-value">{progress.member_count}</span>
          <span className="party-progress__stat-label">{progress.member_count === 1 ? 'Member' : 'Members'}</span>
        </div>
        {progress.calculated_position && (
          <div
            className="party-progress__stat party-progress__stat--clickable"
            role="button"
            tabIndex={0}
            aria-label={`Previous milestone: ${progress.calculated_position.title}`}
            onClick={() => setModalGoal(milestoneToGoal(progress.calculated_position!))}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModalGoal(milestoneToGoal(progress.calculated_position!)); } }}
          >
            <span className="party-progress__stat-value">{progress.calculated_position.title}</span>
            <span className="party-progress__stat-label">Previous Milestone</span>
          </div>
        )}
        {progress.next_position ? (
          <div
            className="party-progress__stat party-progress__stat--clickable"
            role="button"
            tabIndex={0}
            aria-label={`Next milestone: ${progress.next_position.title}`}
            onClick={() => setModalGoal(milestoneToGoal(progress.next_position!))}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModalGoal(milestoneToGoal(progress.next_position!)); } }}
          >
            <span className="party-progress__stat-value">{progress.next_position.title}</span>
            <span className="party-progress__stat-label">Next Milestone</span>
          </div>
        ) : (
          <div className="party-progress__stat">
            <span className="party-progress__stat-value">🏔️</span>
            <span className="party-progress__stat-label">Journey Complete!</span>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="party-card">
        <h3>Members</h3>
        <ul className="party-member-list" role="list">
          {progress.members
            .sort((a, b) => b.contribution - a.contribution)
            .map(member => (
              <li key={member.user_id} className="party-member-item">
                <span
                  className="party-member-color"
                  style={{ backgroundColor: MEMBER_COLORS[member.color] || '#888' }}
                  aria-hidden="true"
                ></span>
                <div className="party-member-info">
                  <span className="party-member-name">
                    {member.display_name}
                    {member.status !== 'active' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.4em' }}>
                        ({member.status})
                      </span>
                    )}
                  </span>
                </div>
                <span className="party-member-contribution">{member.contribution.toFixed(2)} km</span>
              </li>
            ))}
        </ul>
      </div>

      {/* Activity Feed Placeholder */}
      <div className="party-card">
        <h3>Activity</h3>
        <div className="party-activity-placeholder">
          <i className="fas fa-stream" aria-hidden="true" style={{ marginBottom: '0.3rem', display: 'block' }}></i>
          Activity feed coming soon
        </div>
      </div>

      {/* Invite Link */}
      <div className="party-card">
        <h3>Invite Link</h3>
        <div className="party-invite">
          <div className="party-invite__url" aria-label="Invite URL">
            {window.location.origin}/party/join/{partyInfo.invite_code}
          </div>
          <div className="party-invite__actions">
            <button className="party-btn party-btn--primary party-btn--small" onClick={handleCopyLink}>
              <i className="fas fa-copy" aria-hidden="true"></i>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            {typeof navigator.share === 'function' && (
              <button className="party-btn party-btn--secondary party-btn--small" onClick={handleShare}>
                <i className="fas fa-share-alt" aria-hidden="true"></i>
                Share
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        {isLeader && (
          <a href={`/party/${partyId}/manage`} className="party-btn party-btn--gold" style={{ textDecoration: 'none' }}>
            <i className="fas fa-cog" aria-hidden="true"></i> Manage Fellowship
          </a>
        )}
        <button className="party-btn party-btn--danger" onClick={() => setShowLeaveConfirm(true)}>
          <i className="fas fa-sign-out-alt" aria-hidden="true"></i> Leave Fellowship
        </button>
      </div>

      {/* Leave Confirmation */}
      {showLeaveConfirm && (
        <div className="party-confirm-overlay" onClick={() => setShowLeaveConfirm(false)}>
          <div className="party-confirm-dialog" role="dialog" aria-label="Leave Fellowship" onClick={(e) => e.stopPropagation()}>
            <h3>Leave Fellowship?</h3>
            <p>
              Are you sure you want to leave <strong>{partyInfo.name}</strong>?
              {progress.leave_distance_behavior === 'keep'
                ? ' Your distance contributions will remain with the fellowship.'
                : ' Your distance contributions will be removed from the fellowship.'}
            </p>
            <div className="party-confirm-actions">
              <button className="party-btn party-btn--secondary" onClick={() => setShowLeaveConfirm(false)} disabled={leaving}>Cancel</button>
              <button className="party-btn party-btn--danger" onClick={handleLeave} disabled={leaving}>
                {leaving ? <><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Leaving…</> : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {modalGoal && (
        <GoalModal
          goal={modalGoal}
          currentDistance={progress.total_distance}
          onClose={() => setModalGoal(null)}
        />
      )}
    </div>
  );
}
