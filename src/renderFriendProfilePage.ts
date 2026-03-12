import { renderLayout } from './renderLayout';

export function renderFriendProfilePage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Friend Profile',
    description: 'View friend profile on the journey to Mordor',
    stylesheets: ['/css/party.css', '/css/friends.css'],
    headerContent: '<h1>Friend Profile</h1>',
    mainContent: '<div data-island="FriendProfileIsland"></div>',
  });
}
