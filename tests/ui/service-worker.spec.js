const {
  test,
  expect,
  setupTest,
  waitForAuthenticated,
} = require('./helpers/common');

/**
 * The service worker is registered on window load (see src/renderLayout.ts).
 * Wait until it is active, then reload once if the current document is not yet
 * controlled — the SW deliberately has no `clients.claim()`, so a newly
 * activated worker only controls documents loaded after activation.
 */
async function ensureServiceWorkerControl(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  const alreadyControlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  if (!alreadyControlled) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAuthenticated(page);
  }

  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
}

async function getVersionedStylesheet(page) {
  return page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .find((element) => (element.getAttribute('href') || '').startsWith('/css/main.css?v='));
    return link ? link.getAttribute('href') : null;
  });
}

test.describe('Service Worker offline runtime maps', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
  });

  test('serves a versioned asset and the runtime maps from cache while offline', async ({ page, context }) => {
    await ensureServiceWorkerControl(page);

    const versionedStylesheet = await getVersionedStylesheet(page);
    expect(versionedStylesheet).toMatch(/^\/css\/main\.css\?v=[0-9a-f]{12}$/);

    // Warm the two runtime maps through the network-first rule while online.
    const warmup = await page.evaluate(async () => {
      const imageMap = await fetch('/img/image-versions.json');
      const tileMetadata = await fetch('/img/map/tiles/metadata.json');
      return {
        imageMapOk: imageMap.ok,
        tileMetadataOk: tileMetadata.ok,
      };
    });
    expect(warmup).toEqual({ imageMapOk: true, tileMetadataOk: true });

    await context.setOffline(true);

    const offlineResult = await page.evaluate(async ({ stylesheet }) => {
      const stylesheetResponse = await fetch(stylesheet);
      const stylesheetText = await stylesheetResponse.text();

      const imageMapResponse = await fetch('/img/image-versions.json');
      const imageMap = await imageMapResponse.json();

      const tileMetadataResponse = await fetch('/img/map/tiles/metadata.json');
      const tileMetadata = await tileMetadataResponse.json();

      return {
        stylesheetOk: stylesheetResponse.ok,
        stylesheetLength: stylesheetText.length,
        imageMapOk: imageMapResponse.ok,
        imageMapAssetCount: Object.keys(imageMap.assets || {}).length,
        tileMetadataOk: tileMetadataResponse.ok,
        tileLevelCount: Array.isArray(tileMetadata.levels) ? tileMetadata.levels.length : 0,
      };
    }, { stylesheet: versionedStylesheet });

    expect(offlineResult.stylesheetOk).toBe(true);
    expect(offlineResult.stylesheetLength).toBeGreaterThan(100);
    expect(offlineResult.imageMapOk).toBe(true);
    expect(offlineResult.imageMapAssetCount).toBeGreaterThan(0);
    expect(offlineResult.tileMetadataOk).toBe(true);
    expect(offlineResult.tileLevelCount).toBeGreaterThan(0);

    await context.setOffline(false);

    // Documented limitation: HTML navigations are network-only by design in
    // this service worker (`request.mode === 'navigate'`). Offline, a page
    // navigation returns the 503 offline response instead of a cached shell.
    // Only subresource fetches and the two runtime maps work from cache.
  });
});

test.describe('Service Worker version-key cache behavior', () => {
  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
  });

  test('a new version query misses the old cache entry, fetches network bytes, and caches them', async ({ page }) => {
    await ensureServiceWorkerControl(page);

    const scriptSrc = await page.evaluate(() => {
      const script = Array.from(document.scripts)
        .find((element) => (element.src || '').includes('/js/client/islands.js'));
      return script ? new URL(script.src).pathname : null;
    });
    expect(scriptSrc).toBe('/js/client/islands.js');

    const oldVersionUrl = `${scriptSrc}?v=000000000000`;
    const newVersionUrl = `${scriptSrc}?v=abcdef123456`;

    const result = await page.evaluate(async ({ oldVersionUrl, newVersionUrl }) => {
      const excluded = new Set([
        'walk-to-mordor-api-swr',
        'walk-to-mordor-swr-version',
        'walk-to-mordor-push-config',
      ]);
      const cacheNames = await caches.keys();
      const staticCacheName = cacheNames.find(
        (name) => name.startsWith('walk-to-mordor-') && !excluded.has(name)
      );
      if (!staticCacheName) {
        throw new Error(`No static SW cache found among: ${cacheNames.join(', ')}`);
      }

      const cache = await caches.open(staticCacheName);
      const staleBody = '// synthetic stale bundle from an old service worker';
      await cache.put(
        new URL(oldVersionUrl, location.origin).toString(),
        new Response(staleBody, { headers: { 'content-type': 'application/javascript' } })
      );

      const missBeforeFetch = await cache.match(new URL(newVersionUrl, location.origin).toString());

      const response = await fetch(newVersionUrl);
      const body = await response.text();

      const oldEntry = await cache.match(new URL(oldVersionUrl, location.origin).toString());
      const newEntry = await cache.match(new URL(newVersionUrl, location.origin).toString());

      return {
        cacheName: staticCacheName,
        missBeforeFetch: missBeforeFetch === undefined,
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        bodyIsStale: body === staleBody,
        bodyLength: body.length,
        oldEntryBody: oldEntry ? await oldEntry.text() : null,
        newEntryPresent: newEntry !== undefined,
        newEntryIsStale: newEntry ? (await newEntry.text()) === staleBody : null,
      };
    }, { oldVersionUrl, newVersionUrl });

    expect(result.missBeforeFetch).toBe(true);
    expect(result.status).toBe(200);
    expect(result.contentType).toContain('javascript');
    expect(result.bodyIsStale).toBe(false);
    expect(result.bodyLength).toBeGreaterThan(1000);

    // The old versioned entry is untouched, so the new version was not served
    // from it; the network response was cached under the new cache key.
    expect(result.oldEntryBody).toBe('// synthetic stale bundle from an old service worker');
    expect(result.newEntryPresent).toBe(true);
    expect(result.newEntryIsStale).toBe(false);
  });
});
