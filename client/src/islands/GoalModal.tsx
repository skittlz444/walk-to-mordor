import { useSignal, useComputed } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { Goal } from '../types/goal';
import { getAuthHeaders } from '../utils/auth';

// ── Journal Types ──────────────────────────────────────────────────────────

interface OwnJournalEntry {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
}

interface FriendJournalEntry {
  userId: number;
  username: string;
  avatarId: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

interface JournalPermissions {
  canWrite: boolean;
  canEditOwn: boolean;
  canDeleteOwn: boolean;
  canReadFriends: boolean;
}

interface GoalJournalState {
  ownEntry: OwnJournalEntry | null;
  friendEntries: FriendJournalEntry[];
  permissions: JournalPermissions;
}

type JournalLoadState = 'idle' | 'loading' | 'ready' | 'error';
type JournalMode = 'create' | 'view' | 'edit';

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_BODY_LENGTH = 2000;

// ── Component ──────────────────────────────────────────────────────────────

interface GoalModalProps {
  goal: Goal;
  currentDistance: number;
  isCongratulations?: boolean;
  locked?: boolean;
  onClose: () => void;
  /** The storyline_goal_id for journal access rules (canonical goal_id is goal.id) */
  storylineGoalId?: number;
  /** Fellowship party ID for fellowship-context journal access */
  partyId?: number;
}

export function GoalModal({ goal, currentDistance, isCongratulations = false, locked = false, onClose, storylineGoalId: _storylineGoalId, partyId }: GoalModalProps) {
  const highResLoaded = useSignal(false);
  const thumbFormat = useSignal<'webp' | 'jpg'>('webp');
  const highResFormat = useSignal<'webp' | 'jpg'>('webp');

  // ── Journal State ──
  const journalState = useSignal<GoalJournalState | null>(null);
  const journalLoadState = useSignal<JournalLoadState>('idle');
  const journalMode = useSignal<JournalMode>('create');
  const journalText = useSignal('');
  const journalSaving = useSignal(false);
  const journalError = useSignal<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Computed ──
  const isCompleted = Number(currentDistance) >= goal.distance;
  const distanceToGo = isCompleted ? 0 : goal.distance - Number(currentDistance);
  const charCount = useComputed(() => journalText.value.length);

  // ── Journal Fetch ──
  const fetchJournalState = async () => {
    journalLoadState.value = 'loading';
    journalError.value = null;
    try {
      let url = `/api/goals/${goal.id}/journals`;
      if (partyId) {
        url += `?partyId=${partyId}`;
      }
      const resp = await fetch(url, { headers: getAuthHeaders() });
      if (!resp.ok) {
        throw new Error(`Failed to load journal (${resp.status})`);
      }
      const data: GoalJournalState = await resp.json();
      journalState.value = data;
      journalLoadState.value = 'ready';

      // Set initial mode
      if (data.ownEntry) {
        journalMode.value = 'view';
        journalText.value = data.ownEntry.body;
      } else if (data.permissions.canWrite) {
        journalMode.value = 'create';
        journalText.value = '';
      } else {
        journalMode.value = 'view';
        journalText.value = '';
      }
    } catch (err) {
      journalLoadState.value = 'error';
      journalError.value = err instanceof Error ? err.message : 'Failed to load journal';
    }
  };

  useEffect(() => {
    fetchJournalState();
  }, [goal.id, partyId]);

  // ── Journal Actions ──
  const handleSave = async () => {
    const trimmed = journalText.value.trim();
    if (!trimmed || trimmed.length > MAX_BODY_LENGTH) return;

    journalSaving.value = true;
    journalError.value = null;
    try {
      const body: Record<string, unknown> = { body: trimmed };
      if (partyId) body.partyId = partyId;

      const resp = await fetch(`/api/goals/${goal.id}/journal`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to save journal');
      }

      const data = await resp.json();
      journalState.value = {
        ...journalState.value!,
        ownEntry: data.entry,
        permissions: {
          ...journalState.value!.permissions,
          canWrite: false,
          canEditOwn: true,
          canDeleteOwn: true,
        },
      };
      journalMode.value = 'view';
    } catch (err) {
      journalError.value = err instanceof Error ? err.message : 'Failed to save journal';
    } finally {
      journalSaving.value = false;
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete your journal entry for this goal?')) return;

    journalSaving.value = true;
    journalError.value = null;
    try {
      const resp = await fetch(`/api/goals/${goal.id}/journal`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to delete journal');
      }

      journalState.value = {
        ...journalState.value!,
        ownEntry: null,
        permissions: {
          ...journalState.value!.permissions,
          canWrite: true,
          canEditOwn: false,
          canDeleteOwn: false,
        },
      };
      journalMode.value = 'create';
      journalText.value = '';
    } catch (err) {
      journalError.value = err instanceof Error ? err.message : 'Failed to delete journal';
    } finally {
      journalSaving.value = false;
    }
  };

  const startEdit = () => {
    journalMode.value = 'edit';
    // Focus textarea after render
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    if (journalState.value?.ownEntry) {
      journalMode.value = 'view';
      journalText.value = journalState.value.ownEntry.body;
    } else {
      journalMode.value = 'create';
      journalText.value = '';
    }
    journalError.value = null;
  };

  // ── Handlers ──
  const handleEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showJournal.value) {
        closeJournalView();
      } else {
        onClose();
      }
    }
  };

  const handleOverlayClick = (e: preact.JSX.TargetedEvent<HTMLDivElement, MouseEvent>) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      onClose();
    }
  };

  const handleHighResLoad = () => {
    highResLoaded.value = true;
  };

  const handleThumbError = (e: preact.JSX.TargetedEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    if (thumbFormat.value === 'webp') {
      thumbFormat.value = 'jpg';
      img.src = `/img/thumbs/${goal.image_id || '0'}-thumb.jpg`;
    } else if (!img.src.includes('/img/thumbs/0-thumb.webp')) {
      img.src = '/img/thumbs/0-thumb.webp';
    }
  };

  const handleHighResError = (e: preact.JSX.TargetedEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    if (highResFormat.value === 'webp') {
      highResFormat.value = 'jpg';
      img.src = `/img/highres/${goal.image_id || '0'}.jpg`;
    } else if (!img.src.includes('/img/highres/0.webp')) {
      img.src = '/img/highres/0.webp';
    }
  };

  // ── Journal Toggle ──
  const showJournal = useSignal(false);

  const openJournalView = () => {
    showJournal.value = true;
    if (journalLoadState.value === 'idle') {
      fetchJournalState();
    }
  };

  const closeJournalView = () => {
    showJournal.value = false;
    journalError.value = null;
  };

  // Reset journal view when goal changes
  useEffect(() => {
    showJournal.value = false;
    journalLoadState.value = 'idle';
    journalState.value = null;
    journalError.value = null;
  }, [goal.id]);

  // Re-fetch journal when partyId changes while journal is visible
  useEffect(() => {
    if (showJournal.value) {
      fetchJournalState();
    }
  }, [partyId]);

  // Handle escape key
  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [onClose]);

  // ── Styles ──
  const distanceStyle = isCompleted
    ? 'text-decoration: line-through; color: #888;'
    : 'color: #FFD700;';

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Goal Details (image + description + Journals button)
  // ═══════════════════════════════════════════════════════════════════════════

  const renderGoalDetails = () => (
    <>
      <div id="goal-image-container" style="margin-bottom: 1em; text-align: center;">
        <div style="position: relative; max-width: 100%; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
          <img
            id="goal-thumb-image"
            src={`/img/thumbs/${goal.image_id || '0'}-thumb.${thumbFormat.value}`}
            alt="Goal image"
            style={`width: 100%; height: auto; filter: ${locked ? 'blur(12px) brightness(0.6)' : (highResLoaded.value ? 'none' : 'blur(2px)')}; transform: ${locked ? 'scale(1.1)' : 'none'}; transition: filter 0.3s ease;`}
            onError={handleThumbError}
          />
          {!locked && (
            <img
              id="goal-highres-image"
              src={`/img/highres/${goal.image_id || '0'}.${highResFormat.value}`}
              alt="Goal image"
              style={`position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: ${highResLoaded.value ? '1' : '0'}; transition: opacity 0.5s ease;`}
              onLoad={handleHighResLoad}
              onError={handleHighResError}
            />
          )}
          {locked && (
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
              <i class="fas fa-lock" style="font-size: 3em; color: rgba(255,255,255,0.7); text-shadow: 0 2px 8px rgba(0,0,0,0.6);" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      {goal.description && (
        <div
          style={`font-size: 1em; line-height: 1.4; text-align: justify; margin-bottom: 1em; ${locked ? 'color: transparent; text-shadow: 0 0 8px rgba(255,255,255,0.5); user-select: none;' : 'color: #ccc;'}`}
          {...(locked ? { 'aria-hidden': 'true' } : {})}
        >
          {goal.description}
        </div>
      )}

      {/* Journals button — full width, styled, only when not locked */}
      {!locked && (
        <button
          type="button"
          class="journal-tab-btn"
          onClick={openJournalView}
          style="
            width: 100%;
            padding: 0.75em 1em;
            margin-top: 0.5em;
            background: linear-gradient(135deg, #2a2518 0%, #1f1c14 100%);
            border: 1px solid #8B6914;
            border-radius: 8px;
            color: #FFD700;
            font-size: 0.95em;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5em;
            transition: background 0.2s, border-color 0.2s;
          "
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = 'linear-gradient(135deg, #352e1a 0%, #2a2518 100%)';
            (e.target as HTMLElement).style.borderColor = '#B8860B';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = 'linear-gradient(135deg, #2a2518 0%, #1f1c14 100%)';
            (e.target as HTMLElement).style.borderColor = '#8B6914';
          }}
        >
          <span style="font-size: 1.1em;">📝</span>
          Journals
        </button>
      )}
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Journal View (full-page inside modal)
  // ═══════════════════════════════════════════════════════════════════════════

  const renderJournalView = () => {
    if (journalLoadState.value === 'idle' || journalLoadState.value === 'loading') {
      return (
        <div style="padding: 2em 1em; text-align: center;">
          <div style="color: #888;">
            <i class="fas fa-spinner fa-pulse fa-2x" aria-hidden="true" style="display: block; margin-bottom: 0.8em;" />
            Loading journal...
          </div>
        </div>
      );
    }

    if (journalLoadState.value === 'error') {
      return (
        <div style="padding: 2em 1em; text-align: center;">
          <div style="color: #c44; margin-bottom: 1em;">
            <i class="fas fa-exclamation-circle" aria-hidden="true" style="display: block; font-size: 2em; margin-bottom: 0.5em;" />
            {journalError.value || 'Failed to load journal'}
          </div>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            onClick={fetchJournalState}
          >
            Retry
          </button>
        </div>
      );
    }

    const state = journalState.value;
    if (!state) return null;

    const { ownEntry, friendEntries, permissions } = state;

    return (
      <div class="journal-view" style="min-height: 200px;">
        {/* Own Journal Section */}
        <div style="margin-bottom: 1.2em;">
          <div style="color: #FFD700; font-size: 0.95em; font-weight: bold; margin-bottom: 0.6em; display: flex; align-items: center; gap: 0.4em;">
            <span>📖</span> Your Journal
          </div>
          {renderOwnEntry(ownEntry, permissions)}
        </div>

        {/* Friends' Journal Section */}
        {permissions.canReadFriends && friendEntries.length > 0 && (
          <div class="journal-friends">
            <div style="color: #aaa; font-size: 0.85em; font-weight: bold; margin-bottom: 0.6em; display: flex; align-items: center; gap: 0.4em; border-top: 1px solid #3a3a3a; padding-top: 0.8em;">
              <span>👥</span> Friends' Journals
            </div>
            {friendEntries.map((entry) => (
              <div
                key={entry.userId}
                class="journal-friend-entry"
                style="background: #2a2a2a; border-radius: 6px; padding: 0.8em; margin-bottom: 0.6em;"
              >
                <div style="display: flex; align-items: center; margin-bottom: 0.4em;">
                  <span style="color: #FFD700; font-weight: bold; font-size: 0.9em;">
                    {entry.username}
                  </span>
                  <span style="color: #666; font-size: 0.75em; margin-left: auto;">
                    {new Date(entry.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <div style="color: #ccc; font-size: 0.9em; white-space: pre-wrap; word-break: break-word;">
                  {entry.body}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Journal Error */}
        {journalError.value && (
          <div style="color: #c44; font-size: 0.85em; margin-top: 0.5em; text-align: center;">
            {journalError.value}
          </div>
        )}
      </div>
    );
  };

  const renderOwnEntry = (ownEntry: OwnJournalEntry | null, permissions: JournalPermissions) => {
    // Create mode
    if (journalMode.value === 'create' && permissions.canWrite && !ownEntry) {
      return (
        <div class="journal-create">
          <textarea
            ref={textareaRef}
            class="journal-textarea"
            placeholder="Write your reflection on reaching this milestone..."
            value={journalText.value}
            onInput={(e) => { journalText.value = (e.target as HTMLTextAreaElement).value; }}
            maxLength={MAX_BODY_LENGTH}
            rows={4}
            style="width: 100%; background: #1a1a1a; color: #ccc; border: 1px solid #444; border-radius: 6px; padding: 0.8em; font-size: 0.9em; resize: vertical; font-family: inherit; box-sizing: border-box;"
          />
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5em;">
            <span style={`font-size: 0.8em; ${charCount.value > MAX_BODY_LENGTH * 0.9 ? 'color: #fc3;' : 'color: #666;'}`}>
              {charCount.value}/{MAX_BODY_LENGTH}
            </span>
            <div style="display: flex; gap: 0.5em;">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={journalSaving.value || journalText.value.trim().length === 0}
              >
                {journalSaving.value ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // View mode (own entry exists)
    if ((journalMode.value === 'view' || journalMode.value === 'create') && ownEntry) {
      return (
        <div class="journal-own-entry" style="background: #222; border-radius: 6px; padding: 0.8em;">
          <div style="display: flex; align-items: center; margin-bottom: 0.4em;">
            <span style="color: #888; font-size: 0.75em;">
              {new Date(ownEntry.updated_at).toLocaleDateString()}
            </span>
          </div>
          <div style="color: #ccc; font-size: 0.9em; white-space: pre-wrap; word-break: break-word;">
            {ownEntry.body}
          </div>
          <div style="display: flex; gap: 0.5em; margin-top: 0.6em;">
            {permissions.canEditOwn && (
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onClick={startEdit}
                style="font-size: 0.8em;"
              >
                <i class="fas fa-edit" aria-hidden="true" /> Edit
              </button>
            )}
            {permissions.canDeleteOwn && (
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onClick={handleDelete}
                disabled={journalSaving.value}
                style="font-size: 0.8em;"
              >
                <i class="fas fa-trash" aria-hidden="true" /> Delete
              </button>
            )}
          </div>
        </div>
      );
    }

    // Edit mode
    if (journalMode.value === 'edit' && ownEntry) {
      return (
        <div class="journal-edit">
          <textarea
            ref={textareaRef}
            class="journal-textarea"
            value={journalText.value}
            onInput={(e) => { journalText.value = (e.target as HTMLTextAreaElement).value; }}
            maxLength={MAX_BODY_LENGTH}
            rows={4}
            style="width: 100%; background: #1a1a1a; color: #ccc; border: 1px solid #555; border-radius: 6px; padding: 0.8em; font-size: 0.9em; resize: vertical; font-family: inherit; box-sizing: border-box;"
          />
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5em;">
            <span style={`font-size: 0.8em; ${charCount.value > MAX_BODY_LENGTH * 0.9 ? 'color: #fc3;' : 'color: #666;'}`}>
              {charCount.value}/{MAX_BODY_LENGTH}
            </span>
            <div style="display: flex; gap: 0.5em;">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onClick={cancelEdit}
                style="font-size: 0.8em;"
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={journalSaving.value || journalText.value.trim().length === 0}
              >
                {journalSaving.value ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // No access to create (goal not reached)
    if (!permissions.canWrite && !ownEntry) {
      return (
        <div style="color: #666; font-size: 0.9em; text-align: center; padding: 1em 0.5em;">
          <i class="fas fa-lock" aria-hidden="true" style="margin-right: 0.3em;" />
          Reach this goal personally or with a fellowship to write your journal
        </div>
      );
    }

    return null;
  };

  // ── Remove old renderJournalSection and renderOwnEntry ──
  // (they're replaced by renderJournalView and the new renderOwnEntry above)

  return (
    <div class="modal-overlay" onClick={handleOverlayClick}>
      <div class="modal-dialog modal-large" role="dialog" aria-modal="true" aria-label={`Goal: ${goal.title}`}>
        <div class="modal-content">
          <div class="modal-body goal-modal-scrollable">
            <div style="padding: 1.5em;">
              {isCongratulations && (
                <div class="goal-congratulations">
                  🎉 Congratulations! You've passed a new goal! 🎉
                </div>
              )}

              {goal.special && (
                <div style="color: #FFD700; font-size: 1.4em; font-weight: bold; margin-bottom: 0.5em; text-align: center;">
                  {goal.special}
                </div>
              )}

              <div style="color: #fff; font-size: 1.2em; font-weight: bold; margin-bottom: 0.8em; text-align: center;">
                {goal.title}
              </div>

              <div style={`${distanceStyle} font-size: 1.1em; margin-bottom: 0.5em; text-align: center;`}>
                {goal.distance.toFixed(2)} km
              </div>

              {!isCompleted && (
                <div style="color: #aaa; font-size: 1em; margin-bottom: 1em; text-align: center;">
                  {distanceToGo.toFixed(2)} km to go
                </div>
              )}

              {/* Body: either goal details or journal view */}
              {showJournal.value ? (
                <>
                  {/* Back button */}
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    onClick={closeJournalView}
                    style="margin-bottom: 1em; font-size: 0.85em;"
                  >
                    <i class="fas fa-arrow-left" aria-hidden="true" style="margin-right: 0.3em;" />
                    Back to Goal
                  </button>
                  {renderJournalView()}
                </>
              ) : (
                renderGoalDetails()
              )}
            </div>
          </div>

          <div class="modal-footer modal-footer-full">
            <div class="modal-footer-btns modal-footer-btns-goal">
              <button id="close-goal-btn" type="button" class="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
