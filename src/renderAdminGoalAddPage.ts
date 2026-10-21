import { renderAdminShell } from './renderAdminShell';

export function renderAdminGoalAddPage(): string {
  return renderAdminShell({
    title: 'Walk to Mordor - Add New Goal',
    description: 'Admin add new goal for Walk to Mordor',
    activeNav: 'goals',
    breadcrumb: [{ label: 'Admin', href: '/admin' }, { label: 'Goals', href: '/admin/goals' }, { label: 'Add New Goal' }],
    content: '<div data-island="AdminGoalAddIsland"></div>',
  });
}
