import { renderLayout } from './renderLayout';

export function renderPartyJoinPage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Join Fellowship',
    description: 'Join a Fellowship on the journey to Mordor',
    stylesheets: ['/css/party.css'],
    headerContent: '<h1>Join Fellowship</h1>',
    mainContent: '<div data-island="PartyJoinIsland"></div>',
    publicPage: true,
  });
}
