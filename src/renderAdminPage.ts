import { renderLayout } from './renderLayout';

export function renderAdminPage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Admin',
    description: 'Admin dashboard for Walk to Mordor',
    headerContent: '<h1>Admin</h1>',
    mainContent: `
        <section class="admin-placeholder" style="text-align: center; padding: 3rem 1rem;">
          <h2>Admin Dashboard</h2>
          <p style="color: #aaa; margin-top: 1rem;">Dashboard coming soon.</p>
        </section>`,
  });
}
