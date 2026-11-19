import { ASSET_VERSIONS } from './generated/asset-versions';

/**
 * Resolve an entry-asset path to its versioned URL.
 *
 * - Known paths (from `src/generated/asset-versions.ts`) get `?v=<hash>`.
 * - Existing query parameters are preserved; an existing `v` is replaced.
 * - Unknown paths are returned byte-for-byte unchanged.
 *
 * Server-side resolution point for Worker-rendered HTML and payloads. Page
 * renderers may keep passing raw paths to `renderLayout`; the layout (or a
 * standalone page head) calls this helper.
 */
export function assetUrl(url: string): string {
  const fragmentIndex = url.indexOf('#');
  const fragment = fragmentIndex === -1 ? '' : url.slice(fragmentIndex);
  const withoutFragment = fragmentIndex === -1 ? url : url.slice(0, fragmentIndex);

  const queryIndex = withoutFragment.indexOf('?');
  const pathname = queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : withoutFragment.slice(queryIndex + 1);

  const version = ASSET_VERSIONS[pathname];
  if (version === undefined) {
    return url;
  }

  const params = query === '' ? [] : query.split('&');
  const versionIndex = params.findIndex((param) => param === 'v' || param.startsWith('v='));
  if (versionIndex === -1) {
    params.push(`v=${version}`);
  } else {
    params[versionIndex] = `v=${version}`;
  }
  return `${pathname}?${params.join('&')}${fragment}`;
}
