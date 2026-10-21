import { renderAdminPage } from '../../src/renderAdminPage';
import { renderAdminGoalsPage } from '../../src/renderAdminGoalsPage';
import { renderAdminGoalAddPage } from '../../src/renderAdminGoalAddPage';
import { renderAdminGoalEditPage } from '../../src/renderAdminGoalEditPage';
import { renderAdminStorylinesPage } from '../../src/renderAdminStorylinesPage';
import { renderAdminUsersPage } from '../../src/renderAdminUsersPage';
import { renderAdminMetricsPage } from '../../src/renderAdminMetricsPage';

interface AdminPageCase {
  name: string;
  render: () => string;
  title: string;
  description: string;
  activeHref: string;
  island: string;
  breadcrumb: string[];
  /**
   * href for each non-final breadcrumb label that is rendered as a link,
   * keyed by label (mirrors the arguments passed to renderAdminShell).
   */
  breadcrumbLinks: Record<string, string>;
}

const PAGES: AdminPageCase[] = [
  {
    name: 'dashboard',
    render: renderAdminPage,
    title: 'Walk to Mordor - Admin Dashboard',
    description: 'Admin dashboard for Walk to Mordor',
    activeHref: '/admin',
    island: 'AdminDashboardIsland',
    breadcrumb: ['Admin', 'Dashboard'],
    breadcrumbLinks: { Admin: '/admin' },
  },
  {
    name: 'goals list',
    render: renderAdminGoalsPage,
    title: 'Walk to Mordor - Admin Goals',
    description: 'Admin goal management for Walk to Mordor',
    activeHref: '/admin/goals',
    island: 'AdminGoalsListIsland',
    breadcrumb: ['Admin', 'Goals'],
    breadcrumbLinks: { Admin: '/admin' },
  },
  {
    name: 'goal add',
    render: renderAdminGoalAddPage,
    title: 'Walk to Mordor - Add New Goal',
    description: 'Admin add new goal for Walk to Mordor',
    activeHref: '/admin/goals',
    island: 'AdminGoalAddIsland',
    breadcrumb: ['Admin', 'Goals', 'Add New Goal'],
    breadcrumbLinks: { Admin: '/admin', Goals: '/admin/goals' },
  },
  {
    name: 'goal edit',
    render: renderAdminGoalEditPage,
    title: 'Walk to Mordor - Edit Goal',
    description: 'Admin goal editing for Walk to Mordor',
    activeHref: '/admin/goals',
    island: 'AdminGoalEditIsland',
    breadcrumb: ['Admin', 'Goals', 'Edit Goal'],
    breadcrumbLinks: { Admin: '/admin', Goals: '/admin/goals' },
  },
  {
    name: 'storylines',
    render: renderAdminStorylinesPage,
    title: 'Walk to Mordor - Admin Storylines',
    description: 'Admin storyline management for Walk to Mordor',
    activeHref: '/admin/storylines',
    island: 'AdminStorylinesIsland',
    breadcrumb: ['Admin', 'Storylines'],
    breadcrumbLinks: { Admin: '/admin' },
  },
  {
    name: 'users',
    render: renderAdminUsersPage,
    title: 'Walk to Mordor - Admin Users',
    description: 'Admin user support for Walk to Mordor',
    activeHref: '/admin/users',
    island: 'AdminUsersListIsland',
    breadcrumb: ['Admin', 'Users'],
    breadcrumbLinks: { Admin: '/admin' },
  },
  {
    name: 'metrics',
    render: renderAdminMetricsPage,
    title: 'Walk to Mordor - Admin Metrics',
    description: 'Admin community metrics for Walk to Mordor',
    activeHref: '/admin/metrics',
    island: 'AdminMetricsIsland',
    breadcrumb: ['Admin', 'Metrics'],
    breadcrumbLinks: { Admin: '/admin' },
  },
];

function anchorFor(html: string, href: string): string {
  const start = html.indexOf(`<a href="${href}"`);
  if (start === -1) return '';
  const end = html.indexOf('</a>', start);
  return html.slice(start, end);
}

function breadcrumbSlice(html: string): string {
  const start = html.indexOf('admin-breadcrumb');
  const end = html.indexOf('</nav>', start);
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

    it('declares the page meta description', () => {
      expect(html).toContain(`<meta name="description" content="${page.description}" />`);
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

      const breadcrumbHtml = breadcrumbSlice(html);

      const labels = page.breadcrumb;
      for (let i = 0; i < labels.length - 1; i += 1) {
        const label = labels[i];
        const href = page.breadcrumbLinks[label];
        if (href) {
          expect(breadcrumbHtml).toContain(`<a href="${href}">${label}</a>`);
        } else {
          throw new Error(`Test table is missing the expected href for breadcrumb label "${label}" on page "${page.name}"`);
        }
        expect(breadcrumbHtml).not.toContain(`<li aria-current="page">${label}</li>`);
      }

      const finalLabel = labels[labels.length - 1];
      expect(breadcrumbHtml).toContain(`<li aria-current="page">${finalLabel}</li>`);
    });
  });

  it('renders the shared admin shell chrome', () => {
    const html = renderAdminPage();
    expect(html).toContain('/js/client/islands.css');
    expect(html).toContain('font-awesome');
    expect(html).toContain('class="admin-layout"');
    expect(html).toContain('class="admin-nav"');
    expect(html).toContain('class="admin-content"');

    const iconTags = html.match(/<i class="fas [^"]*"[^>]*>/g) ?? [];
    expect(iconTags.length).toBeGreaterThan(0);
    for (const tag of iconTags) {
      expect(tag).toContain('aria-hidden="true"');
      expect(tag).not.toContain('aria-disabled="true"');
    }
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
