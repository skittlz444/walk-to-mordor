import { signal } from '@preact/signals';

/**
 * Shared state for the globally mounted BadgeAwardModal island.
 *
 * The pack-backed badge grid and the modal communicate through a
 * `wtm:open-badge-modal` CustomEvent; neither island imports the other. This
 * store only holds the modal's own state so the pending queue survives a
 * view-only detour and can be resumed afterwards.
 */

export type BadgeAwardModalMode = 'acknowledge' | 'view-only';

export interface BadgeAwardCollection {
  slug: string;
  label: string;
  index: number;
  size: number;
}

export interface BadgeAwardPresentation {
  rank?: number;
  rank_label?: string;
  storyline?: string | null;
  collection?: BadgeAwardCollection | null;
}

/** Shape of one entry from `GET /api/achievements/pending`. */
export interface PendingAward {
  instance_id: number;
  earned_at: string;
  earned_count: number;
  slug: string;
  name: string;
  description?: string | null;
  image_slug: string | null;
  badge_type?: string;
  is_repeatable: boolean;
  presentation?: BadgeAwardPresentation | null;
}

/**
 * Shape of a badge grid entry, narrowed to what the view-only modal needs.
 * Structurally compatible with `BadgeDisplayIsland`'s `BadgeAchievement`
 * without importing the grid (keeps the islands independent).
 */
export interface BadgeAwardEntry {
  slug: string;
  name: string;
  description?: string | null;
  image_slug: string | null;
  badge_type?: string;
  is_repeatable: boolean;
  earned_count: number;
  first_earned_at?: string;
  last_earned_at?: string;
  presentation?: BadgeAwardPresentation | null;
}

/** Whether the modal is mounted in the DOM. */
export const awardModalVisible = signal<boolean>(false);

/** Acknowledge queue mode, or view-only when opened by a badge card. */
export const awardModalMode = signal<BadgeAwardModalMode>('acknowledge');

/** Unacknowledged awards fetched for this page view, oldest first. */
export const pendingAwards = signal<PendingAward[]>([]);

/** Index into `pendingAwards` currently displayed in acknowledge mode. */
export const currentAwardIndex = signal<number>(0);

/** True while an acknowledge request is in flight. */
export const acknowledgeInFlight = signal<boolean>(false);

/** Human-readable message when the last acknowledge attempt failed. */
export const acknowledgeError = signal<string | null>(null);

/** Badge payload driving view-only mode. */
export const viewOnlyBadge = signal<BadgeAwardEntry | null>(null);

/** Element that opened view-only mode, used to restore focus on close. */
export const triggerElement = signal<HTMLElement | null>(null);

let pendingFetchIssued = false;

/**
 * Claim the single pending fetch for this page view.
 *
 * @returns true when the caller should fetch, false when one was already made.
 */
export function claimPendingFetch(): boolean {
  if (pendingFetchIssued) return false;
  pendingFetchIssued = true;
  return true;
}

/** Replace the pending queue and start at its first entry. */
export function setPendingAwards(awards: PendingAward[]): void {
  pendingAwards.value = awards;
  currentAwardIndex.value = 0;
}

/** Open the acknowledge queue if there is something to show and nothing else is open. */
export function openAcknowledgeMode(): void {
  if (awardModalVisible.value) return;
  if (pendingAwards.value.length <= currentAwardIndex.value) return;
  awardModalMode.value = 'acknowledge';
  viewOnlyBadge.value = null;
  acknowledgeError.value = null;
  awardModalVisible.value = true;
}

/**
 * Open a badge card in view-only mode. A pending acknowledge queue (if any)
 * is kept untouched and resumed when this view-only modal closes.
 */
export function openViewOnlyMode(badge: BadgeAwardEntry, trigger: HTMLElement | null): void {
  if (!awardModalVisible.value || awardModalMode.value !== 'view-only') {
    triggerElement.value = trigger;
  }
  awardModalMode.value = 'view-only';
  viewOnlyBadge.value = badge;
  acknowledgeError.value = null;
  awardModalVisible.value = true;
}

/** Hide the modal without touching the pending queue. */
function hideAwardModal(): void {
  awardModalVisible.value = false;
  viewOnlyBadge.value = null;
  acknowledgeError.value = null;
}

/** Advance to the next pending award; closes when the queue is exhausted. */
export function advanceAward(): void {
  const nextIndex = currentAwardIndex.value + 1;
  acknowledgeError.value = null;

  if (nextIndex >= pendingAwards.value.length) {
    pendingAwards.value = [];
    currentAwardIndex.value = 0;
    hideAwardModal();
    return;
  }

  currentAwardIndex.value = nextIndex;
}

/** Drop the in-memory queue after closing (unacknowledged awards remain server-side). */
export function clearPendingQueue(): void {
  pendingAwards.value = [];
  currentAwardIndex.value = 0;
  hideAwardModal();
}

/**
 * After a view-only modal closes, resume the deferred acknowledge queue when
 * awards remain; otherwise close fully.
 */
export function resumePendingAfterViewOnly(): void {
  viewOnlyBadge.value = null;
  if (pendingAwards.value.length > currentAwardIndex.value) {
    awardModalMode.value = 'acknowledge';
    acknowledgeError.value = null;
    awardModalVisible.value = true;
    return;
  }
  hideAwardModal();
}

/** Reset all modal state. Test-only; production pages re-initialize on load. */
export function resetBadgeAwardModalStore(): void {
  awardModalVisible.value = false;
  awardModalMode.value = 'acknowledge';
  pendingAwards.value = [];
  currentAwardIndex.value = 0;
  acknowledgeInFlight.value = false;
  acknowledgeError.value = null;
  viewOnlyBadge.value = null;
  triggerElement.value = null;
  pendingFetchIssued = false;
}
