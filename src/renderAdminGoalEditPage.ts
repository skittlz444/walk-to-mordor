import { renderAdminShell } from './renderAdminShell';

export function renderAdminGoalEditPage(): string {
  return renderAdminShell({
    title: 'Walk to Mordor - Edit Goal',
    description: 'Admin goal editing for Walk to Mordor',
    activeNav: 'goals',
    breadcrumb: [{ label: 'Admin', href: '/admin' }, { label: 'Goals', href: '/admin/goals' }, { label: 'Edit Goal' }],
    content: '<div data-island="AdminGoalEditIsland"></div>',
  });
}
