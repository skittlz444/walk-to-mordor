import { renderLayout } from './renderLayout';

/**
 * Public community campaigns page.
 *
 * Deliberately rendered without `main.js` (`publicPage: true`) so anonymous
 * visitors are never redirected to `/login`: campaign data is discoverable and
 * the island renders a "Sign in to join" link instead of a join button.
 */
export function renderEventsPage(): string {
  return renderLayout({
    title: 'Walk to Mordor – Campaigns',
    description: 'Community walking campaigns on the journey to Mordor',
    stylesheets: ['/css/events.css'],
    headerContent: '<h1>Campaigns</h1>',
    mainContent: '<div data-island="EventsIsland"></div>',
    publicPage: true,
  });
}
