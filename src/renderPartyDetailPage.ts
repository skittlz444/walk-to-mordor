import { renderLayout } from './renderLayout';

export function renderPartyDetailPage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Fellowship',
    description: 'View Fellowship details and progress',
    stylesheets: ['/css/party.css'],
    headerContent: '<h1>Fellowship</h1>',
    mainContent: '<div data-island="PartyDetailIsland"></div>',
  });
}
