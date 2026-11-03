import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { ProfileSettingsIsland } from './ProfileSettingsIsland';
import { clearMapCache } from '../utils/map-cache';

vi.mock('../utils/map-cache', () => ({ clearMapCache: vi.fn() }));

const mockFetch = vi.fn();
const mockServiceWorkerPostMessage = vi.fn();
const mockClearMapCache = vi.mocked(clearMapCache);

interface JsonResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function jsonResponse(data: unknown, status = 200): JsonResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

const sessionFixture = {
  username: 'testuser',
  email: 'test@example.com',
  showFutureGoalsUnlocked: true,
  defaultViewMap: false,
  avatarId: null,
  activeStoryline: {
    id: 1,
    slug: 'frodo-sam',
    title: 'Frodo & Sam',
    description: 'Carry the Ring to Mount Doom',
    pathKey: 'fellowship',
    distanceOffset: 0,
  },
};

const storylineFixture = [
  {
    id: 1,
    slug: 'frodo-sam',
    title: 'Frodo & Sam',
    description: 'Carry the Ring to Mount Doom',
    pathKey: 'fellowship',
  },
  {
    id: 2,
    slug: 'faramir',
    title: 'Faramir',
    description: 'Ride with the Rangers of Ithilien',
    pathKey: 'fellowship',
  },
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal('fetch', mockFetch);

  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      controller: {
        postMessage: mockServiceWorkerPostMessage,
      },
    },
    configurable: true,
  });

  const store: Record<string, string> = { sessionToken: 'test-token' };
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  });

  Object.defineProperty(window, 'location', {
    value: { href: '/profile/settings', origin: 'http://localhost', pathname: '/profile/settings' },
    writable: true,
    configurable: true,
  });

  mockFetch.mockReset();
  mockServiceWorkerPostMessage.mockReset();
  mockClearMapCache.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
  delete (window as typeof window & { userPreferences?: Record<string, unknown> }).userPreferences;
});

function mockLoad(session: Record<string, unknown> = sessionFixture) {
  mockFetch
    .mockResolvedValueOnce(jsonResponse(session))
    .mockResolvedValueOnce(jsonResponse({ storylines: storylineFixture }));
}

async function renderLoaded(session: Record<string, unknown> = sessionFixture) {
  mockLoad(session);
  const view = render(<ProfileSettingsIsland />);

  await waitFor(() => {
    expect(view.container.querySelector('#profile-username')).toBeTruthy();
  });

  return view;
}

function profilePutCalls(): number {
  return mockFetch.mock.calls.filter(
    ([url, init]) =>
      url === '/api/profile' &&
      (init as RequestInit | undefined)?.method === 'PUT',
  ).length;
}

function profilePutBody(callIndex = 0): Record<string, unknown> {
  const calls = mockFetch.mock.calls.filter(
    ([url, init]) =>
      url === '/api/profile' &&
      (init as RequestInit | undefined)?.method === 'PUT',
  );
  const init = calls[callIndex]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

function fieldStatus(container: HTMLElement, field: 'username' | 'email'): HTMLElement {
  const element = container.querySelector(`#profile-${field}-status`);
  if (!(element instanceof HTMLElement)) throw new Error(`missing ${field} status`);
  return element;
}

describe('ProfileSettingsIsland', () => {
  describe('loading and session', () => {
    it('shows the loading state until the session resolves', () => {
      mockFetch.mockReturnValue(new Promise(() => {}));
      const { container } = render(<ProfileSettingsIsland />);

      expect(container.textContent).toContain('Loading profile');
    });

    it('fetches only the session and storylines and populates the fields', async () => {
      const { container } = await renderLoaded();

      expect(mockFetch.mock.calls.map(([url]) => url)).toEqual(['/api/session', '/api/storylines']);
      expect((container.querySelector('#profile-username') as HTMLInputElement).value).toBe('testuser');
      expect((container.querySelector('#profile-email') as HTMLInputElement).value).toBe('test@example.com');
      expect(container.querySelector('#profile-storyline')).toBeTruthy();
    });

    it('redirects to /login when the session fetch returns 401', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({}, 401))
        .mockResolvedValueOnce(jsonResponse({ storylines: [] }));

      render(<ProfileSettingsIsland />);

      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
    });

    it('renders neither the page wrapper nor a Back, Save, or Logout control', async () => {
      const { container, queryByText } = await renderLoaded();

      expect(container.querySelector('.profile-page')).toBeNull();
      expect(container.querySelector('.profile-back-button')).toBeNull();
      expect(container.querySelector('#save-profile-btn')).toBeNull();
      expect(container.querySelector('#cancel-profile-btn')).toBeNull();
      expect(queryByText('Save Changes')).toBeNull();
      expect(queryByText('Back to profile')).toBeNull();
      expect(queryByText('Logout')).toBeNull();
      expect(container.querySelector('.profile-card-footer')).toBeNull();
    });
  });

  describe('username and email auto-save', () => {
    it('saves a trimmed username on blur and announces Saving… then Saved', async () => {
      const { container } = await renderLoaded();

      expect(fieldStatus(container, 'username').textContent).toBe('');
      expect(fieldStatus(container, 'username').getAttribute('role')).toBe('status');
      expect(fieldStatus(container, 'username').getAttribute('aria-live')).toBe('polite');

      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Profile updated successfully!' }));
      const input = container.querySelector('#profile-username') as HTMLInputElement;

      fireEvent.input(input, { target: { value: '  FrodoOfTheShire  ' } });
      expect(fieldStatus(container, 'username').textContent).toBe('');

      fireEvent.blur(input);

      await waitFor(() => {
        expect(profilePutCalls()).toBe(1);
      });

      expect(profilePutBody()).toEqual({ username: 'FrodoOfTheShire' });

      const call = mockFetch.mock.calls.find(([url]) => url === '/api/profile');
      const init = call?.[1] as RequestInit | undefined;
      expect(init).toMatchObject({
        method: 'PUT',
        keepalive: true,
      });

      await waitFor(() => {
        expect(fieldStatus(container, 'username').textContent).toBe('Saved');
      });
      expect(fieldStatus(container, 'username').classList.contains('saved')).toBe(true);
      expect(input.value).toBe('FrodoOfTheShire');
      expect(mockServiceWorkerPostMessage).toHaveBeenCalledWith({ type: 'sw-clear-cache' });
    });

    it('clears a saved status when the field is edited again', async () => {
      const { container } = await renderLoaded();
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'ok' }));

      const input = container.querySelector('#profile-username') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'newname' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(fieldStatus(container, 'username').textContent).toBe('Saved');
      });

      fireEvent.input(input, { target: { value: 'newname2' } });
      expect(fieldStatus(container, 'username').textContent).toBe('');
      expect(fieldStatus(container, 'username').classList.contains('saved')).toBe(false);
    });

    it('saves only the email field on blur', async () => {
      const { container } = await renderLoaded();
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'ok' }));

      const input = container.querySelector('#profile-email') as HTMLInputElement;
      fireEvent.input(input, { target: { value: '  frodo@shire.com ' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(profilePutBody()).toEqual({ email: 'frodo@shire.com' });
      });

      await waitFor(() => {
        expect(fieldStatus(container, 'email').textContent).toBe('Saved');
      });
    });

    it.each([
      ['empty username', 'username', ''],
      ['whitespace username', 'username', '   '],
      ['2-char username', 'username', 'ab'],
      ['31-char username', 'username', 'a'.repeat(31)],
      ['username with a hyphen', 'username', 'frodo-baggins'],
      ['username with a space', 'username', 'frodo baggins'],
      ['empty email', 'email', ''],
      ['whitespace email', 'email', '   '],
      ['missing @ email', 'email', 'frodo.shire.com'],
      ['missing domain dot email', 'email', 'frodo@shire'],
      ['email with a space', 'email', 'frodo baggins@shire.com'],
    ])('sends no PUT for an invalid %s', async (_label, field, value) => {
      const { container } = await renderLoaded();
      const input = container.querySelector(`#profile-${field}`) as HTMLInputElement;

      fireEvent.input(input, { target: { value } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(fieldStatus(container, field).classList.contains('error')).toBe(true);
      });
      expect(fieldStatus(container, field).textContent).not.toBe('');
      expect(profilePutCalls()).toBe(0);
    });

    it.each([
      ['3-char username', 'username', 'abc'],
      ['30-char username', 'username', 'a'.repeat(30)],
    ])('sends a PUT for a valid %s', async (_label, field, value) => {
      const { container } = await renderLoaded();
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'ok' }));

      const input = container.querySelector(`#profile-${field}`) as HTMLInputElement;
      fireEvent.input(input, { target: { value } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(profilePutCalls()).toBe(1);
      });
      expect(profilePutBody()).toEqual({ [field]: value });
    });

    it('ignores a stale response that resolves after the latest blur', async () => {
      const { container } = await renderLoaded();
      const input = container.querySelector('#profile-username') as HTMLInputElement;

      let resolveFirst: ((value: unknown) => void) | null = null;
      let resolveSecond: ((value: unknown) => void) | null = null;
      const firstResponse = new Promise<unknown>((resolve) => { resolveFirst = resolve; });
      const secondResponse = new Promise<unknown>((resolve) => { resolveSecond = resolve; });

      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url !== '/api/profile') {
          return Promise.resolve(jsonResponse({}));
        }
        const body = JSON.parse(String(init?.body)) as { username?: string };
        return body.username === 'firstname' ? firstResponse : secondResponse;
      });

      fireEvent.input(input, { target: { value: 'firstname' } });
      fireEvent.blur(input);

      fireEvent.input(input, { target: { value: 'secondname' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(profilePutCalls()).toBe(2);
      });

      resolveSecond?.(jsonResponse({ message: 'ok' }));

      await waitFor(() => {
        expect(fieldStatus(container, 'username').textContent).toBe('Saved');
      });

      // The older request resolves last with a conflict; it must be discarded.
      resolveFirst?.(jsonResponse({ error: 'Username already exists' }, 409));

      await waitFor(() => {
        expect(profilePutCalls()).toBe(2);
      });
      expect(fieldStatus(container, 'username').textContent).toBe('Saved');
      expect(fieldStatus(container, 'username').classList.contains('error')).toBe(false);
      expect(input.value).toBe('secondname');
    });

    it('sends a restore PUT when the user reverts to the saved value mid-save', async () => {
      const { container } = await renderLoaded();
      const input = container.querySelector('#profile-username') as HTMLInputElement;

      const requestedValues: string[] = [];
      let resolveRevert: ((value: unknown) => void) | null = null;
      let resolveOriginal: ((value: unknown) => void) | null = null;
      const revertResponse = new Promise<unknown>((resolve) => { resolveRevert = resolve; });
      const originalResponse = new Promise<unknown>((resolve) => { resolveOriginal = resolve; });

      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url !== '/api/profile') {
          return Promise.resolve(jsonResponse({}));
        }
        const body = JSON.parse(String(init?.body)) as { username?: string };
        requestedValues.push(String(body.username));
        return body.username === 'testuser' ? revertResponse : originalResponse;
      });

      // Save "Samwise" and hold the response so the save is still in flight.
      fireEvent.input(input, { target: { value: 'Samwise' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(requestedValues).toEqual(['Samwise']);
      });

      // Typing back the server-confirmed username must still PUT: the held save
      // may land later, so skipping the PUT would leave the server on "Samwise".
      fireEvent.input(input, { target: { value: 'testuser' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(requestedValues).toEqual(['Samwise', 'testuser']);
      });

      // A second blur of the same value must not queue a duplicate PUT.
      fireEvent.blur(input);
      expect(requestedValues).toEqual(['Samwise', 'testuser']);

      // The newest request resolves first and wins the field.
      resolveRevert?.(jsonResponse({ message: 'ok' }));

      await waitFor(() => {
        expect(fieldStatus(container, 'username').textContent).toBe('Saved');
      });
      expect(input.value).toBe('testuser');

      // The older "Samwise" response resolves last and must be discarded.
      resolveOriginal?.(jsonResponse({ message: 'ok' }));

      await waitFor(() => {
        expect(fieldStatus(container, 'username').classList.contains('saved')).toBe(true);
      });
      expect(input.value).toBe('testuser');
      expect(fieldStatus(container, 'username').textContent).toBe('Saved');

      // "testuser" is the server-confirmed value again: a re-blur must not PUT.
      fireEvent.blur(input);
      await waitFor(() => {
        expect(fieldStatus(container, 'username').textContent).toBe('');
      });
      expect(profilePutCalls()).toBe(2);
    });

    it('shows a 409 duplicate message inline without a global banner', async () => {
      const { container } = await renderLoaded();
      mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Username already exists' }, 409));

      const input = container.querySelector('#profile-username') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'duplicatename' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(fieldStatus(container, 'username').textContent).toBe('Username already exists');
      });
      expect(fieldStatus(container, 'username').classList.contains('error')).toBe(true);
      expect(container.querySelector('#profile-error')).toBeNull();
      expect(container.querySelector('.error-message')).toBeNull();
    });

    it('redirects to /login on an auto-save 401 without showing Saved', async () => {
      const { container } = await renderLoaded();
      mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 401));

      const input = container.querySelector('#profile-username') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'newname' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
      expect(fieldStatus(container, 'username').textContent).not.toBe('Saved');
    });
  });

  describe('preference toggles', () => {
    it('saves a toggle change and dispatches preferenceChanged', async () => {
      const { container } = await renderLoaded();
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      const toggle = container.querySelector('#preview-milestones-toggle') as HTMLInputElement;
      fireEvent.change(toggle, { target: { checked: false } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/user/preferences', expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ showFutureGoalsUnlocked: false }),
        }));
      });

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
          type: 'preferenceChanged',
        }));
      });
      expect(mockServiceWorkerPostMessage).toHaveBeenCalledWith({ type: 'sw-clear-cache' });
      dispatchSpy.mockRestore();
    });

    it('saves the default view toggle and updates window.userPreferences', async () => {
      const bridge = window as typeof window & { userPreferences?: Record<string, unknown> };
      bridge.userPreferences = { showFutureGoalsUnlocked: true, defaultViewMap: false };

      const { container } = await renderLoaded();
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      const toggle = container.querySelector('#default-view-toggle') as HTMLInputElement;
      fireEvent.change(toggle, { target: { checked: true } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/user/preferences', expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ defaultViewMap: true }),
        }));
      });

      await waitFor(() => {
        expect(bridge.userPreferences?.defaultViewMap).toBe(true);
      });
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'preferenceChanged',
      }));

      dispatchSpy.mockRestore();
      delete bridge.userPreferences;
    });

    it('rolls the toggle back when the preference save fails', async () => {
      const { container } = await renderLoaded();
      mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Server error' }, 500));

      const toggle = container.querySelector('#default-view-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(false);

      fireEvent.change(toggle, { target: { checked: true } });

      await waitFor(() => {
        expect(toggle.checked).toBe(false);
      });
      expect(container.querySelector('#preference-status')!.textContent).toContain('Server error');
    });
  });

  describe('journey switching', () => {
    it('confirms a journey switch, PUTs the mode, dispatches, and clears the map cache', async () => {
      const { container, getByText } = await renderLoaded();
      mockFetch.mockResolvedValueOnce(jsonResponse({
        totalDistance: 10,
        rawTotalDistance: 10,
        activeStoryline: {
          id: 2,
          slug: 'faramir',
          title: 'Faramir',
          description: 'Ride with the Rangers of Ithilien',
          pathKey: 'fellowship',
          distanceOffset: 0,
        },
      }));
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      const select = container.querySelector('#profile-storyline') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: '2' } });

      expect(getByText('Change Journey')).toBeTruthy();
      fireEvent.click(getByText('Carry Distance'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/user/storyline', expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ storylineId: 2, mode: 'carry' }),
        }));
      });

      await waitFor(() => {
        expect(mockClearMapCache).toHaveBeenCalled();
      });
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'storylineChanged',
      }));
      expect(container.textContent).not.toContain('Change Journey');
      dispatchSpy.mockRestore();
    });
  });

  describe('avatar picker integration', () => {
    it('opens the shared modal, saves a selection, and updates the preview', async () => {
      const { container, getByText } = await renderLoaded();

      expect(mockFetch.mock.calls.some(([url]) => url === '/api/avatars')).toBe(false);

      mockFetch.mockResolvedValueOnce(jsonResponse(['frodo', 'gandalf']));
      fireEvent.click(getByText('Change avatar'));

      await waitFor(() => {
        expect(container.querySelectorAll('.picker-option')).toHaveLength(2);
      });
      expect(mockFetch).toHaveBeenCalledWith('/api/avatars', expect.anything());

      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      fireEvent.click(container.querySelector('[data-slug="gandalf"]') as HTMLElement);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/user/preferences', expect.objectContaining({
          body: JSON.stringify({ avatarId: 'gandalf' }),
        }));
      });

      await waitFor(() => {
        const preview = container.querySelector('#avatar-preview img');
        expect(preview?.getAttribute('src')).toBe('/img/avatars/gandalf.webp');
      });
    });
  });
});
