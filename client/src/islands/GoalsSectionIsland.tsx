import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { render, h } from 'preact';
import {
  goals,
  currentDistance,
  loading,
  error,
  showFutureGoalsUnlocked,
  completedGoals,
  upcomingGoals,
  nextGoal,
  lastCompleted,
  fetchGoals,
  checkForNewlyPassedGoals,
  syncPreference,
} from '../stores/journeyStore';
import { GoalModal } from './GoalModal';
import { NextGoalCard } from './NextGoalCard';
import { UpcomingGoalCard } from './UpcomingGoalCard';
import type { Goal } from '../types/goal';

declare global {
  interface Window {
    goalsModule: {
      showGoalModal: (
        goal: Goal,
        dist: number,
        isCongratulations?: boolean
      ) => void;
      renderGoals: (dist: number) => void;
      checkForNewlyPassedGoals: (
        previousTotal: number,
        newTotal: number
      ) => Promise<Goal | null>;
      makeGoalClickable: (
        element: HTMLElement | null,
        goal: Goal,
        dist: number
      ) => void;
    };
  }
}

// ============================================================================
// Standalone helpers (also exposed on window.goalsModule)
// ============================================================================

function showGoalModal(
  goal: Goal,
  dist: number,
  isCongratulations = false
): void {
  if (document.getElementById('goal-modal-container')) return;

  const modalContainer = document.createElement('div');
  modalContainer.id = 'goal-modal-container';
  document.body.appendChild(modalContainer);

  const onClose = () => {
    try {
      render(null, modalContainer);
    } catch (_e) {
      // Ignore unmount errors
    }
    modalContainer.remove();
  };

  render(
    h(GoalModal, {
      goal,
      currentDistance: dist,
      isCongratulations,
      onClose,
    }),
    modalContainer
  );
}

function makeGoalClickable(
  element: HTMLElement | null,
  goal: Goal,
  dist: number
): void {
  if (!element) return;
  element.style.cursor = 'pointer';
  element.addEventListener('click', (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    showGoalModal(goal, dist);
  });
}

// ============================================================================
// Sub-components
// ============================================================================

function CompletedGoalItem({
  goal,
  index,
  className,
  dist,
}: {
  goal: Goal;
  index: number;
  className: string;
  dist: number;
}) {
  const handleClick = () => showGoalModal(goal, dist);

  return (
    <li
      style={{
        margin: '0.5em 0',
        textDecoration: 'line-through',
        color: '#888',
        fontSize: '1em',
        wordBreak: 'break-word',
        cursor: 'pointer',
      }}
      class={className}
      data-goal-index={index}
      onClick={handleClick}
    >
      {goal.special && (
        <span
          style={{
            display: 'block',
            color: '#FFD700',
            fontSize: '1.3em',
            fontWeight: 'bold',
            marginBottom: '0.2em',
          }}
        >
          {goal.special}
        </span>
      )}
      {goal.title}{' '}
      <span style={{ fontSize: '0.9em', color: '#FFD700' }}>
        {goal.distance.toFixed(2)} km
      </span>
    </li>
  );
}

function LastGoalHeader({
  completed,
  dist,
}: {
  completed: Goal[];
  dist: number;
}) {
  useEffect(() => {
    const el = document.getElementById('last-goal');
    if (!el) return;

    if (completed.length === 0) {
      el.innerHTML = '';
      return;
    }

    const lastGoal = completed[completed.length - 1];
    let lastSpecial: Goal | null = null;
    for (let i = completed.length - 1; i >= 0; i--) {
      if (completed[i].special) {
        lastSpecial = completed[i];
        break;
      }
    }

    el.innerHTML =
      '<span style="display:block;color:#888;font-size:1.1em;text-align:center;margin-bottom:0.5em;cursor:pointer;" class="goal-header-main">' +
      (lastGoal.special
        ? '<span style="display:block;color:#FFD700;font-size:1.3em;font-weight:bold;margin-bottom:0.2em;">' +
          lastGoal.special +
          '</span>'
        : '') +
      lastGoal.title +
      ' <span style="text-decoration:line-through;color:#888;font-size:1em;">(' +
      lastGoal.distance.toFixed(2) +
      ' km)</span>' +
      '</span>' +
      (lastSpecial && lastSpecial !== lastGoal
        ? '<span style="display:block;color:#aaa;font-size:1.25em;font-weight:bold;text-align:center;margin-top:0.3em;cursor:pointer;" class="goal-header-special">' +
          lastSpecial.special +
          ' <span style="text-decoration:line-through;color:#888;font-size:1em;">(' +
          lastSpecial.distance.toFixed(2) +
          ' km)</span></span>'
        : '');

    // Make header goals clickable
    const headerMain = el.querySelector('.goal-header-main');
    const headerSpecial = el.querySelector('.goal-header-special');
    if (headerMain)
      makeGoalClickable(headerMain as HTMLElement, lastGoal, dist);
    if (headerSpecial && lastSpecial)
      makeGoalClickable(headerSpecial as HTMLElement, lastSpecial, dist);
  }, [completed, dist]);

  return null;
}

// ============================================================================
// Main island component
// ============================================================================

export function GoalsSectionIsland() {
  const completedVisible = useSignal(true);
  const showingAll = useSignal(false);

  // Listen for preferenceChanged events
  useEffect(() => {
    const handler = () => {
      syncPreference();
      // Re-fetch to re-render with updated preference
      if (currentDistance.value > 0) {
        fetchGoals(currentDistance.value);
      }
    };
    window.addEventListener('preferenceChanged', handler);
    return () => window.removeEventListener('preferenceChanged', handler);
  }, []);

  // Expose window.goalsModule for backward compatibility
  useEffect(() => {
    window.goalsModule = {
      showGoalModal,
      renderGoals: (dist: number) => {
        fetchGoals(dist);
      },
      checkForNewlyPassedGoals,
      makeGoalClickable,
    };
  }, []);

  // Auto-fetch: read distance from #total-distance-value when it becomes available
  useEffect(() => {
    const readDistance = () => {
      const el = document.getElementById('total-distance-value');
      if (el) {
        const text = el.textContent || '';
        const num = parseFloat(text);
        if (!isNaN(num) && num > 0 && num !== currentDistance.value) {
          fetchGoals(num);
        }
      }
    };

    // Observe mutations to pick up distance set by progress.js
    const observer = new MutationObserver(readDistance);
    const target = document.getElementById('total-distance-value');
    if (target) {
      observer.observe(target, { childList: true, characterData: true, subtree: true });
      readDistance(); // Initial check
    }

    return () => observer.disconnect();
  }, []);

  const completed = completedGoals.value;
  const upcoming = upcomingGoals.value;
  const last3 = lastCompleted.value;
  const next = nextGoal.value;
  const dist = currentDistance.value;
  const prefUnlocked = showFutureGoalsUnlocked.value;
  const previousDistance =
    completed.length > 0 ? completed[completed.length - 1].distance : 0;

  // Update #last-goal header
  const headerNode = (
    <LastGoalHeader completed={completed} dist={dist} />
  );

  // Error state
  if (error.value) {
    return (
      <div id="goals-list">
        {headerNode}
        <div
          style={{
            textAlign: 'center',
            padding: '1.5em',
            background: 'rgba(40,40,40,0.95)',
            borderRadius: '12px',
            margin: '1em 0',
          }}
        >
          <div
            style={{
              color: '#ff6b6b',
              fontSize: '1.1em',
              marginBottom: '0.5em',
            }}
          >
            ⚠️ Unable to load goals
          </div>
          <div
            style={{
              color: '#aaa',
              fontSize: '0.9em',
              marginBottom: '1em',
            }}
          >
            {error.value.includes('fetch')
              ? 'Network connection error'
              : 'Server error loading goals'}
          </div>
          <button
            onClick={() => fetchGoals(dist)}
            style={{
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              padding: '0.5em 1em',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading / empty state
  if (loading.value || goals.value.length === 0) {
    return <div id="goals-list">{headerNode}</div>;
  }

  return (
    <div id="goals-list">
      {headerNode}

      {/* Completed Goals Section */}
      {completed.length > 0 && (
        <div style={{ marginBottom: '1em' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.7em',
              marginBottom: '0.5em',
            }}
          >
            <button
              id="toggle-completed-visibility"
              style={{
                background: '#333',
                color: '#fff',
                border: 'none',
                padding: '0.3em 0.7em',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9em',
                minWidth: '90px',
              }}
              onClick={() => {
                completedVisible.value = !completedVisible.value;
              }}
            >
              {completedVisible.value ? 'Hide Completed' : 'Show Completed'}
            </button>
            <button
              id="toggle-completed"
              style={{
                background: '#333',
                color: '#fff',
                border: 'none',
                padding: '0.3em 0.7em',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9em',
                minWidth: '90px',
              }}
              onClick={() => {
                showingAll.value = !showingAll.value;
              }}
            >
              {showingAll.value
                ? 'Show Last 3 Completed'
                : 'Show All Completed'}
            </button>
          </div>

          <div
            id="completed-goals-wrapper"
            style={{
              display: completedVisible.value ? 'block' : 'none',
            }}
          >
            <ul
              id="completed-goals"
              style={{
                listStyle: 'none',
                padding: '0',
                margin: '1em 0',
                display: showingAll.value ? 'none' : 'block',
              }}
            >
              {last3.map((g, index) => (
                <CompletedGoalItem
                  key={g.id}
                  goal={g}
                  index={index}
                  className="completed-goal"
                  dist={dist}
                />
              ))}
            </ul>
            <ul
              id="all-completed-goals"
              style={{
                listStyle: 'none',
                padding: '0',
                margin: '1em 0',
                display: showingAll.value ? 'block' : 'none',
              }}
            >
              {completed.map((g, index) => (
                <CompletedGoalItem
                  key={g.id}
                  goal={g}
                  index={index}
                  className="all-completed-goal"
                  dist={dist}
                />
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Upcoming Goals */}
      <ul
        id="upcoming-goals-list"
        style={{ listStyle: 'none', padding: '0', margin: '0' }}
      >
        {/* Next Goal */}
        {next && (
          <li id="next-goal-mount" data-goal-index={0}>
            <div
              class={`goal-next-target${!prefUnlocked ? ' goal-locked' : ''}`}
            >
              <NextGoalCard
                goal={next}
                currentDistance={dist}
                previousDistance={previousDistance}
                onClick={
                  prefUnlocked
                    ? () => showGoalModal(next, dist)
                    : undefined
                }
              />
            </div>
          </li>
        )}

        {/* Remaining Upcoming Goals */}
        {upcoming.slice(1).map((goal, index) => (
          <li
            key={goal.id}
            id={`upcoming-goal-mount-${index + 1}`}
            data-goal-index={index + 1}
          >
            <div class={!prefUnlocked ? 'goal-locked' : undefined}>
              <UpcomingGoalCard
                goal={goal}
                currentDistance={dist}
                onClick={
                  prefUnlocked
                    ? () => showGoalModal(goal, dist)
                    : () => {}
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
