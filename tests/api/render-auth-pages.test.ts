import { renderAuthPage } from '../../src/renderAuthPage';
import {
  renderPasswordResetPage,
  renderPasswordResetRequestPage,
} from '../../src/renderPasswordResetPage';
import { ASSET_VERSIONS } from '../../src/generated/asset-versions';

const versioned = (path: string): string =>
  `${path}?v=${ASSET_VERSIONS[path]}`;

const pages = [
  { name: 'login', render: renderAuthPage, scripts: ['/js/client/islands.js'] },
  {
    name: 'password reset request',
    render: renderPasswordResetRequestPage,
    scripts: ['/js/password-reset.js'],
  },
  {
    name: 'password reset',
    render: renderPasswordResetPage,
    scripts: ['/js/password-reset.js'],
  },
];

describe('standalone auth page asset resolution', () => {
  it.each(pages)('versions the $name head and client bundle', ({ render, scripts }) => {
    const html = render();

    expect(html).toContain(`href="${versioned('/manifest.json')}"`);
    expect(html).toContain(`href="${versioned('/icons/icon.svg')}"`);
    expect(html).toContain(`href="${versioned('/icons/icon-192x192.png')}"`);
    expect(html).toContain(`href="${versioned('/css/main.css')}"`);
    expect(html).toContain(`href="${versioned('/css/auth.css')}"`);
    for (const script of scripts) {
      expect(html).toContain(`src="${versioned(script)}"`);
    }
  });

  it.each(pages)('leaves no unversioned asset URLs in the $name head', ({ render }) => {
    const hrefs = [...render().matchAll(/(?:href|src)="(\/(?:css|js|icons)\/[^"]*)"/g)]
      .map((match) => match[1]);

    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.every((href) => href.includes('?v='))).toBe(true);
  });
});
