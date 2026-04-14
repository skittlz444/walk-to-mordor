import { renderLayout } from './renderLayout';

export function renderProfilePage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Profile',
    description: 'Manage your profile settings',
    stylesheets: ['/css/profile.css'],
    headerContent: '<h1>User Profile</h1>',
    mainContent: [
      '<div class="profile-islands">',
      '<div data-island="ProfileIsland"></div>',
      '<div data-island="PushPermissionIsland"></div>',
      '</div>',
    ].join(''),
  });
}
