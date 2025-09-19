export function renderHtml(totalDistance?: number) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Walk to Mordor</title>
        
        <!-- PWA Meta Tags -->
        <meta name="description" content="Track your walking progress on the journey to Mordor" />
        <meta name="theme-color" content="#0f3460" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Walk to Mordor" />
        
        <!-- Web App Manifest -->
        <link rel="manifest" href="wtm/manifest.json" />
        
        <!-- Favicon and App Icons -->
        <link rel="icon" type="image/svg+xml" href="wtm/icons/icon.svg" />
        <link rel="apple-touch-icon" href="wtm/icons/icon-192x192.png" />
        
        <!-- Stylesheets -->
        <link href="wtm/css/main.css" rel="stylesheet" />
        
        <!-- Service Worker Registration -->
        <script>
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('wtm/sw.js')
                .then((registration) => {
                  console.log('SW registered: ', registration);
                })
                .catch((registrationError) => {
                  console.log('SW registration failed: ', registrationError);
                });
            });
          }
        </script>
      </head>
      <body>
      <header>
        <h1>Total distance travelled</h1>
        <div id="total-distance-value">${totalDistance ?? 0} km</div>
        <div id="last-goal"></div>
      </header>
      <section id="goals-section">
        <div id="goals-list"></div>
      </section>
      <div id="eventcalendar-container">
        <div id="eventcalendar"></div>
      </div>
      
      <!-- Scripts -->
      <script>
        console.log('Calendar app starting...');
        
        // Global variables
        let events = [];
        let currentDate = new Date();
        let currentView = 'week';
        
        // Utility functions
        function formatDate(date) {
          const d = new Date(date);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return year + '-' + month + '-' + day;
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
        
        // Calendar creation and rendering
        function createCalendarGrid() {
          const container = document.getElementById('eventcalendar');
          if (!container) return;
          
          container.innerHTML = 
            '<div class="custom-calendar">' +
              '<div class="calendar-header">' +
                '<div class="calendar-nav">' +
                  '<button class="nav-btn" id="prev-btn">‹</button>' +
                  '<div class="calendar-title" id="calendar-title"></div>' +
                  '<button class="nav-btn" id="next-btn">›</button>' +
                '</div>' +
                '<div class="calendar-view-toggle">' +
                  '<div class="view-toggle-group">' +
                    '<input type="radio" name="view-toggle" id="month-view" value="month">' +
                    '<label for="month-view">Month</label>' +
                    '<input type="radio" name="view-toggle" id="week-view" value="week" checked>' +
                    '<label for="week-view">Week</label>' +
                  '</div>' +
                '</div>' +
                '<button class="today-btn" id="today-btn">Today</button>' +
              '</div>' +
              '<div class="calendar-grid" id="calendar-grid"></div>' +
            '</div>';
          
          // Add event listeners
          document.getElementById('prev-btn').addEventListener('click', function() { navigateCalendar(-1); });
          document.getElementById('next-btn').addEventListener('click', function() { navigateCalendar(1); });
          document.getElementById('today-btn').addEventListener('click', goToToday);
          
          document.querySelectorAll('input[name="view-toggle"]').forEach(function(input) {
            input.addEventListener('change', function(e) {
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
          dayNames.forEach(function(day) {
            html += '<div class="day-header">' + day + '</div>';
          });
          html += '</div>';
          
          // Week row
          html += '<div class="week-row">';
          for (let i = 0; i < 7; i++) {
            const cellDate = new Date(startOfWeek);
            cellDate.setDate(cellDate.getDate() + i);
            
            const event = getEventForDate(cellDate);
            const isCurrentDay = isToday(cellDate);
            
            html += 
              '<div class="calendar-cell week-cell ' + (isCurrentDay ? 'today' : '') + '" ' +
                   'data-date="' + formatDate(cellDate) + '">' +
                '<div class="day-number">' + cellDate.getDate() + '</div>' +
                (event ? '<div class="event-label">' + event.title + '</div>' : '') +
                (isCurrentDay ? '<div class="today-indicator"></div>' : '') +
              '</div>';
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
          dayNames.forEach(function(day) {
            html += '<div class="day-header">' + day + '</div>';
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
              
              html += 
                '<div class="calendar-cell month-cell ' + 
                     (isCurrentDay ? 'today ' : '') + 
                     (!isCurrentMonth ? 'other-month' : '') + '" ' +
                     'data-date="' + formatDate(currentCellDate) + '">' +
                  '<div class="day-number">' + currentCellDate.getDate() + '</div>' +
                  (event ? '<div class="event-label">' + event.title + '</div>' : '') +
                  (isCurrentDay ? '<div class="today-indicator"></div>' : '') +
                '</div>';
              
              currentCellDate.setDate(currentCellDate.getDate() + 1);
              
              if (currentCellDate > lastDay && day === 6) {
                break;
              }
            }
            html += '</div>';
            
            if (currentCellDate > lastDay) {
              break;
            }
          }
          
          html += '</div></div>';
          
          grid.innerHTML = html;
          addCellEventListeners();
        }
        
        function addCellEventListeners() {
          document.querySelectorAll('.calendar-cell').forEach(function(cell) {
            cell.addEventListener('click', function() {
              const dateStr = this.getAttribute('data-date');
              alert('Clicked on date: ' + dateStr);
            });
          });
        }
        
        function updateCalendarAndTotal() {
          fetch('/wtm/api/calendar-progress')
            .then(function(res) { return res.json(); })
            .then(function(fetchedEvents) {
              events = fetchedEvents.map(function(ev) {
                return {
                  start: ev.start,
                  title: ev.title ? ev.title + ' km' : ''
                };
              });
              
              const total = events.reduce(function(acc, ev) {
                return acc + Number(ev.title.replace(/\s*km$/, ''));
              }, 0);
              
              document.getElementById('total-distance-value').textContent = total.toFixed(2) + ' km';
              renderCalendar();
            });
        }
        
        // Initialize when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
          console.log('DOMContentLoaded fired - initializing calendar');
          
          try {
            createCalendarGrid();
            updateCalendarAndTotal();
            console.log('Calendar initialization complete');
          } catch (error) {
            console.error('Calendar initialization error:', error);
          }
        });
      </script>
      </body>
    </html>
`;
}
