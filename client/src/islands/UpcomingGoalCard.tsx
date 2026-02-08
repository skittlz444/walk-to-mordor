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
    <div
      className="upcoming-goal"
      onClick={onClick}
      style={{
        margin: '0.7em 0',
        padding: '0.7em 1em',
        background: 'rgba(40,40,40,0.95)',
        borderRadius: '12px',
        boxShadow: '0 2px 8px #222',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        wordBreak: 'break-word',
        cursor: 'pointer'
      }}
    >
      {goal.special && (
        <span style={{
          display: 'block',
          color: '#FFD700',
          fontSize: '1.3em',
          fontWeight: 'bold',
          marginBottom: '0.2em'
        }}>
          {goal.special}
        </span>
      )}

      <span style={{
        fontSize: '1.1em',
        color: '#fff',
        fontWeight: 'bold',
        maxWidth: '90vw'
      }}>
        {goal.title}
      </span>

      <span style={{
        fontSize: '0.95em',
        color: '#FFD700',
        marginTop: '0.2em'
      }}>
        {goal.distance.toFixed(2)} km{' '}
        <span style={{
          color: '#aaa',
          fontSize: '0.9em'
        }}>
          ({distanceToGo.toFixed(2)} km to go)
        </span>
      </span>
    </div>
  );
}
