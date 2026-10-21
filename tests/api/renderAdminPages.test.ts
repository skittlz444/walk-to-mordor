import { renderAdminPage } from '../../src/renderAdminPage';
import { renderAdminGoalsPage } from '../../src/renderAdminGoalsPage';
import { renderAdminGoalAddPage } from '../../src/renderAdminGoalAddPage';
import { renderAdminGoalEditPage } from '../../src/renderAdminGoalEditPage';
import { renderAdminStorylinesPage } from '../../src/renderAdminStorylinesPage';

interface AdminPageCase {
  name: string;
  render: () => string;
  title: string;
  activeHref: string;
  island: string;
  breadcrumb: string[];
}

const PAGES: AdminPageCase[] = [
  {
    name: 'dashboard',
    render: renderAdminPage,
    title: 'Walk to Mordor - Admin Dashboard',
    activeHref: '/admin',
    island: 'AdminDashboardIsland',
    breadcrumb: ['Admin', 'Dashboard'],
  },
  {
    name: 'goals list',
    render: renderAdminGoalsPage,
    title: 'Walk to Mordor - Admin Goals',
    activeHref: '/admin/goals',
    island: 'AdminGoalsListIsland',
    breadcrumb: ['Admin', 'Goals'],
  },
  {
    name: 'goal add',
    render: renderAdminGoalAddPage,
    title: 'Walk to Mordor - Add New Goal',
    activeHref: '/admin/goals',
    island: 'AdminGoalAddIsland',
    breadcrumb: ['Admin', 'Goals', 'Add New Goal'],
  },
  {
    name: 'goal edit',
    render: renderAdminGoalEditPage,
    title: 'Walk to Mordor - Edit Goal',
    activeHref: '/admin/goals',
    island: 'AdminGoalEditIsland',
    breadcrumb: ['Admin', 'Goals', 'Edit Goal'],
  },
  {
    name: 'storylines',
    render: renderAdminStorylinesPage,
    title: 'Walk to Mordor - Admin Storylines',
    activeHref: '/admin/storylines',
    island: 'AdminStorylinesIsland',
    breadcrumb: ['Admin', 'Storylines'],
  },
];

function anchorFor(html: string, href: string): string {
  const start = html.indexOf(`<a href="${href}"`);
  if (start === -1) return '';
  const end = html.indexOf('</a>', start);
  return html.slice(start, end);
}

describe('admin pages', () => {
  describe.each(PAGES)('$name', (page) => {
    const html = page.render();

    it('renders a complete HTML document with the admin shell', () => {
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
      expect(html).toContain(`<title>${page.title}</title>`);
      expect(html).toContain('/css/admin.css');
      expect(html).toContain('class="admin-body"');
      expect(html).toContain('Admin Portal');
      expect(html).toContain('aria-label="Admin navigation"');
      expect(html).toContain('aria-label="Breadcrumb"');
    });

    it('marks only the current section as active', () => {
      const active = anchorFor(html, page.activeHref);
      expect(active).toContain('admin-nav__link--active');
      expect(active).toContain('aria-current="page"');

      const otherHrefs = ['/admin', '/admin/goals', '/admin/storylines', '/admin/users', '/admin/metrics']
        .filter((href) => href !== page.activeHref);
      for (const href of otherHrefs) {
        expect(anchorFor(html, href)).not.toContain('aria-current="page"');
      }
    });

    it('mounts the page island under the expected breadcrumb', () => {
      expect(html).toContain(`data-island="${page.island}"`);
      for (const label of page.breadcrumb) {
        expect(html).toContain(`>${label}</`);
      }
    });
  });

  it('keeps the admin nav in a stable order', () => {
    const html = renderAdminPage();
    const order = ['/admin', '/admin/goals', '/admin/storylines', '/admin/users', '/admin/metrics'];
    const positions = order.map((href) => html.indexOf(`<a href="${href}"`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain('<a href="/journey" class="admin-nav__link admin-nav__link--back">');
  });
});
