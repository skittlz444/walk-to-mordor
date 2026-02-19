// Calendar domain functions

// Calendar state and functions
let events = [];
let currentDate = new Date();
let currentView = 'week'; // 'week' or 'month'

// Calendar utility functions
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

function getDateAtMidnight(date) {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  return midnight;
}

function getEventForDate(date) {
  const dateStr = formatDate(date);
  return events.find(ev => formatDate(ev.start) === dateStr);
}

// Calendar creation and navigation
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
              <input type="radio" name="view-toggle" id="month-view" value="month" aria-label="Month view" ${currentView === 'month' ? 'checked' : ''}>
              <label for="month-view"><i class="fa-solid fa-calendar-days"></i></label>
              <input type="radio" name="view-toggle" id="week-view" value="week" aria-label="Week view" ${currentView === 'week' ? 'checked' : ''}>
              <label for="week-view"><i class="fa-solid fa-calendar-week"></i></label>
            </div>
          </div>
          
        </div>
        <div class="calendar-nav">
          <div class="nav-buttons">
            <button class="nav-btn" id="prev-btn" aria-label="Previous"><i class="fas fa-chevron-left"></i></button>
            <button class="nav-btn" id="next-btn" aria-label="Next"><i class="fas fa-chevron-right"></i></button>
          </div>
          <button class="today-btn" id="today-btn">Today</button>
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
    const midnightTimestamp = getDateAtMidnight(cellDate);
    
    html += `
      <div class="calendar-cell week-cell ${isCurrentDay ? 'today' : ''}" 
           data-date="${formatDate(cellDate)}"
           data-timestamp="${midnightTimestamp.getTime()}">
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
      const midnightTimestamp = getDateAtMidnight(currentCellDate);
      
      html += `
        <div class="calendar-cell month-cell ${isCurrentDay ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}" 
             data-date="${formatDate(currentCellDate)}"
             data-timestamp="${midnightTimestamp.getTime()}">
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
      
      // Call progress module function if available
      if (typeof window.showProgressModal === 'function') {
        window.showProgressModal(existingEvent, cellDate);
      }
    });
  });
}

function updateCalendarAndTotal() {
  fetch('/api/calendar-progress', {
    headers: window.getAuthHeaders()
  })
    .then(res => res.json())
    .then(fetchedEvents => {
      events = fetchedEvents.map(ev => ({
        ...ev,
        title: ev.title ? `${ev.title} km` : ''
      }));
      
      // Fetch total distance from API instead of calculating from events
      if (typeof window.fetchAndUpdateTotalDistance === 'function') {
        window.fetchAndUpdateTotalDistance();
      }
      renderCalendar(); // Re-render calendar with new events
    })
    .catch(error => {
      if (error.message !== 'Authentication required') {
        console.error('Error updating calendar:', error);
      }
    });
}


// Callback for when calendar modal is dismissed
let calendarModalDismissCallback = null;

/**
 * Register a callback for calendar modal dismissal.
 * @param {Function|null} callback
 */
function onCalendarDismiss(callback) {
  calendarModalDismissCallback = callback;
}

/**
 * Show calendar as a bottom sheet (for Map page integration).
 * Matches the journey page calendar style with an added close button.
 * When a date is clicked, the distance modal opens for that date.
 */
function showCalendarModal() {
  // Remove any existing calendar sheet
  const existing = document.getElementById('map-calendar-sheet');
  if (existing) {
    existing.remove();
  }

  // Fetch latest events before rendering
  fetch('/api/calendar-progress', {
    headers: window.getAuthHeaders ? window.getAuthHeaders() : {}
  })
    .then(res => res.json())
    .then(fetchedEvents => {
      events = fetchedEvents.map(ev => ({
        ...ev,
        title: ev.title ? `${ev.title} km` : ''
      }));
      // Now show the calendar with fresh data
      showCalendarSheetWithData();
    })
    .catch(error => {
      console.error('Error fetching calendar events:', error);
      // Show calendar anyway with whatever data we have
      showCalendarSheetWithData();
    });
}

/**
 * Internal helper to render the calendar sheet after events are loaded.
 */
function showCalendarSheetWithData() {

  // Create bottom sheet container matching #eventcalendar-container style
  const sheet = document.createElement('div');
  sheet.id = 'map-calendar-sheet';
  sheet.className = 'map-calendar-sheet';
  sheet.innerHTML = `
    <div id="map-eventcalendar" class="custom-calendar">
      <div class="calendar-header">
        <div class="calendar-left">
          <div class="calendar-title" id="sheet-calendar-title"></div>
        </div>
        <div class="calendar-center">
          <div class="calendar-view-toggle">
            <div class="view-toggle-group">
              <input type="radio" name="sheet-view-toggle" id="sheet-month-view" value="month" aria-label="Month view" ${currentView === 'month' ? 'checked' : ''}>
              <label for="sheet-month-view"><i class="fa-solid fa-calendar-days"></i></label>
              <input type="radio" name="sheet-view-toggle" id="sheet-week-view" value="week" aria-label="Week view" ${currentView === 'week' ? 'checked' : ''}>
              <label for="sheet-week-view"><i class="fa-solid fa-calendar-week"></i></label>
            </div>
          </div>
        </div>
        <div class="calendar-nav">
          <div class="nav-buttons">
            <button class="nav-btn" id="sheet-prev-btn" aria-label="Previous"><i class="fas fa-chevron-left"></i></button>
            <button class="nav-btn" id="sheet-next-btn" aria-label="Next"><i class="fas fa-chevron-right"></i></button>
          </div>
          <button class="today-btn" id="sheet-today-btn">Today</button>
          <button class="nav-btn calendar-close-btn" id="sheet-close-btn" aria-label="Close calendar"><i class="fas fa-times"></i></button>
        </div>
      </div>
      <div class="calendar-grid" id="sheet-calendar-grid"></div>
    </div>
  `;
  document.body.appendChild(sheet);

  // Animate in
  requestAnimationFrame(() => {
    sheet.classList.add('open');
  });

  function closeSheet(wasDismissed = true) {
    sheet.classList.remove('open');
    sheet.addEventListener('transitionend', () => {
      sheet.remove();
    }, { once: true });
    document.removeEventListener('keydown', handleEscape);
    if (wasDismissed && calendarModalDismissCallback) {
      calendarModalDismissCallback();
      calendarModalDismissCallback = null;
    }
  }

  function handleEscape(e) {
    if (e.key === 'Escape') {
      closeSheet(true);
    }
  }

  // Close button handler
  document.getElementById('sheet-close-btn').addEventListener('click', () => closeSheet(true));

  // ESC key handler
  document.addEventListener('keydown', handleEscape);

  // Navigation handlers
  document.getElementById('sheet-prev-btn').addEventListener('click', () => {
    if (currentView === 'week') {
      currentDate.setDate(currentDate.getDate() - 7);
    } else {
      currentDate.setMonth(currentDate.getMonth() - 1);
    }
    renderSheetCalendar();
  });
  document.getElementById('sheet-next-btn').addEventListener('click', () => {
    if (currentView === 'week') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    renderSheetCalendar();
  });
  document.getElementById('sheet-today-btn').addEventListener('click', () => {
    currentDate = new Date();
    renderSheetCalendar();
  });

  // View toggle handlers
  document.querySelectorAll('input[name="sheet-view-toggle"]').forEach(input => {
    input.addEventListener('change', (e) => {
      currentView = e.target.value;
      renderSheetCalendar();
    });
  });

  function renderSheetCalendar() {
    const grid = document.getElementById('sheet-calendar-grid');
    const title = document.getElementById('sheet-calendar-title');
    if (!grid || !title) return;

    if (currentView === 'week') {
      renderSheetWeekView(grid, title, closeSheet);
    } else {
      renderSheetMonthView(grid, title, closeSheet);
    }
  }

  // Initial render
  renderSheetCalendar();
}

function renderSheetWeekView(grid, title, closeSheetFn) {
  const startOfWeek = new Date(currentDate);
  const dayOfWeek = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

  const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  title.textContent = formatter.format(startOfWeek);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let html = '<div class="week-view">';
  html += '<div class="day-headers">';
  dayNames.forEach(day => {
    html += `<div class="day-header">${day}</div>`;
  });
  html += '</div>';
  html += '<div class="week-row">';
  
  for (let i = 0; i < 7; i++) {
    const cellDate = new Date(startOfWeek);
    cellDate.setDate(cellDate.getDate() + i);
    const event = getEventForDate(cellDate);
    const isCurrentDay = isToday(cellDate);
    const midnightTimestamp = getDateAtMidnight(cellDate);
    
    html += `
      <div class="calendar-cell week-cell ${isCurrentDay ? 'today' : ''}"
           data-date="${formatDate(cellDate)}"
           data-timestamp="${midnightTimestamp.getTime()}">
        <div class="day-number">${cellDate.getDate()}</div>
        ${event ? `<div class="event-label">${event.title}</div>` : ''}
      </div>
    `;
  }
  html += '</div></div>';
  grid.innerHTML = html;

  // Add click handlers
  grid.querySelectorAll('.calendar-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const timestamp = parseInt(cell.dataset.timestamp, 10);
      const cellDate = new Date(timestamp);
      // Find existing event for this date (for edit mode)
      const existingEvent = getEventForDate(cellDate);
      closeSheetFn(false); // Don't trigger dismiss callback
      if (typeof window.showDistanceModal === 'function') {
        window.showDistanceModal(existingEvent, cellDate);
      }
    });
  });
}

function renderSheetMonthView(grid, title, closeSheetFn) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  title.textContent = formatter.format(currentDate);

  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startPadding = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let html = '<div class="month-view">';
  html += '<div class="day-headers">';
  dayNames.forEach(day => {
    html += `<div class="day-header">${day}</div>`;
  });
  html += '</div>';

  html += '<div class="month-grid">';
  for (let i = 0; i < startPadding; i++) {
    html += '<div class="calendar-cell empty"></div>';
  }

  for (let day = 1; day <= totalDays; day++) {
    const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const event = getEventForDate(cellDate);
    const isCurrentDay = isToday(cellDate);
    const midnightTimestamp = getDateAtMidnight(cellDate);
    
    html += `
      <div class="calendar-cell month-cell ${isCurrentDay ? 'today' : ''}"
           data-date="${formatDate(cellDate)}"
           data-timestamp="${midnightTimestamp.getTime()}">
        <div class="day-number">${day}</div>
        ${event ? `<div class="event-label">${event.title}</div>` : ''}
      </div>
    `;
  }
  html += '</div></div>';
  grid.innerHTML = html;

  // Add click handlers
  grid.querySelectorAll('.calendar-cell:not(.empty)').forEach(cell => {
    cell.addEventListener('click', () => {
      const timestamp = parseInt(cell.dataset.timestamp, 10);
      const cellDate = new Date(timestamp);
      // Find existing event for this date (for edit mode)
      const existingEvent = getEventForDate(cellDate);
      closeSheetFn(false); // Don't trigger dismiss callback
      if (typeof window.showDistanceModal === 'function') {
        window.showDistanceModal(existingEvent, cellDate);
      }
    });
  });
}

// Export functions for use by other modules
window.calendarModule = {
  formatDate,
  parseDate,
  isToday,
  getEventForDate,
  createCalendarGrid,
  navigateCalendar,
  goToToday,
  renderCalendar,
  updateCalendarAndTotal,
  showCalendarModal,
  onCalendarDismiss,
  events: () => events,
  setEvents: (newEvents) => { events = newEvents; },
  currentDate: () => currentDate,
  currentView: () => currentView
};
window.updateCalendarAndTotal = updateCalendarAndTotal;
window.showCalendarModal = showCalendarModal;
window.onCalendarDismiss = onCalendarDismiss;