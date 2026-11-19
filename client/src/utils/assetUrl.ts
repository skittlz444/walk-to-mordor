/**
 * Client-side asset resolution through the runtime image version map.
 *
 * `public/img/image-versions.json` is generated at build time:
 * `{ "version": "<map hash>", "assets": { "/img/...": "<hash>" } }`.
 *
 * - `assetUrl()` is synchronous. Known paths get `?v=<hash>`; unknown paths and
 *   paths with no loaded map are returned unchanged, so images still resolve.
 * - `loadAssetVersions()` fetches the map with a short timeout, caches it in
 *   localStorage, and silently falls back to the cached copy. It never throws
 *   and never blocks hydration beyond its own timeout.
 *
 * Image changes only change the map, never the client bundle.
 */

const VERSIONS_URL = '/img/image-versions.json';
const STORAGE_KEY = 'wtm:image-versions';

/** Upper bound on how long startup waits for the runtime map. */
export const ASSET_VERSIONS_TIMEOUT_MS = 1500;

type AssetVersionMap = Readonly<Record<string, string>>;

let assetVersions: AssetVersionMap | null = null;

function readVersionMap(value: unknown): AssetVersionMap | null {
  if (!value || typeof value !== 'object') return null;
  const assets = (value as { assets?: unknown }).assets;
  if (!assets || typeof assets !== 'object') return null;

  const map: Record<string, string> = {};
  for (const [path, version] of Object.entries(assets)) {
    if (typeof version === 'string' && version !== '') {
      map[path] = version;
    }
  }
  return map;
}

function readCachedVersions(): AssetVersionMap | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? readVersionMap(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

function persistVersions(map: AssetVersionMap): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ assets: map }));
  } catch {
    // Storage can be full or blocked; the in-memory map still works.
  }
}

/**
 * Resolve an image path to its versioned URL.
 *
 * Existing query parameters are preserved; a supplied `version` (for example
 * the shared map-tile-set version) skips the map lookup.
 */
export function assetUrl(path: string, version?: string): string {
  const fragmentIndex = path.indexOf('#');
  const fragment = fragmentIndex === -1 ? '' : path.slice(fragmentIndex);
  const withoutFragment = fragmentIndex === -1 ? path : path.slice(0, fragmentIndex);

  const queryIndex = withoutFragment.indexOf('?');
  const pathname = queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : withoutFragment.slice(queryIndex + 1);

  const resolved = version ?? assetVersions?.[pathname];
  if (!resolved) {
    return path;
  }

  const params = query === '' ? [] : query.split('&');
  const versionIndex = params.findIndex((param) => param === 'v' || param.startsWith('v='));
  if (versionIndex === -1) {
    params.push(`v=${resolved}`);
  } else {
    params[versionIndex] = `v=${resolved}`;
  }
  return `${pathname}?${params.join('&')}${fragment}`;
}

/**
 * Load the runtime image version map.
 *
 * Resolves after success, timeout, or failure. On failure the last cached map
 * (if any) is used; without a cache the resolver returns unversioned paths.
 */
export async function loadAssetVersions(): Promise<void> {
  const cached = readCachedVersions();
  let loaded: AssetVersionMap | null = null;

  const controller = typeof AbortController === 'undefined' ? null : new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller?.abort();
        reject(new Error('asset version map request timed out'));
      }, ASSET_VERSIONS_TIMEOUT_MS);
    });

    const response = await Promise.race([
      fetch(VERSIONS_URL, controller ? { signal: controller.signal } : undefined),
      timeout,
    ]);

    if (response.ok) {
      loaded = readVersionMap(await response.json());
      if (loaded) {
        persistVersions(loaded);
      }
    }
  } catch {
    loaded = null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  assetVersions = loaded ?? cached;
}
