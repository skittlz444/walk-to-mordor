import { renderLayout } from './renderLayout';

type AdminNavKey = 'dashboard' | 'goals' | 'storylines' | 'users' | 'metrics';

interface AdminBreadcrumbItem {
  label: string;
  href?: string;
}

export interface AdminShellOptions {
  title: string;
  description: string;
  activeNav: AdminNavKey;
  breadcrumb: AdminBreadcrumbItem[];
  content: string;
}

const NAV_ITEMS: ReadonlyArray<{
  key: AdminNavKey;
  href: string;
  icon: string;
  label: string;
}> = [
  { key: 'dashboard', href: '/admin', icon: 'fa-chart-line', label: 'Dashboard' },
  { key: 'goals', href: '/admin/goals', icon: 'fa-flag-checkered', label: 'Goals' },
  { key: 'storylines', href: '/admin/storylines', icon: 'fa-route', label: 'Storylines' },
  { key: 'users', href: '/admin/users', icon: 'fa-users', label: 'Users' },
  { key: 'metrics', href: '/admin/metrics', icon: 'fa-chart-bar', label: 'Metrics' },
];

function renderNav(activeNav: AdminNavKey): string {
  const items = NAV_ITEMS.map((item) => {
    const active = item.key === activeNav;
    const linkClass = active
      ? 'admin-nav__link admin-nav__link--active'
      : 'admin-nav__link';
    const current = active ? ' aria-current="page"' : '';
    return `            <li>
              <a href="${item.href}" class="${linkClass}"${current}>
                <i class="fas ${item.icon}" aria-hidden="true"></i>
                <span>${item.label}</span>
              </a>
            </li>`;
  }).join('\n');

  return `        <nav class="admin-nav" aria-label="Admin navigation">
          <ul class="admin-nav__list">
${items}
          </ul>
          <div class="admin-nav__footer">
            <a href="/journey" class="admin-nav__link admin-nav__link--back">
              <i class="fas fa-arrow-left" aria-hidden="true"></i>
              <span>Back to Site</span>
            </a>
          </div>
        </nav>`;
}

function renderBreadcrumb(items: AdminBreadcrumbItem[]): string {
  const listItems = items.map((item) => (
    item.href
      ? `              <li><a href="${item.href}">${item.label}</a></li>`
      : `              <li aria-current="page">${item.label}</li>`
  )).join('\n');

  return `          <nav class="admin-breadcrumb" aria-label="Breadcrumb">
            <ol>
${listItems}
            </ol>
          </nav>`;
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map((line) => pad + line).join('\n');
}

export function renderAdminShell(options: AdminShellOptions): string {
  return renderLayout({
    title: options.title,
    description: options.description,
    stylesheets: ['/css/admin.css'],
    bodyClass: 'admin-body',
    headerContent: `
      <div class="admin-header">
        <h1><i class="fas fa-shield-halved" aria-hidden="true"></i> Admin Portal</h1>
      </div>`,
    mainContent: `
      <div class="admin-layout">
${renderNav(options.activeNav)}
        <div class="admin-content">
${renderBreadcrumb(options.breadcrumb)}
${indent(options.content, 10)}
        </div>
      </div>`,
  });
}
