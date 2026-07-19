import { useSignal, useComputed } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Goal } from '../types/goal';
import { getAuthHeaders } from '../utils/auth';
import { recordGoalContentEvent } from '../utils/goalContentEvents';

marked.setOptions({
  breaks: true,
});

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
type GoalContentType = 'story' | 'poetry' | 'appendix';
type GoalContentLoadState = 'idle' | 'loading' | 'ready' | 'error';

interface GoalContentEntry {
  id: number;
  goal_id: number;
  type: GoalContentType;
  title: string;
  body: string;
  author_attribution: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_BODY_LENGTH = 2000;
const APPENDIX_COLLAPSE_WORDS = 500;

function sanitizeRenderedHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html);
  const template = document.createElement('template');
  template.innerHTML = sanitized;
  template.content.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attr) => {
      if (/^on/i.test(attr.name) || /^\s*javascript:/i.test(attr.value)) {
        element.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML;
}

function renderMarkdown(body: string): string {
  return sanitizeRenderedHtml(marked.parse(body) as string);
}

function getPlainTextFromHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.textContent || '';
}

function getWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function getContentTypeLabel(type: GoalContentType): string {
  if (type === 'story') return 'Campfire Story';
  if (type === 'poetry') return 'Poetry';
  return 'Appendix';
}

/** Human summary of lore entries by type, e.g. ["2 stories", "1 poem"]. */
function formatLoreSummary(entries: GoalContentEntry[]): string[] {
  const counts: Record<GoalContentType, number> = { story: 0, poetry: 0, appendix: 0 };
  for (const entry of entries) {
    counts[entry.type] += 1;
  }
  const parts: string[] = [];
  if (counts.story) parts.push(`${counts.story} ${counts.story === 1 ? 'story' : 'stories'}`);
  if (counts.poetry) parts.push(`${counts.poetry} ${counts.poetry === 1 ? 'poem' : 'poems'}`);
  if (counts.appendix) parts.push(`${counts.appendix} ${counts.appendix === 1 ? 'appendix' : 'appendices'}`);
  return parts;
}

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
  const [expandedAppendices, setExpandedAppendices] = useState<ReadonlySet<number>>(() => new Set());

  // ── Journal State ──
  const journalState = useSignal<GoalJournalState | null>(null);
  const journalLoadState = useSignal<JournalLoadState>('idle');
  const journalMode = useSignal<JournalMode>('create');
  const journalText = useSignal('');
  const journalSaving = useSignal(false);
  const journalError = useSignal<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Goal Content State ──
  const contentEntries = useSignal<GoalContentEntry[]>([]);
  const contentLoadState = useSignal<GoalContentLoadState>('idle');
  const contentError = useSignal<string | null>(null);
  const contentOpenSentForGoal = useRef<number | null>(null);
  const loreExpanded = useSignal(false);

  // ── Computed ──
  const isCompleted = Number(currentDistance) >= goal.distance;
  const distanceToGo = isCompleted ? 0 : goal.distance - Number(currentDistance);
  const charCount = useComputed(() => journalText.value.length);

  // ── Goal Content Fetch ──
  const fetchGoalContent = async () => {
    contentLoadState.value = 'loading';
    contentError.value = null;
    try {
      let url = `/api/goals/${goal.id}/content`;
      if (partyId) {
        url += `?partyId=${partyId}`;
      }
      const resp = await fetch(url, { headers: getAuthHeaders() });
      if (!resp.ok) {
        throw new Error(`Failed to load goal content (${resp.status})`);
      }
      const data: { entries?: GoalContentEntry[] } = await resp.json();
      const entries = [...(data.entries ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      contentEntries.value = entries;
      contentLoadState.value = 'ready';

      if (entries.length > 0 && contentOpenSentForGoal.current !== goal.id) {
        contentOpenSentForGoal.current = goal.id;
        recordGoalContentEvent({
          goalId: goal.id,
          eventType: 'content_open',
          partyId,
          contentId: entries[0].id,
        });
      }
    } catch (err) {
      contentEntries.value = [];
      contentLoadState.value = 'error';
      contentError.value = err instanceof Error ? err.message : 'Failed to load goal content';
    }
  };

  useEffect(() => {
    contentEntries.value = [];
    contentError.value = null;
    contentLoadState.value = 'idle';
    contentOpenSentForGoal.current = null;
    loreExpanded.value = false;
    setExpandedAppendices(new Set());

    if (!locked && goal.has_content === true) {
      fetchGoalContent();
    }
  }, [goal.id, goal.has_content, locked, partyId]);

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

  const toggleAppendix = (entryId: number) => {
    setExpandedAppendices((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const renderContentEntry = (entry: GoalContentEntry) => {
    const html = renderMarkdown(entry.body);
    const plainText = getPlainTextFromHtml(html);
    const words = getWords(plainText);
    const isLongAppendix = entry.type === 'appendix' && words.length > APPENDIX_COLLAPSE_WORDS;
    const isExpanded = expandedAppendices.has(entry.id);
    const typeLabel = getContentTypeLabel(entry.type);
    const bodyClass = `goal-content-entry__body goal-content-entry__body--${entry.type}`;
    const bodyStyle = entry.type === 'poetry'
      ? 'color: #ddd; line-height: 1.7; text-align: center; white-space: pre-wrap;'
      : 'color: #ccc; line-height: 1.55;';
    const entryStyle = entry.type === 'story'
      ? 'background: linear-gradient(135deg, rgba(70, 43, 18, 0.38), rgba(24, 20, 16, 0.96)); border-color: rgba(255, 166, 77, 0.35);'
      : entry.type === 'poetry'
        ? 'background: rgba(36, 32, 52, 0.7); border-color: rgba(180, 160, 255, 0.35);'
        : 'background: rgba(26, 34, 36, 0.82); border-color: rgba(120, 190, 170, 0.35);';

    return (
      <article
        key={entry.id}
        class={`goal-content-entry goal-content-entry--${entry.type}`}
        style={`margin-top: 0.9em; padding: 1em; border: 1px solid; border-radius: 10px; ${entryStyle}`}
      >
        <div style="display: flex; align-items: center; gap: 0.6em; flex-wrap: wrap; margin-bottom: 0.55em;">
          <span
            class={`goal-content-badge goal-content-badge--${entry.type}`}
            style="font-size: 0.72em; letter-spacing: 0.06em; text-transform: uppercase; color: #111; background: #FFD700; border-radius: 999px; padding: 0.2em 0.55em; font-weight: 700;"
          >
            {typeLabel}
          </span>
          <h4 style="margin: 0; color: #fff; font-size: 1.05em;">{entry.title}</h4>
        </div>

        {isLongAppendix && !isExpanded ? (
          <div class={bodyClass} style={bodyStyle}>
            <p>{words.slice(0, APPENDIX_COLLAPSE_WORDS).join(' ')}…</p>
          </div>
        ) : (
          <div
            class={bodyClass}
            style={bodyStyle}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}

        {entry.author_attribution && (
          <div class="goal-content-entry__attribution" style="margin-top: 0.7em; color: #999; font-size: 0.85em; font-style: italic;">
            — {entry.author_attribution}
          </div>
        )}

        {isLongAppendix && (
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onClick={() => toggleAppendix(entry.id)}
            aria-expanded={isExpanded}
            style="margin-top: 0.8em; font-size: 0.82em;"
          >
            {isExpanded ? 'Collapse appendix' : 'Expand appendix'}
          </button>
        )}
      </article>
    );
  };

  const renderGoalContentSection = () => {
    if (locked || goal.has_content !== true) {
      return null;
    }

    if (contentLoadState.value === 'idle' || contentLoadState.value === 'loading') {
      return (
        <section class="goal-content-section" aria-label="Goal content" style="margin: 1em 0;">
          <div style="color: #888; text-align: center; padding: 0.8em; border: 1px solid #333; border-radius: 8px;">
            <i class="fas fa-spinner fa-pulse" aria-hidden="true" style="margin-right: 0.4em;" />
            Loading campfire lore...
          </div>
        </section>
      );
    }

    if (contentLoadState.value === 'error') {
      return (
        <section class="goal-content-section" aria-label="Goal content" style="margin: 1em 0;">
          <div style="color: #c44; text-align: center; padding: 0.8em; border: 1px solid #5a2424; border-radius: 8px;">
            {contentError.value || 'Failed to load goal content'}
          </div>
        </section>
      );
    }

    if (contentEntries.value.length === 0) {
      return null;
    }

    const summary = formatLoreSummary(contentEntries.value);
    const expanded = loreExpanded.value;

    return (
      <section class="goal-content-section" aria-label="Campfire lore" style="margin: 1em 0;">
        <button
          type="button"
          class="goal-content-toggle"
          aria-expanded={expanded}
          onClick={() => { loreExpanded.value = !loreExpanded.value; }}
          style="width: 100%; display: flex; align-items: center; gap: 0.5em; background: rgba(255, 215, 0, 0.08); border: 1px solid rgba(255, 166, 77, 0.35); border-radius: 8px; padding: 0.6em 0.8em; color: #FFD700; font-size: 1.05em; cursor: pointer; text-align: left;"
        >
          <span aria-hidden="true">🔥</span>
          <span style="font-weight: 600;">Campfire Lore</span>
          {summary.length > 0 && (
            <span style="display: flex; flex-direction: column; color: #d8c06a; font-size: 0.82em; font-weight: 400; line-height: 1.4;">
              {summary.map(part => <span>{part}</span>)}
            </span>
          )}
          <i
            class={`fas fa-chevron-${expanded ? 'up' : 'down'}`}
            aria-hidden="true"
            style="margin-left: auto; font-size: 0.8em;"
          />
        </button>
        {expanded && (
          <div style="margin-top: 0.6em;">
            {contentEntries.value.map(renderContentEntry)}
          </div>
        )}
      </section>
    );
  };

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

      {renderGoalContentSection()}

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
