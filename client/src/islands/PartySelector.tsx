/**
 * PartySelector - Preact Island for toggling between personal and party views.
 *
 * Fetches user's active parties on mount.
 * Hidden if user has no parties.
 * Shows dropdown + inline member count when party is selected.
 * Persists selection to localStorage.
 * Handles 403/404 fallback to personal view.
 *
 * @see Story 3.6 - Fellowship UI
 */

import { useEffect, useCallback } from 'preact/hooks';
import {
  userParties,
  selectedView,
  partyProgress,
  partiesLoading,
  progressLoading,
  hasParties,
  isPartyView,
  selectedParty,
  fetchUserParties,
  selectView,
  consumeNewlyPassedMilestones,
  type PartySelection,
  type PartyProgress,
} from '../stores/partyStore';
import type { Goal } from '../types/goal';

export interface PartySelectorProps {
  /** 'journey' or 'map' — affects layout */
  variant?: 'journey' | 'map';
  /** Callback when view changes. Receives party progress or null for personal. */
  onViewChange?: (selection: PartySelection, progress: PartyProgress | null) => void;
  /** Callback for newly passed milestones */
  onNewMilestones?: (milestones: Goal[]) => void;
}

export function PartySelector({ variant = 'journey', onViewChange, onNewMilestones }: PartySelectorProps) {
  // Fetch parties on mount
  useEffect(() => {
    fetchUserParties();
  }, []);

  // Auto-fetch progress for persisted party selection after parties load
  useEffect(() => {
    if (userParties.value.length > 0 && selectedView.value !== 'personal') {
      handleSelect(selectedView.value);
    }
  }, [userParties.value.length]);

  const handleSelect = useCallback(async (value: PartySelection) => {
    const progress = await selectView(value);

    // Determine the effective selection after selectView resolves.
    // If progress is null, treat it as a fallback to personal view.
    const effectiveSelection: PartySelection =
      progress === null ? 'personal' : selectedView.value;

    if (onViewChange) {
      onViewChange(effectiveSelection, progress);
    }

    // Check for newly passed milestones (only meaningful for a party view)
    if (
      progress &&
      effectiveSelection !== 'personal' &&
      typeof effectiveSelection === 'number' &&
      progress.newly_passed_milestones &&
      progress.newly_passed_milestones.length > 0 &&
      onNewMilestones
    ) {
      const newMilestones = consumeNewlyPassedMilestones(effectiveSelection, progress.newly_passed_milestones);
      if (newMilestones.length > 0) {
        onNewMilestones(newMilestones);
      }
    }
  }, [onViewChange, onNewMilestones]);

  const handleChange = useCallback((e: Event) => {
    const target = e.target as HTMLSelectElement;
    const value = target.value === 'personal' ? 'personal' : Number(target.value);
    handleSelect(value);
  }, [handleSelect]);

  // Don't render if loading parties or no parties exist
  if (partiesLoading.value && userParties.value.length === 0) {
    return null;
  }

  if (!hasParties.value) {
    return null;
  }

  const isMapVariant = variant === 'map';

  return (
    <div className={`party-selector ${isMapVariant ? 'party-selector--map' : 'party-selector--journey'}`}>
      <div className="party-selector__controls">
        <label className="party-selector__label" htmlFor="party-view-select">
          <i className="fas fa-users" aria-hidden="true" style={{ marginRight: '0.4em' }}></i>
          View:
        </label>
        <select
          id="party-view-select"
          className="party-selector__dropdown"
          value={String(selectedView.value)}
          onChange={handleChange}
          disabled={progressLoading.value}
        >
          <option value="personal">Personal</option>
          {userParties.value.map(party => (
            <option key={party.id} value={String(party.id)}>
              {party.name}
            </option>
          ))}
        </select>
        {progressLoading.value && (
          <span className="party-selector__loading" aria-label="Loading">
            <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
          </span>
        )}
      </div>

      {isPartyView.value && selectedParty.value && partyProgress.value && (
        <span className="party-selector__members">
          ({partyProgress.value.member_count} {partyProgress.value.member_count === 1 ? 'member' : 'members'})
        </span>
      )}
    </div>
  );
}
