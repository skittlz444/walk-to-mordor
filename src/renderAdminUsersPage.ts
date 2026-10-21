import { renderAdminShell } from './renderAdminShell';

export function renderAdminUsersPage(): string {
  return renderAdminShell({
    title: 'Walk to Mordor - Admin Users',
    description: 'Admin user support for Walk to Mordor',
    activeNav: 'users',
    breadcrumb: [{ label: 'Admin', href: '/admin' }, { label: 'Users' }],
    content: '<div data-island="AdminUsersListIsland"></div>',
  });
}
