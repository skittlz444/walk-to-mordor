import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ASSET_VERSIONS_TIMEOUT_MS,
  assetUrl,
  loadAssetVersions,
} from './assetUrl';

const STORAGE_KEY = 'wtm:image-versions';

function okResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload),
  } as unknown as Response;
}

function seedCache(assets: Record<string, string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ assets }));
}

describe('assetUrl', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns unversioned paths when no map could be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));

    await loadAssetVersions();

    expect(assetUrl('/img/thumbs/rivendell-thumb.webp'))
      .toBe('/img/thumbs/rivendell-thumb.webp');
  });

  it('versions known paths from the fetched map and caches it', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okResponse({
      version: 'map-hash',
      assets: { '/img/avatars/frodo.webp': 'abc123' },
    }))));

    await loadAssetVersions();

    expect(assetUrl('/img/avatars/frodo.webp')).toBe('/img/avatars/frodo.webp?v=abc123');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).assets)
      .toEqual({ '/img/avatars/frodo.webp': 'abc123' });
  });

  it('leaves unknown paths and existing queries intact', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okResponse({
      assets: { '/img/thumbs/known-thumb.webp': 'known1' },
    }))));

    await loadAssetVersions();

    expect(assetUrl('/img/thumbs/missing-thumb.webp')).toBe('/img/thumbs/missing-thumb.webp');
    expect(assetUrl('/img/thumbs/known-thumb.webp?a=b')).toBe('/img/thumbs/known-thumb.webp?a=b&v=known1');
  });

  it('applies an explicit version override for paths outside the image map', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    await loadAssetVersions();

    expect(assetUrl('/img/map/tiles/2/3_4.webp', 'tileset1'))
      .toBe('/img/map/tiles/2/3_4.webp?v=tileset1');
  });

  it('falls back to the cached map when the fetch fails', async () => {
    seedCache({ '/img/achievements/full/badge.webp': 'cached1' });
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));

    await loadAssetVersions();

    expect(assetUrl('/img/achievements/full/badge.webp'))
      .toBe('/img/achievements/full/badge.webp?v=cached1');
  });

  it('bounds the wait and uses the cached map when the fetch hangs', async () => {
    seedCache({ '/img/avatars/samwise.webp': 'cached2' });
    vi.useFakeTimers();

    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    vi.stubGlobal('fetch', fetchMock);

    const loading = loadAssetVersions();
    await vi.advanceTimersByTimeAsync(ASSET_VERSIONS_TIMEOUT_MS);
    await expect(loading).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(assetUrl('/img/avatars/samwise.webp')).toBe('/img/avatars/samwise.webp?v=cached2');
  });
});
