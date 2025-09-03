function mobiscrollReady(callback) {
  if (window.mobiscroll) {
    callback();
  } else {
    let tries = 0;
    const interval = setInterval(() => {
      if (window.mobiscroll) {
        clearInterval(interval);
        callback();
      } else if (++tries > 50) {
        clearInterval(interval);
        console.error('Mobiscroll did not load');
      }
    }, 100);
  }
}

mobiscrollReady(function() {
  let events = [];
  let eventcalendar;
  let popup;
  let goalPopup;
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

  function showPopup(event) {
    const selectedDate = formatDate(popupDate);
    const existingEvent = events.find(ev => formatDate(ev.start) === selectedDate);
    let distanceValue = '';
    if (existingEvent) {
      distanceValue = existingEvent.title.replace(/\s*km$/, '');
    } else if (event && event.title) {
      distanceValue = event.title.replace(/\s*km$/, '');
    }
    isEdit = !!existingEvent;
    popupEvent = existingEvent || event;
    document.getElementById('popup').innerHTML =
      `<div style="padding:1em;">
        <label style="color:white;">Date: ${selectedDate}</label><br>
        <label style="color:white;">Distance (km):</label>
        <input id="distance-input" type="number" step="any" min="0" value="${distanceValue}" style="width:100%;margin-bottom:1em;" />
      </div>`;
    const buttons = [
      'cancel',
      {
        text: isEdit ? 'Save' : 'Add',
        handler: function () {
          const distance = document.getElementById('distance-input').value;
          if (isEdit) {
            popupEvent.title = distance;
            fetch('/wtm/api/calendar-progress', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ start: selectedDate, title: distance })
            }).then(updateCalendarAndTotal);
          } else {
            events.push({ start: selectedDate, title: distance });
            fetch('/wtm/api/calendar-progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ start: selectedDate, title: distance })
            }).then(updateCalendarAndTotal);
          }
          popup.close();
        }
      }
    ];
    if (isEdit) {
      buttons.push({
        text: 'Delete',
        handler: function () {
          events = events.filter(ev => formatDate(ev.start) !== selectedDate);
          fetch('/wtm/api/calendar-progress', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start: selectedDate })
          }).then(updateCalendarAndTotal);
          popup.close();
        },
        cssClass: 'mbsc-popup-button-danger'
      });
    }
    popup.setOptions({ buttons });
    popup.open();
  }

  function showGoalPopup(goal, currentDistance) {
    const isCompleted = Number(currentDistance) >= goal.distance;
    const distanceStyle = isCompleted ? 'text-decoration: line-through; color: #888;' : 'color: #FFD700;';
    const distanceToGo = isCompleted ? 0 : goal.distance - Number(currentDistance);
    
    document.getElementById('goal-popup').innerHTML =
      `<div style="padding: 1.5em; max-width: 400px;">
        ${goal.special ? `<div style="color: #FFD700; font-size: 1.4em; font-weight: bold; margin-bottom: 0.5em; text-align: center;">${goal.special}</div>` : ''}
        <div style="color: #fff; font-size: 1.2em; font-weight: bold; margin-bottom: 0.8em; text-align: center;">${goal.title}</div>
        <div style="${distanceStyle} font-size: 1.1em; margin-bottom: 0.5em; text-align: center;">${goal.distance.toFixed(2)} km</div>
        ${!isCompleted ? `<div style="color: #aaa; font-size: 1em; margin-bottom: 1em; text-align: center;">${distanceToGo.toFixed(2)} km to go</div>` : ''}
        ${goal.description ? `<div style="color: #ccc; font-size: 1em; line-height: 1.4; text-align: justify;">${goal.description}</div>` : ''}
      </div>`;
    
    goalPopup.open();
  }

  function makeGoalClickable(element, goal, currentDistance) {
    if (element) {
      element.style.cursor = 'pointer';
      element.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showGoalPopup(goal, currentDistance);
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
          setTimeout(() => {
            const headerMain = document.querySelector('.goal-header-main');
            const headerSpecial = document.querySelector('.goal-header-special');
            if (headerMain) makeGoalClickable(headerMain, lastGoal, currentDistance);
            if (headerSpecial && lastSpecial) makeGoalClickable(headerSpecial, lastSpecial, currentDistance);
          }, 0);
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
        setTimeout(() => {
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
        }, 0);
      });
  }

  function updateCalendarAndTotal() {
    mobiscroll.getJson(
      '/wtm/api/calendar-progress',
      function (fetchedEvents) {
        events = fetchedEvents.map(ev => ({
          ...ev,
          title: ev.title ? `${ev.title} km` : ''
        }));
        eventcalendar.setOptions({ data: events });
        const total = events.reduce((acc, ev) => acc + Number(ev.title.replace(/\s*km$/, '')), 0);
        document.getElementById('total-distance-value').textContent = `${total.toFixed(2)} km`;
        renderGoals(total);
      },
      'json'
    );
  }

  const options = {
    themeVariant: "dark",
    data: events,
    view: { calendar: { type: 'week' } },
    renderHeader: function () {
      return (
        '<div mbsc-calendar-nav class="cal-header-nav"></div>' +
        '<div class="mbsc-flex mbsc-flex-1-0 mbsc-justify-content-center">' +
        '<label><input data-icon="material-event-note" mbsc-segmented type="radio" name="view" value="month" class="md-view-change"></label>' +
        '<label><input data-icon="material-date-range" mbsc-segmented type="radio" name="view" value="week" class="md-view-change" checked></label>' +
        '</div>' +
        '<button mbsc-calendar-today></button>' +
        '<div mbsc-calendar-prev class="cal-header-prev"></div>' +
        '<div mbsc-calendar-next class="cal-header-next"></div>'
      );
    },
    onCellClick: function (args) {
      popupDate = args.date;
      isEdit = false;
      showPopup();
    },
    onEventClick: function (args) {
      popupEvent = args.event;
      popupDate = args.event.start;
      isEdit = true;
      showPopup(args.event);
    }
  };

  eventcalendar = mobiscroll.eventcalendar('#eventcalendar', options);
  popup = mobiscroll.popup('#popup', {
    display: 'center',
    buttons: [
      'cancel',
      {
        text: isEdit ? 'Save' : 'Add',
        handler: function () {
          const distance = document.getElementById('distance-input').value;
          if (isEdit) {
            popupEvent.title = distance;
            fetch('/wtm/api/calendar-progress', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ start: popupEvent.start, title: distance })
            }).then(updateCalendarAndTotal);
          } else {
            events.push({
              start: popupDate,
              title: distance
            });
            fetch('/wtm/api/calendar-progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ start: popupDate, title: distance })
            }).then(updateCalendarAndTotal);
          }
          eventcalendar.setOptions({ data: events });
          popup.close();
        }
      },
      {
        text: 'Delete',
        handler: function () {
          if (isEdit) {
            events = events.filter(ev => ev !== popupEvent);
            fetch('/wtm/api/calendar-progress', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ start: popupEvent.start })
            }).then(updateCalendarAndTotal);
            eventcalendar.setOptions({ data: events });
          }
          popup.close();
        },
        cssClass: 'mbsc-popup-button-danger',
        visible: isEdit
      }
    ],
    onOpen: function () {
      document.getElementById('distance-input').focus();
    }
  });

  goalPopup = mobiscroll.popup('#goal-popup', {
    display: 'center',
    themeVariant: 'dark',
    buttons: [
      {
        text: 'Close',
        handler: function () {
          goalPopup.close();
        }
      }
    ]
  });

  document.querySelectorAll('.md-view-change').forEach(function (elm) {
    elm.addEventListener('change', function (ev) {
      eventcalendar = mobiscroll.getInst(document.getElementById('eventcalendar'));
      switch (ev.target.value) {
        case 'month':
          eventcalendar.setOptions({
            view: { calendar: { type: 'month' } },
          });
          break;
        case 'week':
          eventcalendar.setOptions({
            view: { calendar: { type: 'week' } },
          });
          break;
      }
    });
  });

  updateCalendarAndTotal();
});
