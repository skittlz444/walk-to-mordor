import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { getAuthHeaders } from '../utils/auth';
import { parseEncounterOffer } from '../types/encounter';
import type { EncounterOffer } from '../types/encounter';

export interface EncounterPopupIslandProps {
  offer: EncounterOffer;
  onClose: () => void;
}

const ACCEPT_ENDPOINT = '/api/events/daily-roll/accept';
const DECLINE_ENDPOINT = '/api/events/daily-roll/decline';
const IMAGE_SLUG_PATTERN = /^[a-z0-9-]+$/;

const SUCCESS_MESSAGE = 'The hunt is on. Outrun the Nazgûl.';
const SUCCESS_CLOSE_DELAY_MS = 4000;
const ACCEPT_ERROR_MESSAGE = 'We could not start this encounter. Please try again.';
const DECLINE_ERROR_MESSAGE = 'We could not decline this encounter. Please try again.';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Keep whole targets whole and fractional targets to one decimal. */
function formatTarget(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Daily encounter offer modal.
 *
 * The offer is re-validated here (not just by the trigger) so a malformed
 * payload renders nothing instead of a partial dialog.
 */
export function EncounterPopupIsland({ offer, onClose }: EncounterPopupIslandProps) {
  const validOffer = parseEncounterOffer(offer);
  if (!validOffer) return null;
  return <EncounterDialog offer={validOffer} onClose={onClose} />;
}

interface EncounterDialogProps {
  offer: EncounterOffer;
  onClose: () => void;
}

function EncounterDialog({ offer, onClose }: EncounterDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const acceptRef = useRef<HTMLButtonElement | null>(null);
  const declineRef = useRef<() => void>(() => {});
  const inFlightRef = useRef(false);
  const closedRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [artworkFailed, setArtworkFailed] = useState(false);

  const titleId = useId();
  const definition = offer.definition;
  const imageSlug = definition.image_slug;
  const artworkSrc = imageSlug && IMAGE_SLUG_PATTERN.test(imageSlug) && !artworkFailed
    ? `/img/highres/${imageSlug}.webp`
    : null;

  function closeOnce(): void {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }

  // Focus moves to the primary action on open and returns to whatever the
  // page had focused before the modal mounted.
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    acceptRef.current?.focus();

    return () => {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (previouslyFocused && previouslyFocused !== document.body && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  async function postChoice(endpoint: string): Promise<boolean> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ encounter_definition_id: definition.id }),
    });
    return response.ok;
  }

  async function handleAccept(): Promise<void> {
    if (inFlightRef.current || accepted || closedRef.current) return;

    inFlightRef.current = true;
    setInFlight(true);
    setError(null);

    try {
      const ok = await postChoice(ACCEPT_ENDPOINT);
      if (!ok) throw new Error('Accept request was rejected');
      setAccepted(true);
      // Brief confirmation so the challenge does not vanish without feedback.
      closeTimerRef.current = setTimeout(closeOnce, SUCCESS_CLOSE_DELAY_MS);
    } catch (requestError) {
      console.error('EncounterPopupIsland: failed to accept encounter', requestError);
      setError(ACCEPT_ERROR_MESSAGE);
    }

    inFlightRef.current = false;
    setInFlight(false);
  }

  async function handleDecline(): Promise<void> {
    if (inFlightRef.current || accepted || closedRef.current) return;

    inFlightRef.current = true;
    setInFlight(true);
    setError(null);

    try {
      const ok = await postChoice(DECLINE_ENDPOINT);
      if (!ok) throw new Error('Decline request was rejected');
      closeOnce();
      return;
    } catch (requestError) {
      console.error('EncounterPopupIsland: failed to decline encounter', requestError);
      setError(DECLINE_ERROR_MESSAGE);
    }

    inFlightRef.current = false;
    setInFlight(false);
  }

  declineRef.current = handleDecline;

  useEffect(() => {
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

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        declineRef.current();
        return;
      }
      if (event.key === 'Tab') {
        trapFocus(event);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const buttonsDisabled = inFlight || accepted;

  return (
    <div className="modal-overlay encounter-popup-overlay">
      <div
        className="modal-dialog encounter-popup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="encounter-popup__content">
          {artworkSrc && (
            <img
              className="encounter-popup__art"
              src={artworkSrc}
              alt={`${definition.name} illustration`}
              onError={() => setArtworkFailed(true)}
            />
          )}

          <h2 className="encounter-popup__title" id={titleId}>{definition.name}</h2>
          <p className="encounter-popup__description">{definition.description}</p>

          <p className="encounter-popup__target">
            Your target: {formatTarget(offer.target)} km
          </p>

          <p className="encounter-popup__coverage">
            Today through <time dateTime={offer.coverageEnd}>{offer.coverageEnd}</time>
          </p>

          <p className="encounter-popup__grace">
            You have until <time dateTime={offer.graceDeadline}>{offer.graceDeadline}</time> to log walks for these days.
          </p>

          {accepted && (
            <p className="encounter-popup__success" role="status">{SUCCESS_MESSAGE}</p>
          )}

          {error && (
            <p className="encounter-popup__error" role="alert">{error}</p>
          )}

          <div className="encounter-popup__actions">
            <button
              type="button"
              className="encounter-popup__accept"
              onClick={() => { void handleAccept(); }}
              disabled={buttonsDisabled}
              ref={acceptRef}
            >
              {inFlight ? 'Accepting…' : 'Accept'}
            </button>
            <button
              type="button"
              className="encounter-popup__decline"
              onClick={() => { void handleDecline(); }}
              disabled={buttonsDisabled}
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
