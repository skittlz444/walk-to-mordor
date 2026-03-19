/**
 * Party State Management Store
 *
 * Centralized reactive state for party/fellowship selection.
 * Uses Preact Signals for reactive updates across islands.
 *
 * Shared between Journey page and Map page.
 */

import { signal, computed } from '@preact/signals';
import type { Goal } from '../types/goal';
import { getAuthHeaders } from '../utils/auth';

// ============================================================================
// Types
// ============================================================================

export interface Party {
  id: number;
  name: string;
  role: string;
  distance_mode: string;
  leave_distance_behavior: string;
  dissolved_at: string | null;
  active_member_count: number;
}

export interface PartyMember {
  user_id: number;
  display_name: string;
  contribution: number;
  status: string;
  color: number;
  avatar_id: string | null;
}

export interface PartyProgress {
  total_distance: number;
  member_count: number;
  calculated_position: { id: number; title: string; distance: number } | null;
  distance_mode: string;
  leave_distance_behavior: string;
  members: PartyMember[];
  newly_passed_milestones: Goal[];
}

/** Selection can be 'personal' or a party ID */
export type PartySelection = 'personal' | number;

// ============================================================================
// LocalStorage keys
// ============================================================================

const LS_KEY_SELECTED_VIEW = 'wtm_party_view';

// ============================================================================
// Core Signals
// ============================================================================

/** List of user's active parties. Empty until fetched. */
export const userParties = signal<Party[]>([]);

/** Current selection: 'personal' or party ID */
export const selectedView = signal<PartySelection>(loadPersistedView());

/** Party progress data for the selected party. null when personal or loading. */
export const partyProgress = signal<PartyProgress | null>(null);

/** Loading state for party list fetch */
export const partiesLoading = signal(false);

/** Loading state for party progress fetch */
export const progressLoading = signal(false);

/** Error from party operations */
export const partyError = signal<string | null>(null);

/** Track which party IDs have triggered milestone modals in this session */
const triggeredMilestones = new Set<string>();

// ============================================================================
// Computed Signals
// ============================================================================

/** Whether the user has any parties (selector should be visible) */
export const hasParties = computed(() => userParties.value.length > 0);

/** Whether we're viewing a party (not personal) */
export const isPartyView = computed(() => selectedView.value !== 'personal');

/** The currently selected party object, if any */
export const selectedParty = computed(() => {
  if (selectedView.value === 'personal') return null;
  return userParties.value.find(p => p.id === selectedView.value) ?? null;
});

/** Effective distance for display: personal total or party total */
export const viewDistance = computed(() => {
  if (selectedView.value === 'personal' || !partyProgress.value) return null;
  return partyProgress.value.total_distance;
});

// ============================================================================
// Actions
// ============================================================================

/** Load persisted view selection from localStorage */
function loadPersistedView(): PartySelection {
  try {
    const stored = localStorage.getItem(LS_KEY_SELECTED_VIEW);
    if (!stored || stored === 'personal') return 'personal';
    const id = Number(stored);
    return Number.isInteger(id) && id > 0 ? id : 'personal';
  } catch {
    return 'personal';
  }
}

/** Persist the current view selection to localStorage */
function persistView(selection: PartySelection): void {
  try {
    localStorage.setItem(LS_KEY_SELECTED_VIEW, String(selection));
  } catch {
    // localStorage unavailable
  }
}

/** Clear stale persisted view (on 403/404) */
function clearPersistedView(): void {
  try {
    localStorage.removeItem(LS_KEY_SELECTED_VIEW);
  } catch {
    // localStorage unavailable
  }
}

/**
 * Fetch the user's active parties from the API.
 * Called on component mount.
 */
export async function fetchUserParties(): Promise<void> {
  partiesLoading.value = true;
  partyError.value = null;

  try {
    const response = await fetch('/api/user/parties', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch parties: ${response.status}`);
    }

    const data = await response.json();
    userParties.value = data.parties ?? [];

    // Validate persisted selection still exists
    if (selectedView.value !== 'personal') {
      const partyExists = userParties.value.some(p => p.id === selectedView.value);
      if (!partyExists) {
        selectedView.value = 'personal';
        clearPersistedView();
      }
    }
  } catch (err) {
    console.error('[partyStore] Failed to fetch parties:', err);
    partyError.value = err instanceof Error ? err.message : 'Failed to load parties';
  } finally {
    partiesLoading.value = false;
  }
}

/**
 * Fetch progress data for a specific party.
 * Returns the progress data and handles 403/404 fallback.
 */
export async function fetchPartyProgress(partyId: number): Promise<PartyProgress | null> {
  progressLoading.value = true;

  try {
    const response = await fetch(`/api/party/${partyId}/progress`, {
      headers: getAuthHeaders(),
    });

    if (response.status === 403 || response.status === 404) {
      // Party dissolved or user kicked — fall back silently
      selectedView.value = 'personal';
      partyProgress.value = null;
      clearPersistedView();
      return null;
    }

    if (!response.ok) {
      throw new Error(`Party progress error: ${response.status}`);
    }

    const data = await response.json();
    partyProgress.value = data;
    return data;
  } catch (err) {
    console.error('[partyStore] Failed to fetch party progress:', err);
    partyError.value = err instanceof Error ? err.message : 'Failed to load party progress';
    return null;
  } finally {
    progressLoading.value = false;
  }
}

/**
 * Select a view (personal or party).
 * Fetches party progress if a party is selected.
 * Returns newly passed milestones if any (for modal triggering).
 */
export async function selectView(selection: PartySelection): Promise<PartyProgress | null> {
  selectedView.value = selection;
  persistView(selection);

  if (selection === 'personal') {
    partyProgress.value = null;
    return null;
  }

  const progress = await fetchPartyProgress(selection);
  return progress;
}

/**
 * Check if a party's milestones have been triggered this session.
 * Used to avoid re-triggering modals on simple party toggle.
 */
export function hasTriggeredMilestones(partyId: number, milestoneDistance: number): boolean {
  const key = `${partyId}_${milestoneDistance}`;
  return triggeredMilestones.has(key);
}

/**
 * Mark a party milestone as triggered this session.
 */
export function markMilestoneTriggered(partyId: number, milestoneDistance: number): void {
  const key = `${partyId}_${milestoneDistance}`;
  triggeredMilestones.add(key);
}

/**
 * Filter newly-passed milestones to only those not yet triggered this session,
 * mark them all as triggered, and return them.
 *
 * Centralises the filter-then-mark pattern so callers (PartySelector, MapIsland)
 * stay consistent.
 *
 * @param partyId   The party whose milestones are being processed.
 * @param milestones Milestones returned by the progress API.
 * @returns The subset of milestones that were not previously triggered.
 */
export function consumeNewlyPassedMilestones(
  partyId: number,
  milestones: Goal[],
): Goal[] {
  const fresh = milestones.filter(m => !hasTriggeredMilestones(partyId, m.distance));
  fresh.forEach(m => markMilestoneTriggered(partyId, m.distance));
  return fresh;
}
