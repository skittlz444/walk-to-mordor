import { renderAdminShell } from './renderAdminShell';

export function renderAdminMetricsPage(): string {
  return renderAdminShell({
    title: 'Walk to Mordor - Admin Metrics',
    description: 'Admin community metrics for Walk to Mordor',
    activeNav: 'metrics',
    breadcrumb: [{ label: 'Admin', href: '/admin' }, { label: 'Metrics' }],
    content: '<div data-island="AdminMetricsIsland"></div>',
  });
}
