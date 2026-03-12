import { renderLayout } from './renderLayout';

export function renderFriendsPage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Friends',
    description: 'Manage your friends on the journey to Mordor',
    stylesheets: ['/css/party.css', '/css/friends.css'],
    headerContent: '<h1>Friends</h1>',
    mainContent: '<div data-island="FriendsListIsland"></div>',
  });
}
