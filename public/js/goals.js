// Goals domain functions

function showGoalModal(goal, currentDistance, isCongratulations = false) {
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
      onClose: onClose
    }),
    modalContainer
  );
}

function makeGoalClickable(element, goal, currentDistance) {
  if (element) {
    element.style.cursor = 'pointer';
    element.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      showGoalModal(goal, currentDistance);
    });
  }
}

function renderGoals(currentDistance) {
  fetch('/api/goals', {
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
      const completed = goals.filter(g => Number(currentDistance) >= g.distance);
      const upcoming = goals.filter(g => Number(currentDistance) < g.distance);
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
      
      // Render upcoming goals list - use Preact island for next goal
      html += '<ul id="upcoming-goals-list" style="list-style:none;padding:0;margin:0;">';
      
      // Create mount point for next goal Preact island (first upcoming goal)
      if (upcoming.length > 0) {
        html += '<div id="next-goal-mount" data-goal-index="0"></div>';
      }
      
      // Render remaining upcoming goals (non-next) with vanilla JS
      html += upcoming.slice(1).map(function(g, index) {
        return '<li style="margin:0.7em 0;padding:0.7em 1em;background:rgba(40,40,40,0.95);border-radius:12px;box-shadow:0 2px 8px #222;display:flex;flex-direction:column;align-items:center;word-break:break-word;cursor:pointer;" class="upcoming-goal" data-goal-index="' + (index + 1) + '">' +
          (g.special ? '<span style="display:block;color:#FFD700;font-size:1.3em;font-weight:bold;margin-bottom:0.2em;">' + g.special + '</span>' : '') +
          '<span style="font-size:1.1em;color:#fff;font-weight:bold;max-width:90vw;">' + g.title + '</span>' +
          '<span style="font-size:0.95em;color:#FFD700;margin-top:0.2em;">' + g.distance.toFixed(2) + ' km <span style="color:#aaa;font-size:0.9em;">(' + (g.distance-Number(currentDistance)).toFixed(2) + ' km to go)</span></span>' +
        '</li>';
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

      // Hydrate next goal Preact island and add click listeners for other goals
      queueMicrotask(() => {
        // Hydrate next goal as Preact island
        if (upcoming.length > 0) {
          const nextGoalMount = document.getElementById('next-goal-mount');
          if (nextGoalMount && window.preact && window.preactIslands) {
            const { render, h } = window.preact;
            const { NextGoalCard } = window.preactIslands;
            
            const nextGoal = upcoming[0];
            const previousDistance = completed.length > 0 ? completed[completed.length - 1].distance : 0;
            
            render(
              h(NextGoalCard, {
                goal: nextGoal,
                currentDistance: Number(currentDistance),
                previousDistance: previousDistance,
                onClick: () => showGoalModal(nextGoal, currentDistance)
              }),
              nextGoalMount
            );
          }
        }
        
        // Completed goals (last 3)
        document.querySelectorAll('.completed-goal').forEach((element, index) => {
          makeGoalClickable(element, lastCompleted[index], currentDistance);
        });

        // All completed goals
        document.querySelectorAll('.all-completed-goal').forEach((element, index) => {
          makeGoalClickable(element, completed[index], currentDistance);
        });

        // Upcoming goals (skip index 0 - that's the next goal Preact island)
        document.querySelectorAll('.upcoming-goal:not(#next-goal-mount .upcoming-goal)').forEach((element, index) => {
          // index here corresponds to upcoming.slice(1), so we need index + 1 for the actual upcoming array
          makeGoalClickable(element, upcoming[index + 1], currentDistance);
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