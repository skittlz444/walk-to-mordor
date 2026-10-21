import { renderAdminShell } from './renderAdminShell';

export function renderAdminPage(): string {
  return renderAdminShell({
    title: 'Walk to Mordor - Admin Dashboard',
    description: 'Admin dashboard for Walk to Mordor',
    activeNav: 'dashboard',
    breadcrumb: [{ label: 'Admin', href: '/admin' }, { label: 'Dashboard' }],
    content: '<div data-island="AdminDashboardIsland"></div>',
  });
}
