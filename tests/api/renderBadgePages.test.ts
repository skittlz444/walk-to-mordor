import { renderProfileViewPage } from '../../src/renderProfileViewPage';
import { renderProfileSettingsPage } from '../../src/renderProfileSettingsPage';
import { renderFriendProfilePage } from '../../src/renderFriendProfilePage';

function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe('profile view page badge display wiring', () => {
  it('mounts the badge island after the profile view island', () => {
    const html = renderProfileViewPage();

    expect(html).toContain('data-island="BadgeDisplayIsland"');
    expect(countOccurrences(html, 'data-island="ProfileViewIsland"')).toBe(1);
    expect(countOccurrences(html, 'data-island="BadgeDisplayIsland"')).toBe(1);
    expect(html.indexOf('data-island="ProfileViewIsland"')).toBeLessThan(
      html.indexOf('data-island="BadgeDisplayIsland"'),
    );
  });

  it('does not mount the settings islands on the view page', () => {
    const html = renderProfileViewPage();

    expect(html).not.toContain('data-island="ProfileSettingsIsland"');
    expect(html).not.toContain('data-island="ProfileAccountIsland"');
    expect(html).not.toContain('data-island="ProfileIsland"');
  });

  it('loads the view and badge stylesheets on the profile view page', () => {
    const html = renderProfileViewPage();

    expect(html).toContain('/css/party.css');
    expect(html).toContain('/css/friends.css');
    expect(html).toContain('/css/badge-display.css');
    expect(html).toContain('/css/profile-view.css');
  });
});

describe('profile settings page wiring', () => {
  it('mounts settings, push, and account islands inside the page wrapper, in order', () => {
    const html = renderProfileSettingsPage();

    expect(countOccurrences(html, 'data-island="ProfileSettingsIsland"')).toBe(1);
    expect(countOccurrences(html, 'data-island="PushPermissionIsland"')).toBe(1);
    expect(countOccurrences(html, 'data-island="ProfileAccountIsland"')).toBe(1);

    expect(html.indexOf('data-island="ProfileSettingsIsland"')).toBeLessThan(
      html.indexOf('data-island="PushPermissionIsland"'),
    );
    expect(html.indexOf('data-island="PushPermissionIsland"')).toBeLessThan(
      html.indexOf('data-island="ProfileAccountIsland"'),
    );
    expect(html).toContain('<div class="profile-page">');
  });

  it('renders the SSR back row before the islands', () => {
    const html = renderProfileSettingsPage();

    expect(html).toContain('class="profile-back-button"');
    expect(html).toContain('href="/profile"');
    expect(html).toContain('Back to profile');
    expect(html).toContain('Changes save automatically as you go.');

    const backIndex = html.indexOf('profile-back-button');
    const noteIndex = html.indexOf('Changes save automatically as you go.');
    expect(backIndex).toBeGreaterThan(-1);
    expect(noteIndex).toBeGreaterThan(backIndex);
    expect(noteIndex).toBeLessThan(html.indexOf('data-island="ProfileSettingsIsland"'));
  });

  it('does not mount the badge island on the settings page', () => {
    const html = renderProfileSettingsPage();

    expect(html).not.toContain('data-island="BadgeDisplayIsland"');
    expect(html).not.toContain('data-island="ProfileIsland"');
  });

  it('loads the settings and shared picker stylesheets', () => {
    const html = renderProfileSettingsPage();

    expect(html).toContain('/css/profile.css');
    expect(html).toContain('/css/profile-view.css');
  });
});

describe('friend profile page badge display wiring', () => {
  it('mounts the badge island below the friend profile island', () => {
    const html = renderFriendProfilePage();

    expect(html).toContain('data-island="BadgeDisplayIsland"');
    expect(countOccurrences(html, 'data-island="FriendProfileIsland"')).toBe(1);
    expect(countOccurrences(html, 'data-island="BadgeDisplayIsland"')).toBe(1);
    expect(html.indexOf('data-island="FriendProfileIsland"')).toBeLessThan(
      html.indexOf('data-island="BadgeDisplayIsland"'),
    );
  });

  it('keeps the existing friend stylesheets and adds the badge stylesheet', () => {
    const html = renderFriendProfilePage();

    expect(html).toContain('/css/party.css');
    expect(html).toContain('/css/friends.css');
    expect(html).toContain('/css/badge-display.css');
  });
});
