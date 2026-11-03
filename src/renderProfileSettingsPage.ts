import { renderLayout } from './renderLayout';

export function renderProfileSettingsPage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Profile Settings',
    description: 'Edit your profile settings and preferences',
    stylesheets: ['/css/profile.css', '/css/profile-view.css'],
    headerContent: '<h1>Profile Settings</h1>',
    mainContent: [
      '<div class="profile-page">',
      '<div class="profile-back-row">',
      '<a class="profile-back-button" href="/profile">',
      '<i class="fas fa-arrow-left" aria-hidden="true"></i>',
      '<span>Back to profile</span>',
      '</a>',
      '<p class="profile-auto-save-note">Changes save automatically as you go.</p>',
      '</div>',
      '<div data-island="ProfileSettingsIsland"></div>',
      '<div data-island="PushPermissionIsland"></div>',
      '<div data-island="ProfileAccountIsland"></div>',
      '</div>',
    ].join(''),
  });
}
