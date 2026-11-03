import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { ProfileViewIsland, type ProfileOverview } from './ProfileViewIsland';

const mockFetch = vi.fn();
const mockServiceWorkerPostMessage = vi.fn();

const defaultOverview: ProfileOverview = {
  username: 'FrodoBaggins',
  avatarId: 'frodo',
  totalDistance: 2412.5,
  memberSince: '2024-08-15T18:30:00.000Z',
  currentGoalTitle: 'Reach northern edge of Ithilien',
  activeStoryline: {
    id: 1,
    slug: 'frodo-sam',
    title: 'Frodo & Sam',
    description: 'Carry the Ring to Mount Doom',
    pathKey: 'fellowship',
    distanceOffset: 0,
  },
  fellowships: [{ id: 3, name: 'Fellowship of the Ring' }],
};

beforeEach(() => {
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
    value: { href: '/profile', origin: 'http://localhost', pathname: '/profile' },
    writable: true,
    configurable: true,
  });

  mockFetch.mockReset();
  mockServiceWorkerPostMessage.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

function mockOverview(data: ProfileOverview = defaultOverview) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

async function renderLoaded(data: ProfileOverview = defaultOverview) {
  mockOverview(data);
  const view = render(<ProfileViewIsland />);

  await waitFor(() => {
    expect(view.container.querySelector('.friend-profile-username')).toBeTruthy();
  });

  return view;
}

describe('ProfileViewIsland', () => {
  it('renders the username, formatted distance, member-since date, goal, and journey', async () => {
    const { container } = await renderLoaded();

    expect(container.querySelector('h2')!.textContent).toBe('FrodoBaggins');
    expect(container.textContent).toContain('2412.50 km');
    expect(container.textContent).toContain('Total Distance');

    const expectedDate = new Date(defaultOverview.memberSince).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(container.textContent).toContain(expectedDate);
    expect(container.textContent).toContain('Member Since');

    expect(container.textContent).toContain('Heading to');
    expect(container.textContent).toContain('Reach northern edge of Ithilien');
    expect(container.textContent).toContain('Frodo & Sam');
  });

  it('hides the "Heading to" line when currentGoalTitle is null', async () => {
    const { container } = await renderLoaded({ ...defaultOverview, currentGoalTitle: null });

    expect(container.textContent).not.toContain('Heading to');
    expect(container.textContent).toContain('2412.50 km');
    expect(container.textContent).toContain('Frodo & Sam');
  });

  it('shows a hero/stats skeleton while loading', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { container } = render(<ProfileViewIsland />);

    expect(container.querySelector('.profile-view-skeleton')).toBeTruthy();
    expect(container.querySelector('.profile-view-skeleton-avatar')).toBeTruthy();
    expect(container.querySelectorAll('.profile-view-skeleton-stat')).toHaveLength(2);
    expect(container.querySelector('.party-card')!.getAttribute('aria-busy')).toBe('true');
  });

  it('redirects to /login when the overview returns 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) });

    render(<ProfileViewIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/login');
    });
  });

  it('shows an error with Retry and re-fetches the overview', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

    const { container, getByText } = render(<ProfileViewIsland />);

    await waitFor(() => {
      expect(container.querySelector('.party-error')).toBeTruthy();
    });
    expect(container.textContent).toContain('Failed to load profile');

    mockOverview();
    fireEvent.click(getByText('Retry'));

    await waitFor(() => {
      expect(container.querySelector('.friend-profile-username')).toBeTruthy();
    });
  });

  it('links the Settings CTA to /profile/settings', async () => {
    const { container } = await renderLoaded();

    const link = container.querySelector('.profile-view-cta a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/profile/settings');
    expect(link.textContent).toContain('Edit Profile');
  });

  it('renders fellowships without a shared marker', async () => {
    const { container } = await renderLoaded();

    const items = container.querySelectorAll('.friend-fellowship-item');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Fellowship of the Ring');
    expect(container.querySelector('.friend-fellowship-shared')).toBeNull();
    expect(container.textContent).not.toContain('Shared');
  });

  it('omits the Fellowships card when there are none', async () => {
    const { container } = await renderLoaded({ ...defaultOverview, fellowships: [] });

    expect(container.querySelector('.friend-fellowship-item')).toBeNull();
    expect(container.textContent).not.toContain('Fellowships');
  });

  it('has no page wrapper of its own', async () => {
    const { container } = await renderLoaded();

    expect(container.querySelector('.party-page')).toBeNull();
    expect(container.querySelector('.badge-display')).toBeNull();
    expect(container.querySelector('[data-island]')).toBeNull();
    expect(container.firstElementChild!.className).toContain('friend-profile-header');
  });

  it('opens the avatar picker from the labelled avatar button', async () => {
    const { container, getByRole } = await renderLoaded();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(['frodo', 'samwise']),
    });

    fireEvent.click(getByRole('button', { name: 'Change avatar for FrodoBaggins' }));

    await waitFor(() => {
      expect(container.querySelector('.picker-dialog')).toBeTruthy();
    });

    const dialog = getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('avatar-picker-title');
  });

  it('updates the displayed avatar live after a save', async () => {
    const { container, getByRole } = await renderLoaded();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(['frodo', 'samwise']),
    });

    fireEvent.click(getByRole('button', { name: 'Change avatar for FrodoBaggins' }));

    await waitFor(() => {
      expect(container.querySelector('[data-slug="samwise"]')).toBeTruthy();
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    fireEvent.click(container.querySelector('[data-slug="samwise"]')!);

    await waitFor(() => {
      const heroAvatar = container.querySelector(
        '.friend-profile-header .profile-view-avatar-trigger img',
      );
      expect(heroAvatar!.getAttribute('src')).toContain('samwise.webp');
    });

    // Save-on-select keeps the modal open.
    expect(container.querySelector('.picker-dialog')).toBeTruthy();
  });
});
