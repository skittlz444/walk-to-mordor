// Plain JavaScript implementation without dependencies
console.log('Main.js script loaded');

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMContentLoaded fired');
  
  let events = [];
  let currentDate = new Date();
  let currentView = 'week'; // 'week' or 'month'
  let popupEvent;
  let popupDate;
  let isEdit = false;

  function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseDate(dateStr) {
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  function isToday(date) {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  }

  function getEventForDate(date) {
    const dateStr = formatDate(date);
    return events.find(ev => formatDate(ev.start) === dateStr);
  }

  function createCalendarGrid() {
    const container = document.getElementById('eventcalendar');
    if (!container) return;

    // Create calendar structure
    container.innerHTML = `
      <div class="custom-calendar">
        <div class="calendar-header">
          <div class="calendar-left">
            <div class="calendar-title" id="calendar-title"></div>
          </div>
          <div class="calendar-center">
            <div class="calendar-view-toggle">
              <div class="view-toggle-group">
                <input type="radio" name="view-toggle" id="month-view" value="month" ${currentView === 'month' ? 'checked' : ''}>
                <label for="month-view"><i class="fa-solid fa-calendar-days"></i></label>
                <input type="radio" name="view-toggle" id="week-view" value="week" ${currentView === 'week' ? 'checked' : ''}>
                <label for="week-view"><i class="fa-solid fa-calendar-week"></i></label>
              </div>
            </div>
            
          </div>
          <div class="calendar-nav">
          <button class="today-btn" id="today-btn">Today</button>
            <button class="nav-btn" id="prev-btn"><i class="fas fa-chevron-left"></i></button>
            <button class="nav-btn" id="next-btn"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
        <div class="calendar-grid" id="calendar-grid"></div>
      </div>
    `;

    // Add event listeners
    document.getElementById('prev-btn').addEventListener('click', () => navigateCalendar(-1));
    document.getElementById('next-btn').addEventListener('click', () => navigateCalendar(1));
    document.getElementById('today-btn').addEventListener('click', goToToday);
    
    document.querySelectorAll('input[name="view-toggle"]').forEach(input => {
      input.addEventListener('change', (e) => {
        currentView = e.target.value;
        renderCalendar();
      });
    });

    renderCalendar();
  }

  function navigateCalendar(direction) {
    if (currentView === 'week') {
      currentDate.setDate(currentDate.getDate() + (direction * 7));
    } else {
      currentDate.setMonth(currentDate.getMonth() + direction);
    }
    renderCalendar();
  }

  function goToToday() {
    currentDate = new Date();
    renderCalendar();
  }

  function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const title = document.getElementById('calendar-title');
    if (!grid || !title) return;

    if (currentView === 'week') {
      renderWeekView(grid, title);
    } else {
      renderMonthView(grid, title);
    }
  }

  function renderWeekView(grid, title) {
    // Get start of current week (Sunday)
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    // Set title
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
    title.textContent = formatter.format(startOfWeek);

    // Create week grid
    let html = '<div class="week-view">';
    
    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    html += '<div class="day-headers">';
    dayNames.forEach(day => {
      html += `<div class="day-header">${day}</div>`;
    });
    html += '</div>';

    // Week row
    html += '<div class="week-row">';
    for (let i = 0; i < 7; i++) {
      const cellDate = new Date(startOfWeek);
      cellDate.setDate(cellDate.getDate() + i);
      
      const event = getEventForDate(cellDate);
      const isCurrentDay = isToday(cellDate);
      
      html += `
        <div class="calendar-cell week-cell ${isCurrentDay ? 'today' : ''}" 
             data-date="${formatDate(cellDate)}"
             data-timestamp="${cellDate.getTime()}">
          <div class="day-number">${cellDate.getDate()}</div>
          ${event ? `<div class="event-label">${event.title}</div>` : ''}
          ${isCurrentDay ? '<div class="today-indicator"></div>' : ''}
        </div>
      `;
    }
    html += '</div></div>';

    grid.innerHTML = html;
    addCellEventListeners();
  }

  function renderMonthView(grid, title) {
    // Get first day of month
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    // Get first day of calendar (might be from previous month)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // Set title
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
    title.textContent = formatter.format(firstDay);

    // Create month grid
    let html = '<div class="month-view">';
    
    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    html += '<div class="day-headers">';
    dayNames.forEach(day => {
      html += `<div class="day-header">${day}</div>`;
    });
    html += '</div>';

    // Calendar cells
    html += '<div class="month-grid">';
    let currentCellDate = new Date(startDate);
    
    for (let week = 0; week < 6; week++) {
      html += '<div class="week-row">';
      for (let day = 0; day < 7; day++) {
        const event = getEventForDate(currentCellDate);
        const isCurrentDay = isToday(currentCellDate);
        const isCurrentMonth = currentCellDate.getMonth() === currentDate.getMonth();
        
        html += `
          <div class="calendar-cell month-cell ${isCurrentDay ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}" 
               data-date="${formatDate(currentCellDate)}"
               data-timestamp="${currentCellDate.getTime()}">
            <div class="day-number">${currentCellDate.getDate()}</div>
            ${event ? `<div class="event-label">${event.title}</div>` : ''}
            ${isCurrentDay ? '<div class="today-indicator"></div>' : ''}
          </div>
        `;
        
        currentCellDate.setDate(currentCellDate.getDate() + 1);
        
        // Stop if we've gone past the last day and completed the current week
        if (currentCellDate > lastDay && day === 6) {
          break;
        }
      }
      html += '</div>';
      
      // Stop if we've gone past the last day
      if (currentCellDate > lastDay) {
        break;
      }
    }
    
    html += '</div></div>';

    grid.innerHTML = html;
    addCellEventListeners();
  }

  function addCellEventListeners() {
    document.querySelectorAll('.calendar-cell').forEach(cell => {
      cell.addEventListener('click', function() {
        const dateStr = this.getAttribute('data-date');
        const cellDate = parseDate(dateStr);
        
        // Check if there's an existing event
        const existingEvent = getEventForDate(cellDate);
        
        popupDate = cellDate;
        popupEvent = existingEvent;
        isEdit = !!existingEvent;
        
        showDistanceModal(existingEvent);
      });
    });
  }

  function showDistanceModal(event) {
    const selectedDate = formatDate(popupDate);
    let distanceValue = '';
    
    if (event && event.title) {
      distanceValue = event.title.replace(/\s*km$/, '');
    }

    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-body">
            <div class="form-group">
              <label>Date: ${selectedDate}</label>
            </div>
            <div class="form-group">
              <label for="distance-input">Distance (km):</label>
              <input type="number" id="distance-input" step="any" min="0" value="${distanceValue}" placeholder="0.00">
            </div>
          </div>
          <div class="modal-footer modal-footer-full">
            <div class="modal-footer-btns modal-footer-btns-edit">
              ${isEdit ? '<button type="button" class="btn btn-danger" id="delete-btn">Delete</button>' : ''}
              <button type="button" class="btn btn-primary" id="save-btn">${isEdit ? 'Save' : 'Add'}</button>
              <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    // Add event listeners
    document.getElementById('save-btn').addEventListener('click', handleSaveDistance);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    
    const closeModalBtn = document.getElementById('close-modal');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', closeModal);
    }
    
    if (isEdit) {
      const deleteBtn = document.getElementById('delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteDistance);
      }
    }

    // Close modal when clicking overlay
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });

    // Focus on input
    setTimeout(() => {
      document.getElementById('distance-input').focus();
    }, 100);

    function closeModal() {
      modalOverlay.remove();
    }
  }

  function handleSaveDistance() {
    const distance = document.getElementById('distance-input').value;
    const selectedDate = formatDate(popupDate);
    
    if (!distance || isNaN(distance) || Number(distance) < 0) {
      alert('Please enter a valid distance');
      return;
    }

    // Get current total before updating
    const currentTotal = events.reduce((acc, ev) => acc + Number(ev.title.replace(/\s*km$/, '')), 0);
    
    if (isEdit) {
      // For edits, we need to subtract the old distance and add the new one
      const oldDistance = Number(popupEvent.title.replace(/\s*km$/, ''));
      const newDistance = Number(distance);
      const previousTotal = currentTotal - oldDistance;
      const projectedNewTotal = previousTotal + newDistance;
      
      fetch('/wtm/api/calendar-progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: selectedDate, title: distance })
      }).then(() => {
        updateCalendarAndTotal();
        // Check for newly passed goals after calendar update
        checkForNewlyPassedGoals(previousTotal, projectedNewTotal).then(newlyPassedGoal => {
          if (newlyPassedGoal) {
            setTimeout(() => showGoalModal(newlyPassedGoal, projectedNewTotal, true), 500);
          }
        });
      });
    } else {
      const newDistance = Number(distance);
      const projectedNewTotal = currentTotal + newDistance;
      
      fetch('/wtm/api/calendar-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: selectedDate, title: distance })
      }).then(() => {
        updateCalendarAndTotal();
        // Check for newly passed goals after calendar update
        checkForNewlyPassedGoals(currentTotal, projectedNewTotal).then(newlyPassedGoal => {
          if (newlyPassedGoal) {
            setTimeout(() => showGoalModal(newlyPassedGoal, projectedNewTotal, true), 500);
          }
        });
      });
    }
    
    // Close modal
    document.querySelector('.modal-overlay').remove();
  }

  function handleDeleteDistance() {
    const selectedDate = formatDate(popupDate);
    
    fetch('/wtm/api/calendar-progress', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: selectedDate })
    }).then(updateCalendarAndTotal);
    
    // Close modal
    document.querySelector('.modal-overlay').remove();
  }

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
          <div class="modal-header">
            <h5 class="modal-title">Goal Achievement</h5>
            <button type="button" class="close-btn" id="close-goal-modal">×</button>
          </div>
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
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="close-goal-btn">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    // Add event listeners
    document.getElementById('close-goal-btn').addEventListener('click', closeGoalModal);
    document.getElementById('close-goal-modal').addEventListener('click', closeGoalModal);

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

  function updateCalendarAndTotal() {
    fetch('/wtm/api/calendar-progress')
      .then(res => res.json())
      .then(fetchedEvents => {
        events = fetchedEvents.map(ev => ({
          ...ev,
          title: ev.title ? `${ev.title} km` : ''
        }));
        
        const total = events.reduce((acc, ev) => acc + Number(ev.title.replace(/\s*km$/, '')), 0);
        document.getElementById('total-distance-value').textContent = `${total.toFixed(2)} km`;
        renderGoals(total);
        renderCalendar(); // Re-render calendar with new events
      });
  }

  // Initialize calendar
  try {
    console.log('Initializing calendar...');
    createCalendarGrid();
    console.log('Calendar created, updating data...');
    updateCalendarAndTotal();
    console.log('Calendar initialization complete');
  } catch (error) {
    console.error('Calendar initialization error:', error);
  }
});