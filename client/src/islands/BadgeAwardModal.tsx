import { useEffect, useRef, useState } from 'preact/hooks';
import type { TargetedEvent } from 'preact';
import { getAuthHeaders } from '../utils/auth';
import { sessionToken } from '../stores/appStore';
import {
  acknowledgeError,
  acknowledgeInFlight,
  advanceAward,
  awardModalMode,
  awardModalVisible,
  claimPendingFetch,
  clearPendingQueue,
  currentAwardIndex,
  mergePendingAwards,
  openAcknowledgeMode,
  openViewOnlyMode,
  pendingAwards,
  resumePendingAfterViewOnly,
  setPendingAwards,
  triggerElement,
  viewOnlyBadge,
} from '../stores/badgeAwardModalStore';
import type {
  BadgeAwardEntry,
  BadgeAwardPresentation,
  PendingAward,
} from '../stores/badgeAwardModalStore';

const IMAGE_SLUG_PATTERN = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const RANK_LABEL_PATTERN = /^[a-z0-9-]+$/;

const PENDING_ENDPOINT = '/api/achievements/pending';
const ACKNOWLEDGE_ENDPOINT = '/api/achievements/acknowledge';
const OPEN_EVENT = 'wtm:open-badge-modal';
const WALK_SAVED_EVENT = 'wtm:walk-saved';

const OPEN_MODAL_SELECTOR = '[role="dialog"][aria-modal="true"], .modal-overlay';
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const ACKNOWLEDGE_FAILED_MESSAGE = 'We could not acknowledge this badge. Please try again.';

/** SQLite timestamps use a space separator; the DOM needs an ISO value. */
function normalizeTimestamp(value: string): string {
  return value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
}

/**
 * Artwork name used by the 200 px thumb and 1024 px full image.
 * Mirrors the badge grid contract: repeatables use their rank variant,
 * fixed-rank badges use the plain slug. Null or malformed slugs return null so
 * no request is made.
 */
function imageNameFor(entry: BadgeAwardEntry, presentation: BadgeAwardPresentation | null): string | null {
  const slug = entry.image_slug;
  if (!slug || !IMAGE_SLUG_PATTERN.test(slug)) return null;

  if (entry.is_repeatable) {
    const rankLabel = presentation?.rank_label;
    if (rankLabel && RANK_LABEL_PATTERN.test(rankLabel)) {
      return `${slug}--${rankLabel}`;
    }
  }

  return slug;
}

function formatEarnedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(normalizeTimestamp(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function hasOpenModalDialog(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>(OPEN_MODAL_SELECTOR)).some((element) => {
    if (element.hidden) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

interface BadgeArtworkProps {
  entry: BadgeAwardEntry;
  presentation: BadgeAwardPresentation | null;
}

/**
 * Progressive artwork: the 200 px thumbnail shows immediately and the 1024 px
 * full image crossfades over it once loaded. A failed rank variant retries the
 * base image; two failures hide the image area entirely. The component is
 * keyed per award so its fallback state does not leak between queue entries.
 */
function BadgeArtwork({ entry, presentation }: BadgeArtworkProps) {
  const [fullState, setFullState] = useState<'primary' | 'base' | 'failed'>('primary');
  const [thumbState, setThumbState] = useState<'primary' | 'base' | 'failed'>('primary');
  const [fullLoaded, setFullLoaded] = useState(false);

  const primaryName = imageNameFor(entry, presentation);
  const baseSlug = entry.image_slug && IMAGE_SLUG_PATTERN.test(entry.image_slug)
    ? entry.image_slug
    : null;

  if (!primaryName || fullState === 'failed') return null;

  const fullName = fullState === 'base' ? baseSlug : primaryName;
  const thumbName = thumbState === 'failed'
    ? null
    : thumbState === 'base'
      ? baseSlug
      : primaryName;
  const fullSrc = fullName ? `/img/achievements/full/${fullName}.webp` : null;
  const thumbSrc = thumbName ? `/img/achievements/${thumbName}-thumb.webp` : null;

  const handleFullError = () => {
    setFullLoaded(false);
    if (fullState === 'primary' && baseSlug && baseSlug !== primaryName) {
      setFullState('base');
      return;
    }
    setFullState('failed');
  };

  const handleThumbError = () => {
    if (thumbState === 'primary' && baseSlug && baseSlug !== primaryName) {
      setThumbState('base');
      return;
    }
    setThumbState('failed');
  };

  return (
    <div className="badge-award__art">
      {thumbSrc && (
        <img
          className="badge-award__thumb"
          src={thumbSrc}
          alt=""
          aria-hidden="true"
          onError={handleThumbError}
        />
      )}
      {fullSrc && (
        <img
          className={`badge-award__full${fullLoaded ? ' is-loaded' : ''}`}
          src={fullSrc}
          alt={`${entry.name} badge artwork`}
          onLoad={() => setFullLoaded(true)}
          onError={handleFullError}
        />
      )}
    </div>
  );
}

/**
 * Globally mounted badge award modal.
 *
 * On hydration it fetches pending awards once per page view and presents them
 * oldest-first. Badge cards open the same modal in view-only mode through the
 * `wtm:open-badge-modal` document event; that never acknowledges anything and
 * leaves the pending queue available to resume afterwards.
 */
export function BadgeAwardModal() {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const retryRef = useRef<HTMLButtonElement | null>(null);
  const mountedRef = useRef(true);
  const observerRef = useRef<MutationObserver | null>(null);
  const wasVisibleRef = useRef(false);
  const retryActionRef = useRef<'advance' | 'dismiss'>('advance');
  const dismissRef = useRef<() => void>(() => {});
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);

  const visible = awardModalVisible.value;
  const mode = awardModalMode.value;
  const queue = pendingAwards.value;
  const index = currentAwardIndex.value;
  const error = acknowledgeError.value;
  const inFlight = acknowledgeInFlight.value;
  const viewOnly = viewOnlyBadge.value;

  const currentAward: PendingAward | null = mode === 'acknowledge' ? queue[index] ?? null : null;
  const badge: PendingAward | BadgeAwardEntry | null = mode === 'acknowledge' ? currentAward : viewOnly;

  function openWhenNoModalIsOpen(): void {
    if (awardModalVisible.value) return;

    const tryOpen = () => {
      if (!mountedRef.current) return;
      if (hasOpenModalDialog()) return;

      observerRef.current?.disconnect();
      observerRef.current = null;
      openAcknowledgeMode();
    };

    if (!hasOpenModalDialog()) {
      tryOpen();
      return;
    }

    // Another modal is open; queue the request rather than dropping the awards.
    observerRef.current = new MutationObserver(tryOpen);
    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'aria-modal', 'class', 'style', 'hidden'],
    });
  }

  /**
   * Fetch the pending queue once. Returns null when the request failed or the
   * component unmounted; never throws, never sets the acknowledge error, and
   * never retries on its own.
   */
  async function requestPendingAwards(): Promise<PendingAward[] | null> {
    try {
      const response = await fetch(PENDING_ENDPOINT, { headers: getAuthHeaders() });
      if (!mountedRef.current) return null;

      if (!response.ok) {
        if (response.status !== 401) {
          console.error(`BadgeAwardModal: failed to load pending awards (${response.status})`);
        }
        return null;
      }

      const data = await response.json() as { pending?: unknown };
      if (!mountedRef.current) return null;

      return Array.isArray(data.pending) ? data.pending as PendingAward[] : [];
    } catch (error) {
      if (mountedRef.current) {
        console.error('BadgeAwardModal: failed to load pending awards', error);
      }
      return null;
    }
  }

  /**
   * Run one pending check.
   *
   * Hydration replaces the queue; a save-triggered check merges into it so an
   * open modal keeps its position. At most one request is in flight, with at
   * most one queued re-run, so a save during a check is never lost and two
   * checks never overlap.
   */
  async function runPendingCheck(mode: 'hydrate' | 'merge'): Promise<void> {
    let nextMode = mode;

    while (true) {
      if (refreshInFlightRef.current) {
        if (nextMode === 'merge') refreshQueuedRef.current = true;
        return;
      }

      refreshInFlightRef.current = true;
      try {
        const awards = await requestPendingAwards();
        if (awards && awards.length > 0) {
          if (nextMode === 'hydrate') {
            setPendingAwards(awards);
          } else {
            mergePendingAwards(awards);
          }
          openWhenNoModalIsOpen();
        }
      } finally {
        refreshInFlightRef.current = false;
      }

      if (!refreshQueuedRef.current) return;
      refreshQueuedRef.current = false;
      nextMode = 'merge';
    }
  }

  // Pending fetch: strictly once per page view. No token, 401, failure, and an
  // empty list all render nothing and never retry in this page view.
  useEffect(() => {
    mountedRef.current = true;

    const cleanup = () => {
      mountedRef.current = false;
      observerRef.current?.disconnect();
      observerRef.current = null;
    };

    if (!sessionToken.value || !claimPendingFetch()) {
      return cleanup;
    }

    void runPendingCheck('hydrate');
    return cleanup;
  }, []);

  // Badge grid activation opens the same modal without acknowledging anything.
  useEffect(() => {
    function handleOpenEvent(event: Event) {
      const detail = (event as CustomEvent<BadgeAwardEntry>).detail;
      if (!detail || typeof detail !== 'object' || typeof detail.name !== 'string') return;

      const active = document.activeElement;
      const trigger = active instanceof HTMLElement && active !== document.body ? active : null;
      openViewOnlyMode(detail, trigger);
    }

    document.addEventListener(OPEN_EVENT, handleOpenEvent);
    return () => document.removeEventListener(OPEN_EVENT, handleOpenEvent);
  }, []);

  // A successful walk save may have awarded badges server-side. Check the queue
  // in place so the celebration appears without a reload. Deletes never award.
  useEffect(() => {
    function handleWalkSaved(event: Event) {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (action === 'delete') return;
      if (!sessionToken.value) return;
      void runPendingCheck('merge');
    }

    document.addEventListener(WALK_SAVED_EVENT, handleWalkSaved);
    return () => document.removeEventListener(WALK_SAVED_EVENT, handleWalkSaved);
  }, []);

  async function acknowledge(action: 'advance' | 'dismiss'): Promise<void> {
    const award = pendingAwards.value[currentAwardIndex.value];
    if (!award || acknowledgeInFlight.value) return;

    retryActionRef.current = action;
    acknowledgeInFlight.value = true;
    acknowledgeError.value = null;

    try {
      const response = await fetch(ACKNOWLEDGE_ENDPOINT, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ instance_ids: [award.instance_id] }),
      });

      if (!response.ok) {
        throw new Error(`Acknowledge failed (${response.status})`);
      }

      acknowledgeInFlight.value = false;
      if (action === 'dismiss') {
        clearPendingQueue();
        return;
      }
      advanceAward();
    } catch (requestError) {
      acknowledgeInFlight.value = false;
      acknowledgeError.value = ACKNOWLEDGE_FAILED_MESSAGE;
      console.error('BadgeAwardModal: failed to acknowledge award', requestError);
    }
  }

  function handleDismiss(): void {
    if (awardModalMode.value === 'view-only') {
      resumePendingAfterViewOnly();
      return;
    }

    const award = pendingAwards.value[currentAwardIndex.value];
    if (!award) {
      clearPendingQueue();
      return;
    }

    if (award.is_repeatable) {
      // Closing a repeatable award is an acknowledgement so it does not nag.
      void acknowledge('dismiss');
      return;
    }

    // A one-off award stays pending for a later visit when dismissed.
    clearPendingQueue();
  }

  dismissRef.current = handleDismiss;

  function handleContinue(): void {
    void acknowledge('advance');
  }

  function handleRetry(): void {
    void acknowledge(retryActionRef.current);
  }

  function handleOverlayClick(event: TargetedEvent<HTMLDivElement, MouseEvent>): void {
    if (event.target === event.currentTarget) {
      handleDismiss();
    }
  }

  function trapFocus(event: KeyboardEvent): void {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusables.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !dialog.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last || !dialog.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  // Escape closes with the same repeatability-aware semantics as the control.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!awardModalVisible.value) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        dismissRef.current();
        return;
      }
      if (event.key === 'Tab') {
        trapFocus(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus into the dialog on open/advance, and restore the trigger on close.
  useEffect(() => {
    if (visible) {
      const target = error
        ? retryRef.current
        : mode === 'acknowledge'
          ? primaryRef.current ?? dialogRef.current
          : closeRef.current ?? dialogRef.current;
      target?.focus();
    } else if (wasVisibleRef.current) {
      const trigger = triggerElement.value;
      if (trigger && trigger.isConnected) {
        trigger.focus();
      }
    }

    wasVisibleRef.current = visible;
  }, [visible, mode, index, error]);

  if (!visible || !badge) return null;

  const presentation = badge.presentation ?? null;
  const rankLabel = presentation?.rank_label ?? null;
  const isAcknowledge = mode === 'acknowledge';

  const earnedAt = isAcknowledge
    ? currentAward?.earned_at ?? null
    : viewOnly?.last_earned_at ?? viewOnly?.first_earned_at ?? null;
  const earnedLabel = formatEarnedDate(earnedAt);

  const repeatLabel = badge.is_repeatable
    ? `Earned ${badge.earned_count} ${badge.earned_count === 1 ? 'time' : 'times'}`
    : null;

  const positionText = isAcknowledge
    ? `Badge ${index + 1} of ${queue.length}`
    : null;
  const isLastAward = isAcknowledge && index + 1 >= queue.length;

  return (
    <div className="modal-overlay badge-award-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-dialog badge-award-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={badge.name}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="modal-content badge-award__content">
          <div className="badge-award__topbar">
            {positionText
              ? <p className="badge-award__position" role="status">{positionText}</p>
              : <span className="badge-award__position-spacer" aria-hidden="true" />}
            <button
              type="button"
              className="badge-award__close"
              aria-label="Close award"
              onClick={handleDismiss}
              ref={closeRef}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="badge-award__scroll">
            <BadgeArtwork
              key={`${mode}-${badge.slug}-${currentAward?.instance_id ?? 'view'}-${rankLabel ?? ''}`}
              entry={badge}
              presentation={presentation}
            />

            <div className="badge-award__details">
              <h2 className="badge-award__name">{badge.name}</h2>

              <div className="badge-award__meta">
                {rankLabel && (
                  <span className="badge-award__chip badge-award__chip--rank">
                    Rank: {rankLabel}
                  </span>
                )}
                {repeatLabel && (
                  <span className="badge-award__chip badge-award__chip--repeat">
                    {repeatLabel}
                  </span>
                )}
              </div>

              {earnedAt && (
                <p className="badge-award__date">
                  Earned <time dateTime={normalizeTimestamp(earnedAt)}>{earnedLabel ?? earnedAt}</time>
                </p>
              )}

              {badge.description && (
                <p className="badge-award__description">{badge.description}</p>
              )}
            </div>
          </div>

          <div className="badge-award__actions">
            {error && (
              <p className="badge-award__error" role="alert">{error}</p>
            )}

            {error ? (
              <button
                type="button"
                className="badge-award__primary"
                onClick={handleRetry}
                disabled={inFlight}
                ref={retryRef}
              >
                {inFlight ? 'Retrying…' : 'Retry'}
              </button>
            ) : isAcknowledge ? (
              <button
                type="button"
                className="badge-award__primary"
                onClick={handleContinue}
                disabled={inFlight}
                ref={primaryRef}
              >
                {inFlight ? 'Collecting…' : isLastAward ? 'Collect badge' : 'Continue'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}