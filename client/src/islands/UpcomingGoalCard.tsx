import type { Goal } from '../types/goal';

interface UpcomingGoalCardProps {
  goal: Goal;
  currentDistance: number;
  onClick: () => void;
}

/**
 * UpcomingGoalCard - Preact Island for upcoming goals beyond the next goal
 * Displays goals without progress bar since they're further away
 */
export function UpcomingGoalCard({ goal, currentDistance, onClick }: UpcomingGoalCardProps) {
  const distanceToGo = goal.distance - currentDistance;

  return (
    <div className="upcoming-goal" onClick={onClick}>
      {goal.special && (
        <span className="goal-special">{goal.special}</span>
      )}

      <span className="goal-title">{goal.title}</span>

      <span className="goal-distance">
        {goal.distance.toFixed(2)} km{' '}
        <span className="goal-distance-to-go">
          ({distanceToGo.toFixed(2)} km to go)
        </span>
      </span>
    </div>
  );
}
