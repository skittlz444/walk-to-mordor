import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { TargetedEvent } from 'preact';
import { Avatar } from './Avatar';
import { getAuthHeaders } from '../utils/auth';

/**
 * Shared avatar picker modal used by the profile view page and the profile
 * settings page. It owns the `/api/avatars` fetch, the radiogroup gallery,
 * immediate save-on-selection, and the SW-cache / `preferenceChanged` side
 * effects that the old inline profile gallery performed.
 */

const SAVED_STATUS_MS = 1500;

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

type GalleryState = 'loading' | 'ready' | 'error';
type StatusClass = '' | 'saving' | 'saved' | 'error';

export interface AvatarPickerModalProps {
  /** Username used for the initials fallback and avatar alt text. */
  username: string;
  /** Currently selected avatar slug, or null for initials. */
  avatarId: string | null;
  /** Applies a saved selection to the page that opened the modal. */
  onChange: (slug: string | null) => void;
  /** Closes the modal (Escape, backdrop, close button, Done, or 401). */
  onClose: () => void;
}

async function clearServiceWorkerSWRCache(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const message = { type: 'sw-clear-cache' };
  const serviceWorker = navigator.serviceWorker;

  try {
    if (serviceWorker.controller) {
      serviceWorker.controller.postMessage(message);
      return;
    }

    const registration = await serviceWorker.ready;
    registration.active?.postMessage(message);
  } catch {
    // Non-critical: if SW messaging fails, the mutation itself still succeeded.
  }
}

export function AvatarPickerModal({
  username,
  avatarId,
  onChange,
  onClose,
}: AvatarPickerModalProps) {
  const [selected, setSelected] = useState<string | null>(avatarId);
  const [avatars, setAvatars] = useState<string[]>([]);
  const [galleryState, setGalleryState] = useState<GalleryState>('loading');
  const [galleryReloadKey, setGalleryReloadKey] = useState(0);
  const [status, setStatus] = useState('');
  const [statusClass, setStatusClass] = useState<StatusClass>('');

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  const onChangeRef = useRef(onChange);

  onCloseRef.current = onClose;
  onChangeRef.current = onChange;

  // Capture the trigger before focus moves into the dialog, trap Tab inside it,
  // close on Escape, and return focus to the trigger on unmount.
  useEffect(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
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
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (savedTimerRef.current !== null) {
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
      const trigger = triggerRef.current;
      if (trigger?.isConnected) {
        // Defer past the closing event: the browser moves focus to <body>
        // after the focused dialog control is removed, which would otherwise
        // undo a synchronous focus() call.
        queueMicrotask(() => {
          if (trigger.isConnected) trigger.focus();
        });
      }
    };
  }, []);

  // The gallery owns its own fetch so the settings island never requests the
  // avatar list. A 401 closes this modal before redirecting (matching the
  // friend-profile island's expired-session behaviour).
  useEffect(() => {
    let cancelled = false;
    setGalleryState('loading');

    const loadAvatars = async () => {
      try {
        const response = await fetch('/api/avatars', { headers: getAuthHeaders() });
        if (cancelled) return;

        if (response.status === 401) {
          onCloseRef.current();
          window.location.href = '/login';
          return;
        }

        if (!response.ok) {
          setGalleryState('error');
          return;
        }

        const data: unknown = await response.json();
        if (cancelled) return;

        const list = Array.isArray(data)
          ? data.filter((slug): slug is string => typeof slug === 'string')
          : [];

        setAvatars(list);
        setGalleryState('ready');
      } catch {
        if (!cancelled) setGalleryState('error');
      }
    };

    void loadAvatars();

    return () => {
      cancelled = true;
    };
  }, [galleryReloadKey]);

  const saveAvatarChoice = useCallback(async (slug: string | null) => {
    if (savedTimerRef.current !== null) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }

    setStatus('Saving...');
    setStatusClass('saving');

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ avatarId: slug }),
      });

      if (response.status === 401) {
        onCloseRef.current();
        window.location.href = '/login';
        return;
      }

      if (response.ok) {
        setSelected(slug);
        onChangeRef.current(slug);
        setStatus('Saved');
        setStatusClass('saved');
        savedTimerRef.current = setTimeout(() => {
          setStatus('');
          setStatusClass('');
          savedTimerRef.current = null;
        }, SAVED_STATUS_MS);

        void clearServiceWorkerSWRCache();

        window.dispatchEvent(new CustomEvent('preferenceChanged', {
          detail: { avatarId: slug },
        }));
        return;
      }

      let message = 'Failed to save';
      try {
        const data = await response.json() as { error?: unknown };
        if (typeof data.error === 'string' && data.error) {
          message = data.error;
        }
      } catch {
        // Non-JSON error body: keep the generic message.
      }
      setStatus(message);
      setStatusClass('error');
    } catch {
      setStatus('Network error');
      setStatusClass('error');
    }
  }, []);

  const handleGalleryKeyDown = (event: KeyboardEvent) => {
    const gallery = event.currentTarget as HTMLElement;
    const buttons = Array.from(gallery.querySelectorAll<HTMLElement>('.picker-option'));
    const current = document.activeElement as HTMLElement;
    const index = buttons.indexOf(current);
    if (index === -1) return;

    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % buttons.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + buttons.length) % buttons.length;
    }

    if (next >= 0) {
      event.preventDefault();
      buttons[next].focus();
    }
  };

  const handleOverlayClick = (event: TargetedEvent<HTMLDivElement, MouseEvent>) => {
    if (event.target === event.currentTarget) {
      onCloseRef.current();
    }
  };

  return (
    <div className="profile-dialog-overlay" onClick={handleOverlayClick}>
      <div
        className="picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-picker-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <h3 id="avatar-picker-title">
          <span>Choose Avatar</span>
          <button
            type="button"
            className="picker-close"
            aria-label="Close avatar picker"
            onClick={() => onCloseRef.current()}
            ref={closeRef}
          >
            <i className="fas fa-xmark" aria-hidden="true"></i>
          </button>
        </h3>

        {/* The current preview lives outside the gallery so it is visible
            immediately, including while /api/avatars is still loading. */}
        <div className="picker-current">
          <span className="picker-current__preview">
            <Avatar username={username || 'U'} avatarId={selected} size={56} />
          </span>
          <span className="picker-current__label">
            <span className="picker-current__title">Current</span>
            <span className="picker-current__avatar">{selected ?? 'Initials'}</span>
          </span>
        </div>

        <div className="picker-gallery" aria-busy={galleryState === 'loading'}>
          {galleryState === 'loading' && (
            <div className="picker-loading" role="status">
              <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
              Loading avatars…
            </div>
          )}

          {galleryState === 'error' && (
            <div className="picker-gallery-error" role="alert">
              <p>Could not load avatars.</p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setGalleryReloadKey((key) => key + 1)}
              >
                Retry
              </button>
            </div>
          )}

          {galleryState === 'ready' && avatars.length === 0 && (
            <p className="picker-empty">No avatars available.</p>
          )}

          {galleryState === 'ready' && avatars.length > 0 && (
            <div
              className="picker-grid"
              role="radiogroup"
              aria-label="Choose avatar"
              onKeyDown={handleGalleryKeyDown}
            >
              {avatars.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  className="picker-option"
                  data-slug={slug}
                  role="radio"
                  aria-checked={selected === slug ? 'true' : 'false'}
                  aria-label={slug}
                  onClick={() => {
                    if (slug !== selected) void saveAvatarChoice(slug);
                  }}
                >
                  <img
                    src={`/img/avatars/${encodeURIComponent(slug)}.webp`}
                    alt=""
                    width={64}
                    height={64}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`picker-status ${statusClass}`} role="status" aria-live="polite">
          {status}
        </div>

        <div className="picker-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (selected !== null) void saveAvatarChoice(null);
            }}
          >
            <i className="fas fa-undo" aria-hidden="true"></i> Use initials
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onCloseRef.current()}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
