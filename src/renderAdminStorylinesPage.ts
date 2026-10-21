import { renderAdminShell } from './renderAdminShell';

export function renderAdminStorylinesPage(): string {
  return renderAdminShell({
    title: 'Walk to Mordor - Admin Storylines',
    description: 'Admin storyline management for Walk to Mordor',
    activeNav: 'storylines',
    breadcrumb: [{ label: 'Admin', href: '/admin' }, { label: 'Storylines' }],
    content: '<div data-island="AdminStorylinesIsland"></div>',
  });
}
