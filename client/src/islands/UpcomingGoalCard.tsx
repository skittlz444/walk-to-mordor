import type { Goal } from '../types/goal';
import { useEffect } from 'preact/hooks';
import { recordGoalContentEvent } from '../utils/goalContentEvents';

interface UpcomingGoalCardProps {
  goal: Goal;
  currentDistance: number;
  locked?: boolean;
  onClick: () => void;
  partyId?: number | null;
}

/**
 * UpcomingGoalCard - Preact Island for upcoming goals beyond the next goal
 * Displays goals without progress bar since they're further away
 */
export function UpcomingGoalCard({ goal, currentDistance, locked = false, onClick, partyId = null }: UpcomingGoalCardProps) {
  const distanceToGo = goal.distance - currentDistance;
  const showContentTeaser = locked && goal.has_content === true;

  useEffect(() => {
    if (showContentTeaser) {
      recordGoalContentEvent({ goalId: goal.id, eventType: 'teaser_impression', partyId });
    }
  }, [showContentTeaser, goal.id, partyId]);

  return (
    <div className={`upcoming-goal${locked ? ' goal-locked-interactive' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
      {goal.special && (
        <span className="goal-special">{goal.special}</span>
      )}

      <span className="goal-title">
        {locked && <i class="fas fa-lock" style="margin-right: 0.4em; font-size: 0.85em; color: #888;" aria-hidden="true" />}
        {goal.title}
      </span>

      <span className="goal-distance">
        {goal.distance.toFixed(2)} km{' '}
        <span className="goal-distance-to-go">
          ({distanceToGo.toFixed(2)} km to go)
        </span>
      </span>

      {showContentTeaser && (
        <div
          className="goal-content-teaser"
          aria-label="Locked campfire lore available"
          style="margin-top: 0.7em; width: 100%; padding: 0.55em 0.7em; border: 1px solid rgba(255, 215, 0, 0.35); border-radius: 8px; background: rgba(255, 215, 0, 0.08); color: #d8c06a; font-size: 0.85em; text-align: center; box-sizing: border-box;"
        >
          🔥 Campfire lore waits beyond this milestone
          <div style="margin-top: 0.25em; filter: blur(3px); color: #aaa; user-select: none;" aria-hidden="true">
            Ancient words and hidden tales...
          </div>
        </div>
      )}
    </div>
  );
}
