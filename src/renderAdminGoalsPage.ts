import { renderAdminShell } from './renderAdminShell';

export function renderAdminGoalsPage(): string {
  return renderAdminShell({
    title: 'Walk to Mordor - Admin Goals',
    description: 'Admin goal management for Walk to Mordor',
    activeNav: 'goals',
    breadcrumb: [{ label: 'Admin', href: '/admin' }, { label: 'Goals' }],
    content: '<div data-island="AdminGoalsListIsland"></div>',
  });
}
