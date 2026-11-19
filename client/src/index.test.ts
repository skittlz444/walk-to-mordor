import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initializeAppStore = vi.fn<() => Promise<void>>();
const loadAssetVersions = vi.fn<() => Promise<void>>();
const triggerEncounterRoll = vi.fn<() => Promise<void>>();

vi.mock('./stores/appStore', () => ({
  initializeAppStore: () => initializeAppStore(),
}));
vi.mock('./utils/assetUrl', () => ({
  loadAssetVersions: () => loadAssetVersions(),
}));
vi.mock('./utils/encounterTrigger', () => ({
  triggerEncounterRoll: () => triggerEncounterRoll(),
}));

function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve());
}

describe('client bootstrap', () => {
  let hydrateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    initializeAppStore.mockReset().mockResolvedValue(undefined);
    loadAssetVersions.mockReset().mockResolvedValue(undefined);
    triggerEncounterRoll.mockReset().mockResolvedValue(undefined);

    // `complete` makes index.tsx start bootstrap as soon as the module loads;
    // each test re-imports a fresh module instance.
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
    hydrateSpy = vi.spyOn(document, 'querySelectorAll');
  });

  afterEach(() => {
    hydrateSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('starts the app store and image map together, then hydrates', async () => {
    await import('./index');
    await flushMicrotasks();

    expect(initializeAppStore).toHaveBeenCalledTimes(1);
    expect(loadAssetVersions).toHaveBeenCalledTimes(1);
    expect(hydrateSpy).toHaveBeenCalledWith('[data-island]');
    expect(triggerEncounterRoll).toHaveBeenCalledTimes(1);
  });

  it('does not hydrate until the image map load settles', async () => {
    let finishLoad: () => void = () => {};
    loadAssetVersions.mockImplementation(() => new Promise<void>((resolve) => {
      finishLoad = resolve;
    }));

    await import('./index');
    await flushMicrotasks();

    expect(initializeAppStore).toHaveBeenCalledTimes(1);
    expect(hydrateSpy).not.toHaveBeenCalled();
    expect(triggerEncounterRoll).not.toHaveBeenCalled();

    finishLoad();
    await flushMicrotasks();

    expect(hydrateSpy).toHaveBeenCalledWith('[data-island]');
    expect(triggerEncounterRoll).toHaveBeenCalledTimes(1);
  });

  it('hydrates even when the image map load rejects', async () => {
    loadAssetVersions.mockRejectedValue(new Error('map unavailable'));

    await import('./index');
    await flushMicrotasks();

    expect(hydrateSpy).toHaveBeenCalledWith('[data-island]');
    expect(triggerEncounterRoll).toHaveBeenCalledTimes(1);
  });
});
