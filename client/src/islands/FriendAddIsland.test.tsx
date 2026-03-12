import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { FriendAddIsland } from './FriendAddIsland';

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

  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: { href: '/friends/add/ABCD1234', pathname: '/friends/add/ABCD1234', origin: 'http://localhost' },
    writable: true,
    configurable: true,
  });

  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('FriendAddIsland', () => {
  describe('loading state', () => {
    it('shows loading spinner while resolving friend code', () => {
      mockFetch.mockReturnValue(new Promise(() => {}));
      const { container } = render(<FriendAddIsland />);
      expect(container.querySelector('.party-loading')).toBeTruthy();
      expect(container.textContent).toContain('Loading');
    });
  });

  describe('invalid friend code', () => {
    it('shows error for invalid URL path (no code)', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: '/friends/add/', pathname: '/friends/add/', origin: 'http://localhost' },
        writable: true,
        configurable: true,
      });

      const { container } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
        expect(container.textContent).toContain('Invalid friend link');
      });
    });

    it('shows error for code with special characters', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: '/friends/add/AB!D1234', pathname: '/friends/add/AB!D1234', origin: 'http://localhost' },
        writable: true,
        configurable: true,
      });

      const { container } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
      });
    });

    it('shows error for code that is too short', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: '/friends/add/AB12', pathname: '/friends/add/AB12', origin: 'http://localhost' },
        writable: true,
        configurable: true,
      });

      const { container } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
      });
    });
  });

  describe('preview display', () => {
    it('shows user preview with avatar when resolved', async () => {
      // Auth check
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      // Resolve friend code
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 42, username: 'gandalf', avatar_id: 'gandalf-grey' }),
      });

      const { container } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(container.querySelector('.friend-add-preview')).toBeTruthy();
      });
      expect(container.textContent).toContain('gandalf');
      // Avatar img should be rendered
      expect(container.querySelector('.avatar img')).toBeTruthy();
    });

    it('shows user preview with initials fallback when no avatar', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 42, username: 'frodo', avatar_id: null }),
      });

      const { container } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(container.querySelector('.friend-add-preview')).toBeTruthy();
      });
      expect(container.textContent).toContain('frodo');
      expect(container.querySelector('.avatar--initials')).toBeTruthy();
    });

    it('shows error when friend code cannot be resolved (404)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      mockFetch.mockResolvedValueOnce({
        ok: false, status: 404,
        json: () => Promise.resolve({ error: 'Friend code not found' }),
      });

      const { container } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
      });
    });
  });

  describe('authenticated user actions', () => {
    it('shows "Send Friend Request" button when authenticated', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 42, username: 'legolas', avatar_id: null }),
      });

      const { container, getByText } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(getByText('Send Friend Request')).toBeTruthy();
      });
    });

    it('sends friend request via /api/friends/request/code', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 42, username: 'legolas', avatar_id: null }),
      });

      const { getByText } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(getByText('Send Friend Request')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 201,
        json: () => Promise.resolve({}),
      });

      fireEvent.click(getByText('Send Friend Request'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/friends/request/code',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ friend_code: 'ABCD1234' }),
          })
        );
      });
    });

    it('shows success state after request sent', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 42, username: 'legolas', avatar_id: null }),
      });

      const { container, getByText } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(getByText('Send Friend Request')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 201,
        json: () => Promise.resolve({}),
      });

      fireEvent.click(getByText('Send Friend Request'));

      await waitFor(() => {
        expect(container.querySelector('.friend-add-success')).toBeTruthy();
        expect(container.textContent).toContain('Friend request sent');
      });
    });

    it('shows "Back to Friends" link after success', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 42, username: 'legolas', avatar_id: null }),
      });

      const { container, getByText } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(getByText('Send Friend Request')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 201,
        json: () => Promise.resolve({}),
      });

      fireEvent.click(getByText('Send Friend Request'));

      await waitFor(() => {
        const backLink = container.querySelector('a[href="/friends"]');
        expect(backLink).toBeTruthy();
      });
    });
  });

  describe('error handling on send', () => {
    it('shows "already friends" error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 42, username: 'boromir', avatar_id: null }),
      });

      const { container, getByText } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(getByText('Send Friend Request')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: false, status: 400,
        json: () => Promise.resolve({ error: 'Already friends with this user' }),
      });

      fireEvent.click(getByText('Send Friend Request'));

      await waitFor(() => {
        expect(container.textContent).toContain('already friends');
      });
    });

    it('shows "pending" error when request exists', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 42, username: 'boromir', avatar_id: null }),
      });

      const { container, getByText } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(getByText('Send Friend Request')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: false, status: 400,
        json: () => Promise.resolve({ error: 'A pending request already exists' }),
      });

      fireEvent.click(getByText('Send Friend Request'));

      await waitFor(() => {
        expect(container.textContent).toContain('already pending');
      });
    });

    it('shows self-add error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 42, username: 'testuser', avatar_id: null }),
      });

      const { container, getByText } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(getByText('Send Friend Request')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: false, status: 400,
        json: () => Promise.resolve({ error: 'Cannot add yourself as a friend' }),
      });

      fireEvent.click(getByText('Send Friend Request'));

      await waitFor(() => {
        expect(container.textContent).toContain('cannot add yourself');
      });
    });

    it('shows generic error for unknown failures', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 42, username: 'boromir', avatar_id: null }),
      });

      const { container, getByText } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(getByText('Send Friend Request')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: false, status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      fireEvent.click(getByText('Send Friend Request'));

      await waitFor(() => {
        expect(container.querySelector('.party-toast--error')).toBeTruthy();
      });
    });
  });

  describe('unauthenticated user', () => {
    it('shows "Log in to Add Friend" when not authenticated but preview loaded', async () => {
      // No session token
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });

      // Resolve still works (public endpoint)
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 42, username: 'legolas', avatar_id: null }),
      });

      const { container, getByText } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(getByText('Log in to Add Friend')).toBeTruthy();
      });
    });

    it('redirects to login with returnTo on login click', async () => {
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: 42, username: 'legolas', avatar_id: null }),
      });

      const { getByText } = render(<FriendAddIsland />);

      await waitFor(() => {
        expect(getByText('Log in to Add Friend')).toBeTruthy();
      });

      fireEvent.click(getByText('Log in to Add Friend'));

      expect(window.location.href).toContain('/login?returnTo=');
    });
  });
});
