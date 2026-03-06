import { renderLayout } from './renderLayout';

export function renderAdminGoalsPage(): string {
  return renderLayout({
    title: 'Walk to Mordor - Admin Goals',
    description: 'Admin goal management for Walk to Mordor',
    stylesheets: ['/css/admin.css'],
    bodyClass: 'admin-body',
    headerContent: `
      <div class="admin-header">
        <h1><i class="fas fa-shield-halved" aria-hidden="true"></i> Admin Portal</h1>
      </div>`,
    mainContent: `
      <div class="admin-layout">
        <nav class="admin-nav" aria-label="Admin navigation">
          <ul class="admin-nav__list">
            <li>
              <a href="/admin" class="admin-nav__link">
                <i class="fas fa-chart-line" aria-hidden="true"></i>
                <span>Dashboard</span>
              </a>
            </li>
            <li>
              <a href="/admin/goals" class="admin-nav__link admin-nav__link--active" aria-current="page">
                <i class="fas fa-flag-checkered" aria-hidden="true"></i>
                <span>Goals</span>
              </a>
            </li>
            <li>
              <span class="admin-nav__link admin-nav__link--disabled" aria-disabled="true">
                <i class="fas fa-users" aria-hidden="true"></i>
                <span>Users</span>
                <small class="admin-nav__badge">Soon</small>
              </span>
            </li>
            <li>
              <span class="admin-nav__link admin-nav__link--disabled" aria-disabled="true">
                <i class="fas fa-chart-bar" aria-hidden="true"></i>
                <span>Metrics</span>
                <small class="admin-nav__badge">Soon</small>
              </span>
            </li>
          </ul>
          <div class="admin-nav__footer">
            <a href="/journey" class="admin-nav__link admin-nav__link--back">
              <i class="fas fa-arrow-left" aria-hidden="true"></i>
              <span>Back to Site</span>
            </a>
          </div>
        </nav>
        <div class="admin-content">
          <nav class="admin-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li><a href="/admin">Admin</a></li>
              <li aria-current="page">Goals</li>
            </ol>
          </nav>
          <div data-island="AdminGoalsListIsland"></div>
        </div>
      </div>`,
  });
}
