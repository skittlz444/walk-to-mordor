/**
 * Daily encounter roll trigger.
 *
 * Runs once from the Preact bootstrap on journey and map pages, asks the
 * server for today's roll, and mounts the encounter modal through the global
 * Preact bridge that index.tsx installs. Deferring to another open modal is
 * handled here so two dialogs are never visible at once.
 */

import { getAuthHeaders } from './auth';
import { sessionToken } from '../stores/appStore';
import { parseEncounterRollResponse } from '../types/encounter';
import type { EncounterOffer } from '../types/encounter';

const ROLL_ENDPOINT = '/api/events/daily-roll';
const ALLOWED_PATHS = new Set(['/', '/journey', '/map']);
const OPEN_MODAL_SELECTOR = '[role="dialog"][aria-modal="true"], .modal-overlay';
const MOUNT_CLASS = 'encounter-popup-mount';

let mountedContainer: HTMLDivElement | null = null;
let deferObserver: MutationObserver | null = null;
let rollInFlight = false;

function hasOpenModalDialog(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>(OPEN_MODAL_SELECTOR)).some((element) => {
    // Ignore the modal this module mounted (it only matches after mounting).
    if (mountedContainer?.contains(element)) return false;
    if (element.hidden) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

function stopDeferObserver(): void {
  deferObserver?.disconnect();
  deferObserver = null;
}

/** Null-returning component used to unmount the island without `render(null)`. */
function EmptyComponent(): null {
  return null;
}

function mountIsland(offer: EncounterOffer): void {
  const preact = window.preact;
  const island = window.preactIslands?.EncounterPopupIsland;

  if (!preact || typeof island !== 'function') {
    console.error('encounterTrigger: Preact encounter island is not registered');
    return;
  }

  const container = document.createElement('div');
  container.className = MOUNT_CLASS;
  document.body.appendChild(container);
  mountedContainer = container;

  const close = () => {
    preact.render(preact.h(EmptyComponent, null), container);
    container.remove();
    if (mountedContainer === container) {
      mountedContainer = null;
    }
  };

  preact.render(preact.h(island, { offer, onClose: close }), container);
}

function mountWhenNoModalIsOpen(offer: EncounterOffer): void {
  if (mountedContainer) return;

  if (!hasOpenModalDialog()) {
    mountIsland(offer);
    return;
  }

  // One observer at a time: a concurrent trigger must not stack watchers.
  stopDeferObserver();

  const tryMount = () => {
    if (mountedContainer) {
      stopDeferObserver();
      return;
    }
    if (hasOpenModalDialog()) return;

    stopDeferObserver();
    mountIsland(offer);
  };

  deferObserver = new MutationObserver(tryMount);
  deferObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['role', 'aria-modal', 'class', 'style', 'hidden'],
  });
}

/**
 * Roll for today's encounter and show the modal when an offer comes back.
 * Never throws: every failure is logged and leaves the page untouched.
 */
export async function triggerEncounterRoll(): Promise<void> {
  if (!ALLOWED_PATHS.has(window.location.pathname)) return;
  if (!sessionToken.value) return;
  if (mountedContainer || rollInFlight) return;

  rollInFlight = true;
  try {
    const response = await fetch(ROLL_ENDPOINT, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      console.error(`encounterTrigger: daily roll failed (${response.status})`);
      return;
    }

    const payload: unknown = await response.json();
    const offer = parseEncounterRollResponse(payload);
    if (!offer) return;

    mountWhenNoModalIsOpen(offer);
  } catch (error) {
    console.error('encounterTrigger: failed to roll for an encounter', error);
  } finally {
    rollInFlight = false;
  }
}

/** Test-only reset for the module-level mount/observer state. */
export function resetEncounterTriggerForTests(): void {
  stopDeferObserver();
  mountedContainer?.remove();
  mountedContainer = null;
  rollInFlight = false;
}
