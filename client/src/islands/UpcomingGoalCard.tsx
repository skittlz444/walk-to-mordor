import type { Goal } from '../types/goal';

interface UpcomingGoalCardProps {
  goal: Goal;
  currentDistance: number;
  locked?: boolean;
  onClick: () => void;
}

/**
 * UpcomingGoalCard - Preact Island for upcoming goals beyond the next goal
 * Displays goals without progress bar since they're further away
 */
export function UpcomingGoalCard({ goal, currentDistance, locked = false, onClick }: UpcomingGoalCardProps) {
  const distanceToGo = goal.distance - currentDistance;

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
    </div>
  );
}
