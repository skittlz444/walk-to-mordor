import { assetUrl } from '../../src/asset-url';
import { ASSET_VERSIONS } from '../../src/generated/asset-versions';

describe('assetUrl', () => {
  it('appends the version for a known entry asset', () => {
    expect(assetUrl('/css/main.css')).toBe(
      `/css/main.css?v=${ASSET_VERSIONS['/css/main.css']}`,
    );
  });

  it('preserves an existing query string and appends v', () => {
    expect(assetUrl('/js/main.js?foo=bar')).toBe(
      `/js/main.js?foo=bar&v=${ASSET_VERSIONS['/js/main.js']}`,
    );
  });

  it('replaces an existing v instead of duplicating it', () => {
    expect(assetUrl('/js/main.js?foo=bar&v=stale')).toBe(
      `/js/main.js?foo=bar&v=${ASSET_VERSIONS['/js/main.js']}`,
    );
  });

  it('returns unknown paths unchanged', () => {
    expect(assetUrl('/img/highres/unknown.webp')).toBe('/img/highres/unknown.webp');
    expect(assetUrl('/css/not-a-real-sheet.css?v=keep')).toBe('/css/not-a-real-sheet.css?v=keep');
  });

  it('preserves a fragment', () => {
    expect(assetUrl('/icons/icon.svg#top')).toBe(
      `/icons/icon.svg?v=${ASSET_VERSIONS['/icons/icon.svg']}#top`,
    );
  });
});
