import { renderLayout } from './renderLayout';

export function renderPartyListPage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Fellowships',
    description: 'Manage your Fellowships on the journey to Mordor',
    stylesheets: ['/css/party.css'],
    headerContent: '<h1>Fellowships</h1>',
    mainContent: '<div data-island="PartyListIsland"></div>',
  });
}
