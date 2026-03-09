import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { FriendsListIsland } from './FriendsListIsland';

// Mock fetch
const mockFetch = vi.fn();

// Mock navigator
const mockClipboard = { writeText: vi.fn() };
const mockShare = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal('fetch', mockFetch);

  // Mock localStorage
  const store: Record<string, string> = { sessionToken: 'test-token' };
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  });

  // Mock clipboard
  vi.stubGlobal('navigator', {
    clipboard: mockClipboard,
    share: undefined,
  });

  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: { href: '/friends', origin: 'http://localhost', pathname: '/friends' },
    writable: true,
    configurable: true,
  });

  mockFetch.mockReset();
  mockClipboard.writeText.mockReset();
  mockClipboard.writeText.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
});

function mockFriendsAndPending(
  friends: any[] = [],
  pending: any[] = [],
  friendCode: string | null = 'ABCD1234'
) {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ friends, friend_code: friendCode }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ pending, count: pending.length }),
    });
}

describe('FriendsListIsland', () => {
  describe('loading state', () => {
    it('shows loading spinner initially', () => {
      // Never resolve fetch
      mockFetch.mockReturnValue(new Promise(() => {}));
      const { container } = render(<FriendsListIsland />);
      expect(container.querySelector('.party-loading')).toBeTruthy();
      expect(container.textContent).toContain('Loading friends');
    });
  });

  describe('error state', () => {
    it('shows error and retry button when friends fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ pending: [], count: 0 }),
      });

      const { container, getByText } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
      });
      expect(getByText('Retry')).toBeTruthy();
    });

    it('redirects to /login on 401', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ pending: [], count: 0 }),
      });

      render(<FriendsListIsland />);

      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
    });

    it('shows error when pending fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ friends: [], friend_code: 'ABCD1234' }),
      });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
      });
    });
  });

  describe('empty state', () => {
    it('shows empty message when no friends', async () => {
      mockFriendsAndPending([], []);

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-empty')).toBeTruthy();
      });
      expect(container.textContent).toContain('No friends yet');
    });
  });

  describe('friends list', () => {
    it('renders friends with avatar and username', async () => {
      mockFriendsAndPending([
        { id: 1, username: 'samwise', avatar_id: 'samwise', last_progressed: '2026-02-20T00:00:00Z' },
        { id: 2, username: 'frodo', avatar_id: null, last_progressed: null },
      ]);

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelectorAll('.friend-list-item').length).toBe(2);
      });

      const items = container.querySelectorAll('.friend-list-item');
      expect(items[0].textContent).toContain('samwise');
      expect(items[1].textContent).toContain('frodo');
    });

    it('shows relative time for last_progressed', async () => {
      mockFriendsAndPending([
        { id: 1, username: 'gandalf', avatar_id: null, last_progressed: null },
      ]);

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.textContent).toContain('No activity yet');
      });
    });

    it('friend item is clickable and has correct ARIA', async () => {
      mockFriendsAndPending([
        { id: 42, username: 'aragorn', avatar_id: null, last_progressed: null },
      ]);

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        const item = container.querySelector('.friend-list-item') as HTMLElement;
        expect(item).toBeTruthy();
        expect(item.getAttribute('role')).toBe('link');
        expect(item.getAttribute('aria-label')).toContain('aragorn');
      });
    });

    it('navigates to friend profile on click', async () => {
      mockFriendsAndPending([
        { id: 42, username: 'legolas', avatar_id: null, last_progressed: null },
      ]);

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        const item = container.querySelector('.friend-list-item') as HTMLElement;
        expect(item).toBeTruthy();
      });

      const item = container.querySelector('.friend-list-item') as HTMLElement;
      fireEvent.click(item);
      expect(window.location.href).toBe('/friends/42');
    });

    it('navigates on keyboard Enter', async () => {
      mockFriendsAndPending([
        { id: 7, username: 'gimli', avatar_id: null, last_progressed: null },
      ]);

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('.friend-list-item')).toBeTruthy();
      });

      const item = container.querySelector('.friend-list-item') as HTMLElement;
      fireEvent.keyDown(item, { key: 'Enter' });
      expect(window.location.href).toBe('/friends/7');
    });
  });

  describe('pending requests', () => {
    it('shows pending section with badge count', async () => {
      mockFriendsAndPending([], [
        { id: 10, username: 'pippin', avatar_id: null, created_at: '2026-02-20T00:00:00Z' },
        { id: 11, username: 'merry', avatar_id: null, created_at: '2026-02-20T00:00:00Z' },
      ]);

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('.friend-pending-section')).toBeTruthy();
      });
      expect(container.querySelector('.friend-pending-badge')!.textContent).toBe('2');
    });

    it('accept button calls POST and refreshes data', async () => {
      mockFriendsAndPending([], [
        { id: 10, username: 'pippin', avatar_id: null, created_at: '2026-02-20T00:00:00Z' },
      ]);

      const { container, getByText } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(getByText('Accept')).toBeTruthy();
      });

      // Mock accept endpoint + re-fetch
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });
      // Re-fetch after accept
      mockFriendsAndPending([{ id: 10, username: 'pippin', avatar_id: null, last_progressed: null }], []);

      fireEvent.click(getByText('Accept'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/friends/10/accept',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('reject button removes pending request from list', async () => {
      mockFriendsAndPending([], [
        { id: 10, username: 'pippin', avatar_id: null, created_at: '2026-02-20T00:00:00Z' },
      ]);

      const { container, getByText } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(getByText('Reject')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });

      fireEvent.click(getByText('Reject'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/friends/10/reject',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('toggle hides/shows pending requests', async () => {
      mockFriendsAndPending([], [
        { id: 10, username: 'pippin', avatar_id: null, created_at: '2026-02-20T00:00:00Z' },
      ]);

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('.friend-pending-section')).toBeTruthy();
      });

      // Initially expanded
      expect(container.querySelector('.friend-pending-item')).toBeTruthy();

      // Click toggle
      const toggle = container.querySelector('.friend-pending-toggle') as HTMLElement;
      fireEvent.click(toggle);

      // Items should be hidden
      expect(container.querySelector('.friend-pending-item')).toBeNull();
    });

    it('shows no pending section when pending list is empty', async () => {
      mockFriendsAndPending([
        { id: 1, username: 'gandalf', avatar_id: null, last_progressed: null },
      ], []);

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('.friend-pending-section')).toBeNull();
      });
    });
  });

  describe('search', () => {
    it('does not search when query < 3 chars', async () => {
      mockFriendsAndPending();

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('input[aria-label="Search friends by username"]')).toBeTruthy();
      });

      const input = container.querySelector('input[aria-label="Search friends by username"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'ab' } });

      // Advance past debounce
      vi.advanceTimersByTime(500);

      // Only initial 2 fetch calls should have been made (friends + pending)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('searches after 300ms debounce when query >= 3 chars', async () => {
      mockFriendsAndPending();

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('input[aria-label="Search friends by username"]')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ results: [{ id: 5, username: 'boromir', avatar_id: null, friendship_status: null }] }),
      });

      const input = container.querySelector('input[aria-label="Search friends by username"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'bor' } });

      // Advance past debounce
      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/friends/search?q=bor',
          expect.objectContaining({ headers: expect.any(Object) })
        );
      });
    });

    it('shows "No users found" for empty search results', async () => {
      mockFriendsAndPending();

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('input[aria-label="Search friends by username"]')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ results: [] }),
      });

      const input = container.querySelector('input[aria-label="Search friends by username"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'zzzzz' } });

      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(container.textContent).toContain('No users found');
      });
    });

    it('shows "Friends ✓" badge for accepted friends in search', async () => {
      mockFriendsAndPending();

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('input[aria-label="Search friends by username"]')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ results: [{ id: 5, username: 'boromir', avatar_id: null, friendship_status: 'accepted' }] }),
      });

      const input = container.querySelector('input[aria-label="Search friends by username"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'bor' } });
      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(container.querySelector('.friend-status-badge--friends')).toBeTruthy();
        expect(container.textContent).toContain('Friends ✓');
      });
    });

    it('shows "Pending" badge for pending friends in search', async () => {
      mockFriendsAndPending();

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('input[aria-label="Search friends by username"]')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ results: [{ id: 5, username: 'boromir', avatar_id: null, friendship_status: 'pending' }] }),
      });

      const input = container.querySelector('input[aria-label="Search friends by username"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'bor' } });
      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(container.querySelector('.friend-status-badge--pending')).toBeTruthy();
      });
    });

    it('shows "Add" button for users with no friendship', async () => {
      mockFriendsAndPending();

      const { container, getByText } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('input[aria-label="Search friends by username"]')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ results: [{ id: 5, username: 'boromir', avatar_id: null, friendship_status: null }] }),
      });

      const input = container.querySelector('input[aria-label="Search friends by username"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'bor' } });
      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(getByText('Add')).toBeTruthy();
      });
    });

    it('send request updates status to pending', async () => {
      mockFriendsAndPending();

      const { container, getByText } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('input[aria-label="Search friends by username"]')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ results: [{ id: 5, username: 'boromir', avatar_id: null, friendship_status: null }] }),
      });

      const input = container.querySelector('input[aria-label="Search friends by username"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'bor' } });
      vi.advanceTimersByTime(400);

      await waitFor(() => {
        expect(getByText('Add')).toBeTruthy();
      });

      // Mock send request
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve({}) });

      fireEvent.click(getByText('Add'));

      await waitFor(() => {
        expect(container.querySelector('.friend-status-badge--pending')).toBeTruthy();
      });
    });
  });

  describe('friend code share', () => {
    it('shows share section when friend code exists', async () => {
      mockFriendsAndPending([], [], 'ABCD1234');

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('.friend-share-section')).toBeTruthy();
      });
      expect(container.querySelector('.friend-share-url')!.textContent).toContain('ABCD1234');
    });

    it('hides share section when friend code is null', async () => {
      mockFriendsAndPending([], [], null);

      const { container } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-empty')).toBeTruthy();
      });
      expect(container.querySelector('.friend-share-section')).toBeNull();
    });

    it('copies link to clipboard on copy click', async () => {
      mockFriendsAndPending([], [], 'XYZW5678');

      const { getByText } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(getByText('Copy Link')).toBeTruthy();
      });

      fireEvent.click(getByText('Copy Link'));

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith('http://localhost/friends/add/XYZW5678');
      });
    });

    it('shows "Copied!" feedback after copy', async () => {
      mockFriendsAndPending([], [], 'XYZW5678');

      const { getByText } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(getByText('Copy Link')).toBeTruthy();
      });

      fireEvent.click(getByText('Copy Link'));

      await waitFor(() => {
        expect(getByText('Copied!')).toBeTruthy();
      });
    });
  });

  describe('success/error toasts', () => {
    it('shows success toast after accepting friend', async () => {
      mockFriendsAndPending([], [
        { id: 10, username: 'pippin', avatar_id: null, created_at: '2026-02-20T00:00:00Z' },
      ]);

      const { container, getByText } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(getByText('Accept')).toBeTruthy();
      });

      // Mock accept + re-fetch
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });
      mockFriendsAndPending([{ id: 10, username: 'pippin', avatar_id: null, last_progressed: null }], []);

      fireEvent.click(getByText('Accept'));

      await waitFor(() => {
        expect(container.querySelector('.party-toast--success')).toBeTruthy();
        expect(container.textContent).toContain('Friend request accepted');
      });
    });

    it('shows error toast on failed accept', async () => {
      mockFriendsAndPending([], [
        { id: 10, username: 'pippin', avatar_id: null, created_at: '2026-02-20T00:00:00Z' },
      ]);

      const { container, getByText } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(getByText('Accept')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: false, status: 400,
        json: () => Promise.resolve({ error: 'Request already handled' }),
      });

      fireEvent.click(getByText('Accept'));

      await waitFor(() => {
        expect(container.querySelector('.party-toast--error')).toBeTruthy();
      });
    });

    it('dismiss button clears success toast', async () => {
      mockFriendsAndPending([], [
        { id: 10, username: 'pippin', avatar_id: null, created_at: '2026-02-20T00:00:00Z' },
      ]);

      const { container, getByText } = render(<FriendsListIsland />);

      await waitFor(() => {
        expect(getByText('Accept')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) });
      mockFriendsAndPending([{ id: 10, username: 'pippin', avatar_id: null, last_progressed: null }], []);

      fireEvent.click(getByText('Accept'));

      await waitFor(() => {
        expect(container.querySelector('.party-toast--success')).toBeTruthy();
      });

      const dismissBtn = container.querySelector('.party-toast--success button[aria-label="Dismiss"]') as HTMLElement;
      fireEvent.click(dismissBtn);

      await waitFor(() => {
        expect(container.querySelector('.party-toast--success')).toBeNull();
      });
    });
  });
});
