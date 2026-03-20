import type { Goal } from '../types/goal';

interface NextGoalCardProps {
  goal: Goal;
  currentDistance: number;
  previousDistance: number;
  locked?: boolean;
  onClick?: () => void;
}

/**
 * NextGoalCard - Preact Island for the next goal with progress bar
 * Displays the immediate next goal with visual emphasis and segment progress
 */
export function NextGoalCard({ goal, currentDistance, previousDistance, locked = false, onClick }: NextGoalCardProps) {
  // Calculate segment progress
  const segmentTotal = goal.distance - previousDistance;
  const segmentProgress = currentDistance - previousDistance;
  const percentage = Math.max(0, Math.min(100, (segmentProgress / segmentTotal) * 100));
  const hasVisibleProgress = percentage > 0;
  const distanceToGo = goal.distance - currentDistance;

  return (
    <div 
      className={`upcoming-goal next-goal${locked ? ' goal-locked-interactive' : ''}`}
      data-goal-index={0}
      onClick={onClick}
      style={{
        margin: '0.7em 0',
        padding: '0.7em 1em',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        wordBreak: 'break-word',
        cursor: onClick ? 'pointer' : 'default'
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
        {locked && <i class="fas fa-lock" style="margin-right: 0.4em; font-size: 0.85em; color: #888;" aria-hidden="true" />}
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
      
      {/* Progress Bar */}
      <div 
        className="goal-progress-track"
        style={{
          width: '100%',
          height: '8px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '4px',
          marginTop: '0.6em',
          overflow: 'hidden'
        }}
      >
        <div
          className="goal-progress-fill"
          style={{
            width: `${percentage.toFixed(1)}%`,
            minWidth: hasVisibleProgress ? undefined : '1px',
            height: '100%',
            background: '#FFD700',
            transition: 'width 0.3s ease'
          }}
        />
      </div>
      </div>
  );
}
