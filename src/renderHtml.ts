export function renderHtml(totalDistance?: number) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Walk to Mordor</title>
        <link href="wtm/css/mobiscroll.javascript.min.css" rel="stylesheet" />
        <link href="wtm/css/main.css" rel="stylesheet" />
        <script src="wtm/js/mobiscroll.javascript.min.js" defer></script>
        <script src="wtm/js/main.js" defer></script>
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
      <div id="popup"></div>
      <div id="goal-popup"></div>
      </body>
    </html>
`;
}
