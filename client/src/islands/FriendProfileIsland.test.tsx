import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { FriendProfileIsland } from './FriendProfileIsland';

// Mock fetch
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);

  // Mock localStorage
  const store: Record<string, string> = { sessionToken: 'test-token' };
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  });

  // Mock window.location — default to a valid friend profile URL
  Object.defineProperty(window, 'location', {
    value: { href: '/friends/42', pathname: '/friends/42', origin: 'http://localhost' },
    writable: true,
    configurable: true,
  });

  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

const defaultProfile = {
  username: 'samwise',
  avatar_id: 'samwise',
  total_distance: 245.75,
  member_since: '2025-06-15T00:00:00Z',
  current_goal_title: 'Rivendell',
  friendship_id: 99,
  fellowships: [
    { id: 1, name: 'The Fellowship', is_shared: true },
    { id: 2, name: 'Shire Walkers', is_shared: false },
  ],
};

describe('FriendProfileIsland', () => {
  describe('loading state', () => {
    it('shows loading spinner initially', () => {
      mockFetch.mockReturnValue(new Promise(() => {}));
      const { container } = render(<FriendProfileIsland />);
      expect(container.querySelector('.party-loading')).toBeTruthy();
      expect(container.textContent).toContain('Loading profile');
    });
  });

  describe('error states', () => {
    it('shows error for invalid user ID (non-numeric URL)', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: '/friends/abc', pathname: '/friends/abc', origin: 'http://localhost' },
        writable: true,
        configurable: true,
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
        expect(container.textContent).toContain('Invalid user ID');
      });
    });

    it('redirects to login on 401', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
    });

    it('shows "not found or not a friend" on 404', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
        expect(container.textContent).toContain('not found or not a friend');
      });
    });

    it('shows generic error on server error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
        expect(container.textContent).toContain('Failed to load profile');
      });
    });

    it('shows retry button on error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const { getByText } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(getByText('Retry')).toBeTruthy();
      });
    });

    it('retry button re-fetches profile', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const { getByText } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(getByText('Retry')).toBeTruthy();
      });

      // Now set up successful response for retry
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      fireEvent.click(getByText('Retry'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('profile display', () => {
    it('renders username and avatar', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('.friend-profile-username')).toBeTruthy();
      });
      expect(container.querySelector('.friend-profile-username')!.textContent).toBe('samwise');
      // Avatar image should be rendered
      expect(container.querySelector('.avatar img')).toBeTruthy();
    });

    it('renders total distance formatted to 2 decimals', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.textContent).toContain('245.75 km');
      });
    });

    it('renders member since date', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.textContent).toContain('Member Since');
      });
    });

    it('renders current goal title', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.textContent).toContain('Rivendell');
      });
    });

    it('hides current goal when empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ ...defaultProfile, current_goal_title: '' }),
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('.friend-profile-username')).toBeTruthy();
      });
      expect(container.textContent).not.toContain('Heading to');
    });

    it('renders initials fallback when avatar_id is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ ...defaultProfile, avatar_id: null }),
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('.avatar--initials')).toBeTruthy();
      });
    });

    it('renders 0.00 km for zero distance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ ...defaultProfile, total_distance: 0 }),
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.textContent).toContain('0.00 km');
      });
    });
  });

  describe('fellowships', () => {
    it('renders fellowship list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        const items = container.querySelectorAll('.friend-fellowship-item');
        expect(items).toHaveLength(2);
      });
    });

    it('shows "Shared" badge for shared fellowships', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('.friend-fellowship-shared')).toBeTruthy();
      });
      expect(container.textContent).toContain('Shared');
    });

    it('hides fellowship section when empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ ...defaultProfile, fellowships: [] }),
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('.friend-profile-username')).toBeTruthy();
      });
      expect(container.querySelector('.friend-fellowship-item')).toBeNull();
    });
  });

  describe('breadcrumb navigation', () => {
    it('renders breadcrumb with link back to Friends', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        const breadcrumb = container.querySelector('.party-breadcrumb');
        expect(breadcrumb).toBeTruthy();
      });
      const link = container.querySelector('.party-breadcrumb a') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/friends');
    });

    it('shows username in breadcrumb', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { container } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-breadcrumb .current')?.textContent).toBe('samwise');
      });
    });
  });

  describe('remove friend', () => {
    it('shows "Remove Friend" button', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { getByText } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(getByText('Remove Friend')).toBeTruthy();
      });
    });

    it('shows confirmation dialog on Remove click', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { container, getByText } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(getByText('Remove Friend')).toBeTruthy();
      });

      fireEvent.click(getByText('Remove Friend'));

      await waitFor(() => {
        expect(container.querySelector('.party-confirm-dialog')).toBeTruthy();
        expect(container.textContent).toContain('Are you sure');
        expect(container.textContent).toContain('samwise');
      });
    });

    it('confirmation dialog has Cancel and Remove buttons', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { getByText } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(getByText('Remove Friend')).toBeTruthy();
      });

      fireEvent.click(getByText('Remove Friend'));

      await waitFor(() => {
        expect(getByText('Cancel')).toBeTruthy();
        expect(getByText('Remove')).toBeTruthy();
      });
    });

    it('Cancel closes confirmation dialog', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { container, getByText } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(getByText('Remove Friend')).toBeTruthy();
      });

      fireEvent.click(getByText('Remove Friend'));

      await waitFor(() => {
        expect(container.querySelector('.party-confirm-dialog')).toBeTruthy();
      });

      fireEvent.click(getByText('Cancel'));

      await waitFor(() => {
        expect(container.querySelector('.party-confirm-dialog')).toBeNull();
      });
    });

    it('confirm remove calls DELETE and redirects', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { getByText } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(getByText('Remove Friend')).toBeTruthy();
      });

      fireEvent.click(getByText('Remove Friend'));

      await waitFor(() => {
        expect(getByText('Remove')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });

      fireEvent.click(getByText('Remove'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/friends/99',
          expect.objectContaining({ method: 'DELETE' })
        );
        expect(window.location.href).toBe('/friends');
      });
    });

    it('shows error on failed remove', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { container, getByText } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(getByText('Remove Friend')).toBeTruthy();
      });

      fireEvent.click(getByText('Remove Friend'));

      await waitFor(() => {
        expect(getByText('Remove')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: false, status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      fireEvent.click(getByText('Remove'));

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
      });
    });

    it('overlay click closes confirmation dialog', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      const { container, getByText } = render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(getByText('Remove Friend')).toBeTruthy();
      });

      fireEvent.click(getByText('Remove Friend'));

      await waitFor(() => {
        expect(container.querySelector('.party-confirm-overlay')).toBeTruthy();
      });

      // Click the overlay (not the dialog)
      const overlay = container.querySelector('.party-confirm-overlay') as HTMLElement;
      fireEvent.click(overlay);

      await waitFor(() => {
        expect(container.querySelector('.party-confirm-dialog')).toBeNull();
      });
    });
  });

  describe('API calls', () => {
    it('fetches profile from correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/friends/42/profile',
          expect.objectContaining({ headers: expect.any(Object) })
        );
      });
    });

    it('includes auth header in API call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(defaultProfile),
      });

      render(<FriendProfileIsland />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/friends/42/profile',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });
    });
  });
});
