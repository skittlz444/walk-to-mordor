import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { h, render } from 'preact';
import { resetEncounterTriggerForTests, triggerEncounterRoll } from './encounterTrigger';
import { resetAppStore, sessionToken } from '../stores/appStore';
import type { EncounterDefinition, EncounterOffer } from '../types/encounter';

const mockFetch = vi.fn();
const renderMock = vi.fn();
const hMock = vi.fn((component: unknown, props: unknown) => ({ component, props }));
let storage: Record<string, string>;

const baseDefinition: EncounterDefinition = {
  id: 7,
  slug: 'nazgul-pursuit',
  name: 'The Nazgûl Pursuit',
  description: 'Riders hunt you across the moonlit moor.',
  image_slug: 'nazgul-pursuit',
  badge_slug: 'challenge-nazgul-outrun',
  duration_days: 3,
};

function makeOffer(): EncounterOffer {
  return {
    status: 'offered',
    definition: { ...baseDefinition },
    target: 18.5,
    coverageStart: '2026-11-05',
    coverageEnd: '2026-11-07',
    graceDeadline: '2026-11-10',
  };
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

function setPath(pathname: string) {
  Object.defineProperty(window, 'location', {
    value: { href: pathname, pathname, origin: 'http://localhost' },
    writable: true,
    configurable: true,
  });
}

function installPreactBridge(): void {
  // Object.assign keeps the mocks loosely typed: the bridge only needs
  // callable render/h plus the single island the trigger looks up.
  Object.assign(window, {
    preact: {
      render: renderMock as unknown as typeof render,
      h: hMock as unknown as typeof h,
    },
    preactIslands: {
      EncounterPopupIsland: () => null,
    } as unknown as typeof window.preactIslands,
  });
}

function mountedProps(): { offer: EncounterOffer; onClose: () => void } {
  return hMock.mock.calls[0][1] as { offer: EncounterOffer; onClose: () => void };
}

describe('encounterTrigger', () => {
  beforeEach(() => {
    resetEncounterTriggerForTests();
    resetAppStore();
    mockFetch.mockReset();
    renderMock.mockReset();
    hMock.mockClear();
    vi.stubGlobal('fetch', mockFetch);

    storage = { sessionToken: 'test-token' };
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
    });

    sessionToken.value = 'test-token';
    setPath('/journey');
    installPreactBridge();
  });

  afterEach(() => {
    resetEncounterTriggerForTests();
    resetAppStore();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['/', '/journey', '/map'])('rolls for an encounter on %s', async (path) => {
    setPath(path);
    mockFetch.mockResolvedValue(jsonResponse({ offer: null }));

    await triggerEncounterRoll();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/events/daily-roll');
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('does nothing on paths that do not show encounters', async () => {
    setPath('/profile');
    mockFetch.mockResolvedValue(jsonResponse({ offer: makeOffer() }));

    await triggerEncounterRoll();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
  });

  it('does not roll without a session token', async () => {
    sessionToken.value = null;

    await triggerEncounterRoll();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
  });

  it('mounts the island when the roll returns an offer', async () => {
    setPath('/map');
    const offer = makeOffer();
    mockFetch.mockResolvedValue(jsonResponse({ offer }));

    await triggerEncounterRoll();

    expect(renderMock).toHaveBeenCalledTimes(1);
    const [vnode, container] = renderMock.mock.calls[0] as [unknown, HTMLElement];
    expect(vnode).toEqual(hMock.mock.results[0].value);
    expect(container).toBeInstanceOf(HTMLElement);
    expect(container.className).toBe('encounter-popup-mount');
    expect(document.body.contains(container)).toBe(true);

    const props = mountedProps();
    expect(props.offer).toEqual(offer);
    expect(typeof props.onClose).toBe('function');
  });

  it('unmounts the island and removes its container on close', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ offer: makeOffer() }));

    await triggerEncounterRoll();
    expect(document.querySelector('.encounter-popup-mount')).not.toBeNull();

    mountedProps().onClose();

    expect(renderMock).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.encounter-popup-mount')).toBeNull();
  });

  it('does not mount when the roll returns no offer', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ offer: null }));

    await triggerEncounterRoll();

    expect(renderMock).not.toHaveBeenCalled();
  });

  it('does not mount for a malformed offer payload', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ offer: { status: 'offered' } }));

    await triggerEncounterRoll();

    expect(renderMock).not.toHaveBeenCalled();
  });

  it('swallows fetch failures without mounting anything', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockRejectedValue(new Error('offline'));

    await expect(triggerEncounterRoll()).resolves.toBeUndefined();

    expect(renderMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('swallows a non-ok roll response', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    await expect(triggerEncounterRoll()).resolves.toBeUndefined();

    expect(renderMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('does not mount twice when the trigger runs again', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ offer: makeOffer() }));

    await triggerEncounterRoll();
    await triggerEncounterRoll();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
  });

  it('defers while another modal is open and mounts once it closes', async () => {
    const blocker = document.createElement('div');
    blocker.className = 'modal-overlay';
    document.body.appendChild(blocker);

    try {
      mockFetch.mockResolvedValue(jsonResponse({ offer: makeOffer() }));

      await triggerEncounterRoll();
      expect(renderMock).not.toHaveBeenCalled();

      blocker.remove();

      await vi.waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));
      expect(document.querySelector('.encounter-popup-mount')).not.toBeNull();
    } finally {
      blocker.remove();
    }
  });
});
