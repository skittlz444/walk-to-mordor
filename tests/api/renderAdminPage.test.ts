import { renderAdminPage } from '../../src/renderAdminPage';

describe('renderAdminPage', () => {
  let html: string;

  beforeAll(() => {
    html = renderAdminPage();
  });

  describe('HTML structure', () => {
    it('should return valid HTML document', () => {
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('should have correct page title', () => {
      expect(html).toContain('<title>Walk to Mordor - Admin Dashboard</title>');
    });

    it('should include admin.css stylesheet', () => {
      expect(html).toContain('/css/admin.css');
    });

    it('should have admin-body class on body', () => {
      expect(html).toContain('class="admin-body"');
    });

    it('should have admin header with shield icon', () => {
      expect(html).toContain('Admin Portal');
      expect(html).toContain('fa-shield-halved');
    });
  });

  describe('sidebar navigation', () => {
    it('should have admin navigation landmark', () => {
      expect(html).toContain('aria-label="Admin navigation"');
    });

    it('should have Dashboard link marked as active with aria-current', () => {
      expect(html).toContain('admin-nav__link--active');
      expect(html).toContain('aria-current="page"');
      expect(html).toContain('href="/admin"');
    });

    it('should have Goals link pointing to /admin/goals', () => {
      expect(html).toContain('href="/admin/goals"');
      expect(html).toContain('fa-flag-checkered');
    });

    it('should have Storylines link pointing to /admin/storylines', () => {
      expect(html).toContain('href="/admin/storylines"');
      expect(html).toContain('fa-route');
    });

    it('should have Users link pointing to /admin/users', () => {
      expect(html).toContain('href="/admin/users"');
      expect(html).toContain('fa-users');
    });

    it('should have Metrics link pointing to /admin/metrics', () => {
      expect(html).toContain('href="/admin/metrics"');
      expect(html).toContain('fa-chart-bar');
    });

    it('should have "Back to Site" link pointing to /journey', () => {
      expect(html).toContain('href="/journey"');
      expect(html).toContain('Back to Site');
      expect(html).toContain('fa-arrow-left');
    });

    it('should have correct nav link order: Dashboard, Goals, Storylines, Users, Metrics', () => {
      const dashIdx = html.indexOf('Dashboard</span>');
      const goalsIdx = html.indexOf('Goals</span>');
      const storylinesIdx = html.indexOf('Storylines</span>');
      const usersIdx = html.indexOf('Users</span>');
      const metricsIdx = html.indexOf('Metrics</span>');

      expect(dashIdx).toBeGreaterThan(-1);
      expect(goalsIdx).toBeGreaterThan(dashIdx);
      expect(storylinesIdx).toBeGreaterThan(goalsIdx);
      expect(usersIdx).toBeGreaterThan(storylinesIdx);
      expect(metricsIdx).toBeGreaterThan(usersIdx);
    });
  });

  describe('main content area', () => {
    it('should have AdminDashboardIsland mount point', () => {
      expect(html).toContain('data-island="AdminDashboardIsland"');
    });

    it('should have breadcrumb navigation', () => {
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain('admin-breadcrumb');
    });

    it('should have correct breadcrumb trail: Admin > Dashboard', () => {
      // Breadcrumb should contain Admin link and Dashboard as current
      expect(html).toContain('<a href="/admin">Admin</a>');
      const breadcrumbSection = html.substring(
        html.indexOf('admin-breadcrumb'),
        html.indexOf('</nav>', html.indexOf('admin-breadcrumb')) + 6
      );
      expect(breadcrumbSection).toContain('Dashboard');
    });

    it('should have admin-layout container with nav and content areas', () => {
      expect(html).toContain('admin-layout');
      expect(html).toContain('admin-nav');
      expect(html).toContain('admin-content');
    });
  });

  describe('meta and scripts', () => {
    it('should include meta description for admin dashboard', () => {
      expect(html).toContain('content="Admin dashboard for Walk to Mordor"');
    });

    it('should include Preact islands script module', () => {
      expect(html).toContain('src="/js/client/islands.js"');
      expect(html).toContain('type="module"');
    });

    it('should include islands CSS', () => {
      expect(html).toContain('/js/client/islands.css');
    });

    it('should include Font Awesome stylesheet', () => {
      expect(html).toContain('font-awesome');
    });

    it('should include main.css stylesheet', () => {
      expect(html).toContain('/css/main.css');
    });
  });

  describe('accessibility', () => {
    it('should use aria-hidden on decorative icons', () => {
      // All Font Awesome icons should be aria-hidden
      const iconMatches = html.match(/<i class="fas [^"]*"/g) || [];
      expect(iconMatches.length).toBeGreaterThan(0);
      // Every icon should be followed by aria-hidden="true"
      const ariaHiddenIcons = html.match(/<i class="fas [^"]*" aria-hidden="true"/g) || [];
      expect(ariaHiddenIcons.length).toBe(iconMatches.length);
    });

    it('should not have aria-disabled nav items', () => {
      const disabledMatches = html.match(/aria-disabled="true"/g) || [];
      expect(disabledMatches.length).toBe(0);
    });
  });
});
