// Goals domain functions

function showGoalModal(goal, currentDistance, isCongratulations = false) {
  const isCompleted = Number(currentDistance) >= goal.distance;
  const distanceStyle = isCompleted ? 'text-decoration: line-through; color: #888;' : 'color: #FFD700;';
  const distanceToGo = isCompleted ? 0 : goal.distance - Number(currentDistance);
  
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = `
    <div class="modal-dialog modal-large">
      <div class="modal-content">
        <div class="modal-body goal-modal-scrollable">
          <div style="padding: 1.5em;">
            ${isCongratulations ? `<div class="goal-congratulations">🎉 Congratulations! You've passed a new goal! 🎉</div>` : ''}
            ${goal.special ? `<div style="color: #FFD700; font-size: 1.4em; font-weight: bold; margin-bottom: 0.5em; text-align: center;">${goal.special}</div>` : ''}
            <div style="color: #fff; font-size: 1.2em; font-weight: bold; margin-bottom: 0.8em; text-align: center;">${goal.title}</div>
            <div style="${distanceStyle} font-size: 1.1em; margin-bottom: 0.5em; text-align: center;">${goal.distance.toFixed(2)} km</div>
            ${!isCompleted ? `<div style="color: #aaa; font-size: 1em; margin-bottom: 1em; text-align: center;">${distanceToGo.toFixed(2)} km to go</div>` : ''}
            <div id="goal-image-container" style="margin-bottom: 1em; text-align: center;">
              ${goal.id ? `
                <div style="position: relative; max-width: 100%; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
                  <img id="goal-thumb-image" 
                       src="/wtm/img/thumbs/${goal.id}-thumb.jpg" 
                       alt="Goal image" 
                       style="width: 100%; height: auto; filter: blur(2px); transition: filter 0.3s ease;"
                       onerror="this.onerror=null;this.src='/wtm/img/thumbs/0-thumb.jpg';">
                  <img id="goal-highres-image" 
                       src="/wtm/img/highres/${goal.id}.jpg" 
                       alt="Goal image" 
                       style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.5s ease;"
                       onload="this.style.opacity = '1'; document.getElementById('goal-thumb-image').style.filter = 'none';"
                       onerror="this.onerror=null;this.src='/wtm/img/highres/0.jpg';">
                </div>
              ` : ''}
            </div>
            ${goal.description ? `<div style="color: #ccc; font-size: 1em; line-height: 1.4; text-align: justify;">${goal.description}</div>` : ''}
          </div>
        </div>
        <div class="modal-footer modal-footer-full">
          <div class="modal-footer-btns modal-footer-btns-goal">
            <button type="button" class="btn btn-secondary" id="close-goal-btn">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  // Add event listeners
  document.getElementById('close-goal-btn').addEventListener('click', closeGoalModal);
  const closeModalBtn = document.getElementById('close-goal-modal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeGoalModal);
  }

  // Close modal when clicking overlay
  modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) {
      closeGoalModal();
    }
  });

  function closeGoalModal() {
    modalOverlay.remove();
  }
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
  fetch('/wtm/api/goals')
    .then(res => res.json())
    .then(goals => {
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
      
      html += '<ul style="list-style:none;padding:0;margin:0;">' +
        upcoming.map(function(g, index) {
          return '<li style="margin:0.7em 0;padding:0.7em 1em;background:rgba(40,40,40,0.95);border-radius:12px;box-shadow:0 2px 8px #222;display:flex;flex-direction:column;align-items:center;word-break:break-word;cursor:pointer;" class="upcoming-goal" data-goal-index="' + index + '">' +
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

      // Add click listeners for goals
      queueMicrotask(() => {
        // Completed goals (last 3)
        document.querySelectorAll('.completed-goal').forEach((element, index) => {
          makeGoalClickable(element, lastCompleted[index], currentDistance);
        });

        // All completed goals
        document.querySelectorAll('.all-completed-goal').forEach((element, index) => {
          makeGoalClickable(element, completed[index], currentDistance);
        });

        // Upcoming goals
        document.querySelectorAll('.upcoming-goal').forEach((element, index) => {
          makeGoalClickable(element, upcoming[index], currentDistance);
        });
      });
    })
    .catch(error => {
      console.error('Error loading goals:', error);
    });
}

function checkForNewlyPassedGoals(previousTotal, newTotal) {
  return fetch('/wtm/api/goals')
    .then(res => res.json())
    .then(goals => {
      goals.sort((a, b) => a.distance - b.distance);
      
      // Find goals that were passed with the new distance
      const newlyPassed = goals.filter(goal => 
        previousTotal < goal.distance && newTotal >= goal.distance
      );
      
      // Return the highest distance goal that was newly passed
      return newlyPassed.length > 0 ? newlyPassed[newlyPassed.length - 1] : null;
    });
}

// Export functions for use by other modules
window.goalsModule = {
  showGoalModal,
  makeGoalClickable,
  renderGoals,
  checkForNewlyPassedGoals
};