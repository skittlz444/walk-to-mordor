import { renderLayout } from './renderLayout';

export function renderHtml() {
  return renderLayout({
    title: 'Walk to Mordor',
    description: 'Track your walking progress on the journey to Mordor',
    headerContent: `
        <h1>Total distance travelled</h1>
        <div id="total-distance-value">Loading...</div>
        <div id="last-goal"></div>`,
    mainContent: `
        <section id="goals-section">
          <div id="goals-list"></div>
        </section>
        <div id="eventcalendar-container">
          <div id="eventcalendar"></div>
        </div>`,
    scripts: [
      '/js/validators.js',
      '/js/calendar.js',
      '/js/progress.js',
      '/js/goals.js',
    ],
  });
}
