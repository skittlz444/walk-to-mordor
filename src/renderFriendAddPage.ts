import { renderLayout } from './renderLayout';

export function renderFriendAddPage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Add Friend',
    description: 'Add a friend on the journey to Mordor',
    stylesheets: ['/css/party.css', '/css/friends.css'],
    headerContent: '<h1>Add Friend</h1>',
    mainContent: '<div data-island="FriendAddIsland"></div>',
  });
}
