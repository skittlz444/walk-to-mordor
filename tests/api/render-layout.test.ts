import { renderLayout } from '../../src/renderLayout';
import { ASSET_VERSIONS } from '../../src/generated/asset-versions';

const BASE_STYLESHEET_ORDER = [
  '/css/calendar.css',
  '/css/progress.css',
  '/css/goals.css',
  '/css/profile.css',
  '/css/palantir.css',
  '/css/wrapped.css',
  '/css/main.css',
  '/css/drawer.css',
  '/css/badge-award.css',
];

const versioned = (path: string): string =>
  `${path}?v=${ASSET_VERSIONS[path]}`;

const baseConfig = {
  title: 'Test',
  description: 'Test page',
  headerContent: '<h1>Header</h1>',
  mainContent: '<p>Main</p>',
};

function stylesheetHrefs(html: string): string[] {
  return [...html.matchAll(/<link[^>]*href="([^"]+\.css[^"]*)"[^>]*rel="stylesheet"/g)]
    .map((match) => match[1]);
}

describe('renderLayout asset resolution', () => {
  it('versions stylesheets, scripts, icons, manifest, and the islands bundle', () => {
    const html = renderLayout({
      ...baseConfig,
      stylesheets: ['/css/events.css'],
      scripts: ['/js/calendar.js'],
    });

    expect(html).toContain(`href="${versioned('/manifest.json')}"`);
    expect(html).toContain(`href="${versioned('/icons/icon.svg')}"`);
    expect(html).toContain(`href="${versioned('/icons/icon-192x192.png')}"`);
    expect(html).toContain(`href="${versioned('/css/main.css')}"`);
    expect(html).toContain(`href="${versioned('/js/client/islands.css')}"`);
    expect(html).toContain(`src="${versioned('/js/client/islands.js')}"`);
    expect(html).toContain(`src="${versioned('/js/calendar.js')}"`);
    expect(html).toContain(`src="${versioned('/js/main.js')}"`);
  });

  it('emits the base stylesheet cascade before page-specific stylesheets', () => {
    const html = renderLayout({
      ...baseConfig,
      stylesheets: ['/css/events.css', '/css/map.css'],
    });

    expect(stylesheetHrefs(html)).toEqual([
      ...BASE_STYLESHEET_ORDER.map(versioned),
      versioned('/css/events.css'),
      versioned('/css/map.css'),
    ]);
  });

  it('omits main.js on public pages', () => {
    const html = renderLayout({ ...baseConfig, publicPage: true });

    expect(html).not.toContain('/js/main.js');
    expect(html).toContain(`src="${versioned('/js/client/islands.js')}"`);
  });
});
