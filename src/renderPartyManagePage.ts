import { renderLayout } from './renderLayout';

export function renderPartyManagePage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Manage Fellowship',
    description: 'Manage your Fellowship settings and members',
    stylesheets: ['/css/party.css'],
    headerContent: '<h1>Manage Fellowship</h1>',
    mainContent: '<div data-island="PartyManageIsland"></div>',
  });
}
