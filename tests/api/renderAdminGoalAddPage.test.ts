import { renderAdminGoalAddPage } from '../../src/renderAdminGoalAddPage';

describe('renderAdminGoalAddPage', () => {
  let html: string;

  beforeAll(() => {
    html = renderAdminGoalAddPage();
  });

  describe('HTML structure', () => {
    it('should return valid HTML document', () => {
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
    });

    it('should have correct page title', () => {
      expect(html).toContain('<title>Walk to Mordor - Add New Goal</title>');
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

    it('should have Goals link marked as active with aria-current', () => {
      expect(html).toContain('admin-nav__link--active');
      expect(html).toContain('aria-current="page"');
    });

    it('should have Dashboard link pointing to /admin (NOT active)', () => {
      expect(html).toContain('href="/admin"');
      const dashboardLinkIdx = html.indexOf('href="/admin"');
      const dashboardLinkStart = html.lastIndexOf('<a', dashboardLinkIdx);
      const dashboardLinkSnippet = html.substring(dashboardLinkStart, dashboardLinkIdx + 50);
      expect(dashboardLinkSnippet).not.toContain('admin-nav__link--active');
    });

    it('should have disabled Users and Metrics nav items', () => {
      expect(html).toContain('admin-nav__link--disabled');
      expect(html).toContain('aria-disabled="true"');
    });

    it('should have "Back to Site" link', () => {
      expect(html).toContain('href="/journey"');
      expect(html).toContain('Back to Site');
    });
  });

  describe('main content area', () => {
    it('should have AdminGoalAddIsland mount point', () => {
      expect(html).toContain('data-island="AdminGoalAddIsland"');
    });

    it('should have breadcrumb navigation', () => {
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain('admin-breadcrumb');
    });

    it('should have correct breadcrumb trail: Admin > Goals > Add New Goal', () => {
      expect(html).toContain('<a href="/admin">Admin</a>');
      expect(html).toContain('<a href="/admin/goals">Goals</a>');
      const breadcrumbSection = html.substring(
        html.indexOf('admin-breadcrumb'),
        html.indexOf('</nav>', html.indexOf('admin-breadcrumb')) + 6
      );
      expect(breadcrumbSection).toContain('Add New Goal');
    });

    it('should have admin-layout container with nav and content areas', () => {
      expect(html).toContain('admin-layout');
      expect(html).toContain('admin-nav');
      expect(html).toContain('admin-content');
    });
  });

  describe('meta and scripts', () => {
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
      const iconMatches = html.match(/<i class="fas [^"]*"/g) || [];
      expect(iconMatches.length).toBeGreaterThan(0);
      const ariaHiddenIcons = html.match(/<i class="fas [^"]*" aria-hidden="true"/g) || [];
      expect(ariaHiddenIcons.length).toBe(iconMatches.length);
    });

    it('should have aria-disabled on disabled nav items', () => {
      const disabledMatches = html.match(/aria-disabled="true"/g) || [];
      expect(disabledMatches.length).toBe(2);
    });
  });
});
