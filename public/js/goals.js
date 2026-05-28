// Goals domain functions
const GOAL_COMPLETION_EPSILON_KM = 0.005;

function isGoalCompleted(goal, currentDistance) {
  return Number(currentDistance) + GOAL_COMPLETION_EPSILON_KM >= goal.distance;
}

function getRemainingKm(goal, currentDistance) {
  return Math.max(0, goal.distance - Number(currentDistance));
}

function showGoalModal(goal, currentDistance, isCongratulations = false, locked = false) {
  // Prevent stacking modals - if one is already open, don't open another
  if (document.getElementById('goal-modal-container')) {
    return;
  }

  // Create a mount point for the Preact GoalModal island
  const modalContainer = document.createElement('div');
  modalContainer.id = 'goal-modal-container';
  document.body.appendChild(modalContainer);

  // Import Preact render function (loaded via islands.js)
  const preact = window.preact;
  const islands = window.preactIslands;

  if (!preact || !preact.render || !preact.h) {
    console.error('Preact library not loaded. Ensure islands.js is loaded before goals.js');
    modalContainer.remove();
    return;
  }

  if (!islands || !islands.GoalModal) {
    console.error('GoalModal island not found in registry. Check island registration in client/src/index.tsx');
    modalContainer.remove();
    return;
  }

  const { render, h } = preact;
  const { GoalModal } = islands;

  // Render the GoalModal island with props
  const onClose = () => {
    // Unmount Preact tree first, then remove mount point.
    // This improves consistency across browsers (notably Mobile Firefox).
    try {
      render(null, modalContainer);
    } catch (e) {
      // Ignore unmount errors; removing the container is sufficient cleanup.
    }
    modalContainer.remove();
  };

  render(
    h(GoalModal, {
      goal: goal,
      currentDistance: currentDistance,
      isCongratulations: isCongratulations,
      locked: locked,
      onClose: onClose
    }),
    modalContainer
  );
}

function makeGoalClickable(element, goal, currentDistance, locked = false) {
  if (element) {
    element.style.cursor = 'pointer';
    element.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      showGoalModal(goal, currentDistance, false, locked);
    });
  }
}

// Track last rendered distance for re-rendering on preference change
let lastRenderedDistance = null;
let lastRenderedStorylineId = null;

function renderGoals(currentDistance, storylineId) {
  lastRenderedDistance = currentDistance;
  lastRenderedStorylineId = storylineId || null;
  const goalsUrl = storylineId ? `/api/goals?storylineId=${encodeURIComponent(storylineId)}` : '/api/goals';
  fetch(goalsUrl, {
    headers: window.getAuthHeaders()
  })
    .then(res => {
      if (!res.ok) {
        throw new Error(`Goals API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    })
    .then(goals => {
      if (!Array.isArray(goals)) {
        throw new Error('Invalid goals data: expected array');
      }
      goals.sort((a, b) => a.distance - b.distance);
      const completed = goals.filter(g => isGoalCompleted(g, currentDistance));
      const upcoming = goals.filter(g => !isGoalCompleted(g, currentDistance));
      const lastCompleted = completed.slice(-3);
      let html = '';
      
      if (completed.length) {
        const lastGoal = completed[completed.length - 1];
        let lastSpecial = null;
        for (let i = completed.length - 1; i >= 0; i--) {
          if (completed[i].special) {
            lastSpecial = completed[i];
            break;
          }
        }
        document.getElementById('last-goal').innerHTML =
          '<span style="display:block;color:#888;font-size:1.1em;text-align:center;margin-bottom:0.5em;cursor:pointer;" class="goal-header-main">' +
          (lastGoal.special ? '<span style="display:block;color:#FFD700;font-size:1.3em;font-weight:bold;margin-bottom:0.2em;">' + lastGoal.special + '</span>' : '') +
          lastGoal.title +
          ' <span style="text-decoration:line-through;color:#888;font-size:1em;">(' + lastGoal.distance.toFixed(2) + ' km)</span>' +
          '</span>' +
          (lastSpecial && lastSpecial !== lastGoal ?
            '<span style="display:block;color:#aaa;font-size:1.25em;font-weight:bold;text-align:center;margin-top:0.3em;cursor:pointer;" class="goal-header-special">' + lastSpecial.special +
            ' <span style="text-decoration:line-through;color:#888;font-size:1em;">(' + lastSpecial.distance.toFixed(2) + ' km)</span></span>'
            : '');
        
        // Make header goals clickable
        queueMicrotask(() => {
          const headerMain = document.querySelector('.goal-header-main');
          const headerSpecial = document.querySelector('.goal-header-special');
          if (headerMain) makeGoalClickable(headerMain, lastGoal, currentDistance);
          if (headerSpecial && lastSpecial) makeGoalClickable(headerSpecial, lastSpecial, currentDistance);
        });
      } else {
        document.getElementById('last-goal').innerHTML = '';
      }
      
      if (completed.length) {
        html += '<div style="margin-bottom:1em;">' +
          '<div style="display:flex;justify-content:center;gap:0.7em;margin-bottom:0.5em;">' +
            '<button id="toggle-completed-visibility" style="background:#333;color:#fff;border:none;padding:0.3em 0.7em;border-radius:6px;cursor:pointer;font-size:0.9em;min-width:90px;">Hide Completed</button>' +
            '<button id="toggle-completed" style="background:#333;color:#fff;border:none;padding:0.3em 0.7em;border-radius:6px;cursor:pointer;font-size:0.9em;min-width:90px;">Show All Completed</button>' +
          '</div>' +
          '<div id="completed-goals-wrapper">' +
            '<ul id="completed-goals" style="list-style:none;padding:0;margin:1em 0;">' +
            lastCompleted.map(function(g, index) {
              return '<li style="margin:0.5em 0;text-decoration:line-through;color:#888;font-size:1em;word-break:break-word;cursor:pointer;" class="completed-goal" data-goal-index="' + index + '">' +
                (g.special ? '<span style="display:block;color:#FFD700;font-size:1.3em;font-weight:bold;margin-bottom:0.2em;">' + g.special + '</span>' : '') +
                g.title +
                ' <span style="font-size:0.9em;color:#FFD700;">' + g.distance.toFixed(2) + ' km</span></li>';
            }).join('') +
            '</ul>' +
            '<ul id="all-completed-goals" style="list-style:none;padding:0;margin:1em 0;display:none;">' +
            completed.map(function(g, index) {
              return '<li style="margin:0.5em 0;text-decoration:line-through;color:#888;font-size:1em;word-break:break-word;cursor:pointer;" class="all-completed-goal" data-goal-index="' + index + '">' +
                (g.special ? '<span style="display:block;color:#FFD700;font-size:1.3em;font-weight:bold;margin-bottom:0.2em;">' + g.special + '</span>' : '') +
                g.title +
                ' <span style="font-size:0.9em;color:#FFD700;">' + g.distance.toFixed(2) + ' km</span></li>';
            }).join('') +
            '</ul>' +
          '</div>' +
        '</div>';
      }
      
      // Render upcoming goals list - use Preact islands for all goals
      html += '<ul id="upcoming-goals-list" style="list-style:none;padding:0;margin:0;">';

      // Create mount point for next goal Preact island (first upcoming goal)
      if (upcoming.length > 0) {
        html += '<li id="next-goal-mount" data-goal-index="0"></li>';
      }

      // Create mount points for remaining upcoming goals (use Preact islands)
      html += upcoming.slice(1).map(function(g, index) {
        return '<li id="upcoming-goal-mount-' + (index + 1) + '" data-goal-index="' + (index + 1) + '"></li>';
      }).join('') +
      '</ul>';
      
      document.getElementById('goals-list').innerHTML = html;
      
      var completedVisibilityBtn = document.getElementById('toggle-completed-visibility');
      var completedWrapper = document.getElementById('completed-goals-wrapper');
      var completedToggleBtn = document.getElementById('toggle-completed');
      var completedList = document.getElementById('completed-goals');
      var allCompletedList = document.getElementById('all-completed-goals');
      
      if (completedVisibilityBtn && completedWrapper) {
        var completedVisible = true;
        completedVisibilityBtn.onclick = function() {
          completedVisible = !completedVisible;
          completedWrapper.style.display = completedVisible ? 'block' : 'none';
          completedVisibilityBtn.textContent = completedVisible ? 'Hide Completed' : 'Show Completed';
        };
      }
      
      if (completedToggleBtn && completedList && allCompletedList) {
        var showingAll = false;
        completedToggleBtn.onclick = function() {
          showingAll = !showingAll;
          completedList.style.display = showingAll ? 'none' : 'block';
          allCompletedList.style.display = showingAll ? 'block' : 'none';
          completedToggleBtn.textContent = showingAll ? 'Show Last 3 Completed' : 'Show All Completed';
        };
      }

      // Hydrate next goal Preact island and remaining upcoming goals
      queueMicrotask(() => {
        // Read user preference (default: true = unlocked)
        const prefUnlocked = window.userPreferences && typeof window.userPreferences.showFutureGoalsUnlocked === 'boolean'
          ? window.userPreferences.showFutureGoalsUnlocked
          : true;

        // Hydrate next goal as Preact island with fallback
        if (upcoming.length > 0) {
          const nextGoalMount = document.getElementById('next-goal-mount');
          if (nextGoalMount) {
            const nextGoal = upcoming[0];
            const previousDistance = completed.length > 0 ? completed[completed.length - 1].distance : 0;

            const hasPreact = !!(window.preact && window.preact.render && window.preact.h);
            const hasNextGoalCard = !!(window.preactIslands && window.preactIslands.NextGoalCard);

            if (hasPreact && hasNextGoalCard) {
              const { render, h } = window.preact;
              const { NextGoalCard } = window.preactIslands;

              render(
                h(NextGoalCard, {
                  goal: nextGoal,
                  currentDistance: Number(currentDistance),
                  previousDistance: previousDistance,
                  locked: !prefUnlocked,
                  onClick: () => showGoalModal(nextGoal, currentDistance, false, !prefUnlocked)
                }),
                nextGoalMount
              );
            } else {
              // Fallback: render next goal without Preact
              if (!hasPreact) {
                console.error('Preact library not loaded. Ensure islands.js is loaded before goals.js');
              } else if (!hasNextGoalCard) {
                console.error('NextGoalCard island not found in registry. Check island registration in client/src/index.tsx');
              }

              // Render vanilla JS fallback with progress bar
              const segmentTotal = nextGoal.distance - previousDistance;
              const segmentProgress = Number(currentDistance) - previousDistance;
              const percentage = Math.max(0, Math.min(100, (segmentProgress / segmentTotal) * 100));

              const fillMinWidth = percentage > 0 ? '0' : '1px';

              nextGoalMount.innerHTML =
                '<div style="margin:0.7em 0;padding:0.7em 1em;background:rgba(40,40,40,0.95);border-radius:12px;box-shadow:0 2px 8px #222;display:flex;flex-direction:column;align-items:center;word-break:break-word;cursor:pointer;" class="upcoming-goal next-goal" data-goal-index="0">' +
                (nextGoal.special ? '<span style="display:block;color:#FFD700;font-size:1.3em;font-weight:bold;margin-bottom:0.2em;">' + nextGoal.special + '</span>' : '') +
                '<span style="font-size:1.1em;color:#fff;font-weight:bold;max-width:90vw;">' + (!prefUnlocked ? '<i class="fas fa-lock" style="margin-right:0.4em;font-size:0.85em;color:#888;"></i>' : '') + nextGoal.title + '</span>' +
                '<span style="font-size:0.95em;color:#FFD700;margin-top:0.2em;">' + nextGoal.distance.toFixed(2) + ' km <span style="color:#aaa;font-size:0.9em;">(' + getRemainingKm(nextGoal, currentDistance).toFixed(2) + ' km to go)</span></span>' +
                '<div class="goal-progress-track" style="width:100%;height:8px;background:rgba(0,0,0,0.5);border-radius:4px;margin-top:0.6em;overflow:hidden;">' +
                  '<div class="goal-progress-fill" style="width:' + percentage.toFixed(1) + '%;min-width:' + fillMinWidth + ';height:100%;background:#FFD700;transition:width 0.3s ease;"></div>' +
                '</div>' +
                '</div>';

              // Make fallback always clickable
              makeGoalClickable(nextGoalMount.querySelector('.next-goal'), nextGoal, currentDistance, !prefUnlocked);
            }

            // Always apply next-target styling to the first upcoming goal
            // The next goal should always be visually prominent regardless of preference
            // When pref OFF, also mark as locked
            {
              const nextGoalCard = nextGoalMount.querySelector('.upcoming-goal, [class*="next-goal"]') || nextGoalMount.firstElementChild;
              if (nextGoalCard) {
                nextGoalCard.classList.add('goal-next-target');
                if (!prefUnlocked) {
                  nextGoalCard.classList.add('goal-locked-interactive');
                }
              }
            }
          }
        }

        // Hydrate remaining upcoming goals as Preact islands with fallback
        const hasPreact = !!(window.preact && window.preact.render && window.preact.h);
        const hasUpcomingGoalCard = !!(window.preactIslands && window.preactIslands.UpcomingGoalCard);

        if (hasPreact && hasUpcomingGoalCard) {
          const { render, h } = window.preact;
          const { UpcomingGoalCard } = window.preactIslands;

          upcoming.slice(1).forEach((goal, index) => {
            const mountPoint = document.getElementById('upcoming-goal-mount-' + (index + 1));
            if (mountPoint) {
              render(
                h(UpcomingGoalCard, {
                  goal: goal,
                  currentDistance: Number(currentDistance),
                  locked: !prefUnlocked,
                  onClick: () => showGoalModal(goal, currentDistance, false, !prefUnlocked)
                }),
                mountPoint
              );

              // When preference is OFF, apply locked-interactive styling
              if (!prefUnlocked) {
                const goalCard = mountPoint.firstElementChild;
                if (goalCard) {
                  goalCard.classList.add('goal-locked-interactive');
                }
              }
            }
          });
        } else {
          // Fallback: render upcoming goals without Preact
          if (!hasPreact) {
            console.error('Preact library not loaded. Ensure islands.js is loaded before goals.js');
          } else if (!hasUpcomingGoalCard) {
            console.error('UpcomingGoalCard island not found in registry. Check island registration in client/src/index.tsx');
          }

          upcoming.slice(1).forEach((goal, index) => {
            const mountPoint = document.getElementById('upcoming-goal-mount-' + (index + 1));
            if (mountPoint) {
              const lockedClass = prefUnlocked ? '' : ' goal-locked-interactive';
              mountPoint.innerHTML =
                '<div style="margin:0.7em 0;padding:0.7em 1em;background:rgba(40,40,40,0.95);border-radius:12px;box-shadow:0 2px 8px #222;display:flex;flex-direction:column;align-items:center;word-break:break-word;cursor:pointer;" class="upcoming-goal' + lockedClass + '" data-goal-index="' + (index + 1) + '">' +
                (goal.special ? '<span style="display:block;color:#FFD700;font-size:1.3em;font-weight:bold;margin-bottom:0.2em;">' + goal.special + '</span>' : '') +
                '<span style="font-size:1.1em;color:#fff;font-weight:bold;max-width:90vw;">' + (!prefUnlocked ? '<i class="fas fa-lock" style="margin-right:0.4em;font-size:0.85em;color:#888;"></i>' : '') + goal.title + '</span>' +
                '<span style="font-size:0.95em;color:#FFD700;margin-top:0.2em;">' + goal.distance.toFixed(2) + ' km <span style="color:#aaa;font-size:0.9em;">(' + getRemainingKm(goal, currentDistance).toFixed(2) + ' km to go)</span></span>' +
                '</div>';

              // Make fallback always clickable
              makeGoalClickable(mountPoint.querySelector('.upcoming-goal'), goal, currentDistance, !prefUnlocked);
            }
          });
        }

        // Completed goals (last 3)
        document.querySelectorAll('.completed-goal').forEach((element, index) => {
          makeGoalClickable(element, lastCompleted[index], currentDistance);
        });

        // All completed goals
        document.querySelectorAll('.all-completed-goal').forEach((element, index) => {
          makeGoalClickable(element, completed[index], currentDistance);
        });
      });
    })
    .catch(error => {
      console.error('Error loading goals:', error);
      
      // Provide user-friendly error message
      const goalsContainer = document.getElementById('goals-list');
      const lastGoalContainer = document.getElementById('last-goal');
      
      if (goalsContainer) {
        goalsContainer.innerHTML = `
          <div style="text-align: center; padding: 1.5em; background: rgba(40,40,40,0.95); border-radius: 12px; margin: 1em 0;">
            <div style="color: #ff6b6b; font-size: 1.1em; margin-bottom: 0.5em;">
              ⚠️ Unable to load goals
            </div>
            <div style="color: #aaa; font-size: 0.9em; margin-bottom: 1em;">
              ${error.message.includes('fetch') ? 'Network connection error' : 'Server error loading goals'}
            </div>
            <button onclick="window.goalsModule.renderGoals(${currentDistance})" 
                    style="background: #4CAF50; color: white; border: none; padding: 0.5em 1em; border-radius: 6px; cursor: pointer;">
              Retry
            </button>
          </div>
        `;
      }
      
      if (lastGoalContainer) {
        lastGoalContainer.innerHTML = `
          <span style="color: #ff6b6b; font-size: 0.9em; text-align: center; display: block;">
            Goals unavailable
          </span>
        `;
      }
    });
}

function checkForNewlyPassedGoals(previousTotal, newTotal) {
  return fetch('/api/goals', {
    headers: window.getAuthHeaders()
  })
    .then(res => {
      if (!res.ok) {
        throw new Error(`Goals API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    })
    .then(goals => {
      if (!Array.isArray(goals)) {
        throw new Error('Invalid goals data: expected array');
      }
      
      goals.sort((a, b) => a.distance - b.distance);
      
      // Find goals that were passed with the new distance
      const newlyPassed = goals.filter(goal => 
        previousTotal < goal.distance && newTotal >= goal.distance
      );
      
      // Return the highest distance goal that was newly passed
      return newlyPassed.length > 0 ? newlyPassed[newlyPassed.length - 1] : null;
    })
    .catch(error => {
      console.error('Error checking for newly passed goals:', error);
      // Return null on error to prevent breaking the flow
      return null;
    });
}

// Export functions for use by other modules
window.goalsModule = {
  showGoalModal,
  makeGoalClickable,
  renderGoals,
  checkForNewlyPassedGoals
};

// Re-render goals when preference changes (dynamic toggle reactivity)
window.addEventListener('preferenceChanged', function() {
  if (lastRenderedDistance !== null) {
    renderGoals(lastRenderedDistance, lastRenderedStorylineId);
  }
});

// ============================================================================
// Party Selector Integration (Story 3.6)
// ============================================================================

/**
 * Mount the PartySelector Preact island on the Journey page.
 * Called after Preact islands are loaded.
 */
function mountPartySelector() {
  const mountPoint = document.getElementById('party-selector-mount');
  if (!mountPoint) return;

  const preact = window.preact;
  const islands = window.preactIslands;
  if (!preact || !preact.render || !preact.h || !islands || !islands.PartySelector) {
    return;
  }

  const { render, h } = preact;
  const { PartySelector } = islands;

  function handleViewChange(selection, progress) {
    if (selection === 'personal') {
      // Restore personal view
      var pd = window._personalDistance;
      var el = document.getElementById('total-distance-value');
      if (el && pd !== undefined) {
        el.textContent = pd + ' km';
      }
      if (pd !== undefined) {
        renderGoals(pd);
      }
    } else if (progress) {
      // Show party progress
      var el = document.getElementById('total-distance-value');
      if (el) {
        el.textContent = progress.total_distance.toFixed(2) + ' km';
      }
      renderGoals(progress.total_distance, progress.active_storyline && progress.active_storyline.id);
    }
  }

  function handleNewMilestones(milestones) {
    if (milestones.length > 0) {
      var latest = milestones[milestones.length - 1];
      if (window.goalsModule && window.goalsModule.showGoalModal) {
        var currentDist = window.partyStore && window.partyStore.partyProgress.value
          ? window.partyStore.partyProgress.value.total_distance
          : (window._personalDistance || 0);
        setTimeout(function() {
          window.goalsModule.showGoalModal(latest, currentDist, true);
        }, 300);
      }
    }
  }

  render(
    h(PartySelector, {
      variant: 'journey',
      onViewChange: handleViewChange,
      onNewMilestones: handleNewMilestones
    }),
    mountPoint
  );
}

// Mount party selector when islands are ready
var partySelectorRetries = 0;
var MAX_PARTY_SELECTOR_RETRIES = 25; // 5 seconds at 200ms intervals
function tryMountPartySelector() {
  if (window.preactIslands && window.preactIslands.PartySelector) {
    mountPartySelector();
  } else if (partySelectorRetries < MAX_PARTY_SELECTOR_RETRIES) {
    partySelectorRetries++;
    setTimeout(tryMountPartySelector, 200);
  }
}

// Listen for DOMContentLoaded or run immediately
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(tryMountPartySelector, 100);
  });
} else {
  setTimeout(tryMountPartySelector, 100);
}