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
          <div data-island="GoalsSectionIsland"></div>
        </section>
        <div data-island="CalendarIsland"></div>
        <div data-island="DistanceModalIsland"></div>`,
  });
}
