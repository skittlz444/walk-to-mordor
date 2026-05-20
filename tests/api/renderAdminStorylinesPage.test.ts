import { renderAdminStorylinesPage } from '../../src/renderAdminStorylinesPage';

describe('renderAdminStorylinesPage', () => {
  let html: string;

  beforeAll(() => {
    html = renderAdminStorylinesPage();
  });

  it('returns an admin storylines HTML document', () => {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Walk to Mordor - Admin Storylines</title>');
    expect(html).toContain('/css/admin.css');
    expect(html).toContain('class="admin-body"');
  });

  it('marks Storylines as the active admin nav item', () => {
    const storylinesIdx = html.indexOf('href="/admin/storylines"');
    const storylinesLinkStart = html.lastIndexOf('<a', storylinesIdx);
    const storylinesLinkEnd = html.indexOf('>', storylinesIdx) + 1;
    const storylinesLinkTag = html.substring(storylinesLinkStart, storylinesLinkEnd);

    expect(storylinesLinkTag).toContain('admin-nav__link--active');
    expect(storylinesLinkTag).toContain('aria-current="page"');
    expect(html).toContain('fa-route');
  });

  it('mounts the AdminStorylinesIsland', () => {
    expect(html).toContain('data-island="AdminStorylinesIsland"');
  });

  it('includes the expected breadcrumb', () => {
    expect(html).toContain('<a href="/admin">Admin</a>');
    expect(html).toContain('<li aria-current="page">Storylines</li>');
  });
});
