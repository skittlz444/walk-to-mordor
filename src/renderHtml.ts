export function renderHtml(totalDistance?: number) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Walk to Mordor</title>
        <link href="wtm/css/mobiscroll.javascript.min.css" rel="stylesheet" />
        <script src="wtm/js/mobiscroll.javascript.min.js"></script>
        <style>
          /* Make Mobiscroll calendar event labels bigger and clearer, matching demo standards */
          .mbsc-calendar-label,
          .mbsc-calendar-label-text {
            font-size: 0.8em !important;
            letter-spacing: 0.5px;
            padding-top: 0.05em;
            padding-bottom: 0.05em;
          }
          .mbsc-calendar-text{
            margin: 0 .1em .4em .2em;
          }
        </style>
      </head>
      <body style="background-color:black;">
      <header style="width:100vw;position:relative;z-index:2;text-align:center;margin:0;padding:2em 0 1em 0;">
        <h1 style="font-size:2.2em;max-width:90vw;word-break:break-word;color:#FFD700;font-weight:bold;text-shadow:2px 2px 8px #333;margin:0;">Total distance travelled</h1>
        <div id="total-distance-value" style="font-size:1.7em;color:#fff;font-weight:bold;letter-spacing:2px;margin-top:0.5em;word-break:break-word;">${totalDistance ?? 0} km</div>
        <div id="last-goal" style="margin:1em auto 0 auto;text-align:center;max-width:90vw;">
        </div>
      </header>
      <section id="goals-section" style="width:100vw;max-width:700px;margin:0 auto 2em auto;text-align:center;">
        <div id="goals-list" style="margin:1em auto 0 auto;"></div>
      </section>
      <div id="eventcalendar-container" style="position:fixed;bottom:0;left:0;width:100vw;z-index:1;background:rgba(0,0,0,0.95);box-shadow:0 -2px 16px #222;padding-top:1.2em;padding-bottom:1.2em;">
        <div id="eventcalendar"></div>
      </div>
      <div id="popup" style="display:none;"></div>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            let events = [];
            let eventcalendar;
            let popup;
            let popupEvent;
            let popupDate;
            let isEdit = false;

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

            if (window.mobiscroll) {
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
                        // Persist edit
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
                        // Persist add
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
                        // Persist delete
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
            }

            function formatDate(date) {
              // Format date as yyyy-MM-DD using local time
              const d = new Date(date);
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return \`\${year}-\${month}-\${day}\`;
            }

            function showPopup(event) {
              const selectedDate = formatDate(popupDate);
              // Find existing event for this date
              const existingEvent = events.find(ev => formatDate(ev.start) === selectedDate);
              let distanceValue = '';
              if (existingEvent) {
                distanceValue = existingEvent.title.replace(/\\s*km$/, '');
              } else if (event && event.title) {
                distanceValue = event.title.replace(/\\s*km$/, '');
              }

              isEdit = !!existingEvent;
              popupEvent = existingEvent || event;

              document.getElementById('popup').innerHTML =
                \`<div style="padding:1em;">
                  <label style="color:white;">Date: \${selectedDate}</label><br>
                  <label style="color:white;">Distance (km):</label>
                  <input id="distance-input" type="number" step="any" min="0" value="\${distanceValue}" style="width:100%;margin-bottom:1em;" />
                </div>\`;

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

            function renderGoals(currentDistance) {
              fetch('/wtm/api/goals')
                .then(res => res.json())
                .then(goals => {
                  goals.sort((a, b) => a.distance - b.distance);
                  const completed = goals.filter(g => Number(currentDistance) >= g.distance);
                  const upcoming = goals.filter(g => Number(currentDistance) < g.distance);
                  const lastCompleted = completed.slice(-3);
                  const nextUpcoming = upcoming.slice(0, 15);
                  let html = '';
                  // Show last reached goal just under total distance
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
                      '<span style="display:block;color:#888;font-size:1.1em;text-align:center;margin-bottom:0.5em;">' +
                      (lastGoal.special ? '<span style="display:block;color:#FFD700;font-size:1.3em;font-weight:bold;margin-bottom:0.2em;">' + lastGoal.special + '</span>' : '') +
                      lastGoal.title +
                      ' <span style="text-decoration:line-through;color:#888;font-size:1em;">(' + lastGoal.distance.toFixed(2) + ' km)</span>' +
                      '</span>' +
                      (lastSpecial && lastSpecial !== lastGoal ?
                        '<span style="display:block;color:#aaa;font-size:1.25em;font-weight:bold;text-align:center;margin-top:0.3em;">' + lastSpecial.special +
                        ' <span style="text-decoration:line-through;color:#888;font-size:1em;">(' + lastSpecial.distance.toFixed(2) + ' km)</span></span>'
                        : '');
                  } else {
                    document.getElementById('last-goal').innerHTML = '';
                  }
                  if (lastCompleted.length) {
                    html += '<div style="margin-bottom:1em;">' +
          '<button id="toggle-completed" style="background:#333;color:#fff;border:none;padding:0.3em 0.7em;border-radius:6px;cursor:pointer;font-size:0.9em;min-width:90px;">Show/Hide Completed</button>' +
          '<ul id="completed-goals" style="list-style:none;padding:0;margin:1em 0;">' +
          lastCompleted.map(function(g) {
            return '<li style="margin:0.5em 0;text-decoration:line-through;color:#888;font-size:1em;word-break:break-word;">' +
              (g.special ? '<span style="display:block;color:#FFD700;font-size:1.3em;font-weight:bold;margin-bottom:0.2em;">' + g.special + '</span>' : '') +
              g.title +
              ' <span style="font-size:0.9em;color:#FFD700;">' + g.distance.toFixed(2) + ' km</span></li>';
          }).join('') +
          '</ul>' +
        '</div>';
                  }
                  html += '<ul style="list-style:none;padding:0;margin:0;">' +
        nextUpcoming.map(function(g) {
          return '<li style="margin:0.7em 0;padding:0.7em 1em;background:rgba(40,40,40,0.95);border-radius:12px;box-shadow:0 2px 8px #222;display:flex;flex-direction:column;align-items:center;word-break:break-word;">' +
            (g.special ? '<span style="display:block;color:#FFD700;font-size:1.3em;font-weight:bold;margin-bottom:0.2em;">' + g.special + '</span>' : '') +
            '<span style="font-size:1.1em;color:#fff;font-weight:bold;max-width:90vw;">' + g.title + '</span>' +
            '<span style="font-size:0.95em;color:#FFD700;margin-top:0.2em;">' + g.distance.toFixed(2) + ' km <span style="color:#aaa;font-size:0.9em;">(' + (g.distance-Number(currentDistance)).toFixed(2) + ' km to go)</span></span>' +
          '</li>';
        }).join('') +
        '</ul>';
                  document.getElementById('goals-list').innerHTML = html;
                  // Collapse/expand completed goals
                  var btn = document.getElementById('toggle-completed');
                  var completedList = document.getElementById('completed-goals');
                  if (btn && completedList) {
                    var shown = true;
                    btn.onclick = function() {
                      shown = !shown;
                      completedList.style.display = shown ? 'block' : 'none';
                    };
                  }
                });
            }

            // Remove duplicate initial mobiscroll.getJson call
            // Only use updateCalendarAndTotal for all calendar refreshes
            updateCalendarAndTotal();

            function updateCalendarAndTotal() {
              mobiscroll.getJson(
                '/wtm/api/calendar-progress',
                function (fetchedEvents) {
                  events = fetchedEvents.map(ev => ({
                    ...ev,
                    title: ev.title ? \`\${ev.title} km\` : ''
                  }));
                  eventcalendar.setOptions({ data: events });
                  const total = events.reduce((acc, ev) => acc + Number(ev.title.replace(/\\s*km$/, '')), 0);
                  document.getElementById('total-distance-value').textContent = \`\${total.toFixed(2)} km\`;
                  renderGoals(total);
                },
                'json'
              );
            }
          });
        </script>
      </body>
    </html>
`;
}
