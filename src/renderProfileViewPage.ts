import { renderLayout } from './renderLayout';

export function renderProfileViewPage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Profile',
    description: 'View your profile and journey on the road to Mordor',
    stylesheets: [
      '/css/party.css',
      '/css/friends.css',
      '/css/badge-display.css',
      '/css/profile-view.css',
    ],
    headerContent: '<h1>Profile</h1>',
    mainContent: [
      '<div class="party-page">',
      '<div data-island="ProfileViewIsland"></div>',
      '<div data-island="BadgeDisplayIsland"></div>',
      '</div>',
    ].join(''),
  });
}
