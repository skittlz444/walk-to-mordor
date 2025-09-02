export function renderHtml(totalDistance?: number) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Walk to Mordor</title>
        <link href="css/mobiscroll.javascript.min.css" rel="stylesheet" />
        <script src="js/mobiscroll.javascript.min.js"></script>
      </head>
      <body style="background-color:black;">
        <div id="eventcalendar"></div>
        <header style="color:white">Total distance: ${totalDistance ?? 0} km</header>
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
                        fetch('/api/calendar-progress', {
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
                        fetch('/api/calendar-progress', {
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
                        fetch('/api/calendar-progress', {
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
              const distanceValue = existingEvent ? existingEvent.title : (event ? event.title : '');

              // Set isEdit to true if there is an existing event for this date
              isEdit = !!existingEvent;
              popupEvent = existingEvent || event;

              document.getElementById('popup').innerHTML =
                '<div style="padding:1em;">' +
                '<label style="color:white;">Date: ' + selectedDate + '</label><br>' +
                '<label style="color:white;">Distance (km):</label>' +
                '<input id="distance-input" type="text" value="' + distanceValue + '" style="width:100%;margin-bottom:1em;" />' +
                '</div>';

              const buttons = [
                'cancel',
                {
                  text: isEdit ? 'Save' : 'Add',
                  handler: function () {
                    const distance = document.getElementById('distance-input').value;
                    if (isEdit) {
                      popupEvent.title = distance;
                      fetch('/api/calendar-progress', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ start: selectedDate, title: distance })
                      }).then(updateCalendarAndTotal);
                    } else {
                      events.push({
                        start: selectedDate,
                        title: distance
                      });
                      fetch('/api/calendar-progress', {
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
                    fetch('/api/calendar-progress', {
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

            // Remove duplicate initial mobiscroll.getJson call
            // Only use updateCalendarAndTotal for all calendar refreshes
            updateCalendarAndTotal();

            function updateCalendarAndTotal() {
              mobiscroll.getJson(
                '/api/calendar-progress',
                function (fetchedEvents) {
                  events = fetchedEvents;
                  eventcalendar.setOptions({ data: events });
                  // Update total distance, rounded to 2 decimal places
                  const total = events.reduce((acc, ev) => acc + Number(ev.title), 0);
                  document.querySelector('header').textContent = \`Total distance: \${total.toFixed(2)} km\`;
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
