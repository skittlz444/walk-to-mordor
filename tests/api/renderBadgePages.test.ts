import { renderProfilePage } from '../../src/renderProfilePage';
import { renderFriendProfilePage } from '../../src/renderFriendProfilePage';

function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe('profile page badge display wiring', () => {
  it('mounts the badge island after the existing profile islands', () => {
    const html = renderProfilePage();

    expect(html).toContain('data-island="BadgeDisplayIsland"');
    expect(countOccurrences(html, 'data-island="ProfileIsland"')).toBe(1);
    expect(countOccurrences(html, 'data-island="PushPermissionIsland"')).toBe(1);
    expect(countOccurrences(html, 'data-island="BadgeDisplayIsland"')).toBe(1);
    expect(html.indexOf('data-island="ProfileIsland"')).toBeLessThan(
      html.indexOf('data-island="BadgeDisplayIsland"'),
    );
    expect(html.indexOf('data-island="PushPermissionIsland"')).toBeLessThan(
      html.indexOf('data-island="BadgeDisplayIsland"'),
    );
  });

  it('loads the badge stylesheet on the profile page', () => {
    const html = renderProfilePage();

    expect(html).toContain('/css/profile.css');
    expect(html).toContain('/css/badge-display.css');
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
