import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { PartyJoinIsland } from './PartyJoinIsland';
import { sessionToken, resetAppStore } from '../stores/appStore';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);

  const store: Record<string, string> = { sessionToken: 'test-token' };
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });

  // Set authenticated state in appStore
  sessionToken.value = 'test-token';

  // Valid invite URL
  Object.defineProperty(window, 'location', {
    value: { href: '/party/join/ABCD1234', pathname: '/party/join/ABCD1234', origin: 'http://localhost' },
    writable: true,
    configurable: true,
  });

  mockFetch.mockReset();
});

afterEach(() => {
  resetAppStore();
  vi.restoreAllMocks();
  cleanup();
});

describe('PartyJoinIsland', () => {
  describe('loading state', () => {
    it('shows loading spinner while fetching preview', () => {
      mockFetch.mockReturnValue(new Promise(() => {}));
      const { container } = render(<PartyJoinIsland />);
      expect(container.querySelector('.party-loading')).toBeTruthy();
      expect(container.textContent).toContain('Loading');
    });
  });

  describe('invalid invite code', () => {
    it('shows error for invalid URL path (no code)', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: '/party/join/', pathname: '/party/join/', origin: 'http://localhost' },
        writable: true,
        configurable: true,
      });

      const { container } = render(<PartyJoinIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
        expect(container.textContent).toContain('Invalid invite link');
      });
    });
  });

  describe('preview display', () => {
    it('shows fellowship preview when resolved', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          name: 'The Fellowship',
          member_count: 3,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
        }),
      });

      const { container } = render(<PartyJoinIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-join-preview')).toBeTruthy();
      });
      expect(container.textContent).toContain('The Fellowship');
      expect(container.textContent).toContain('3 members');
    });

    it('shows error when invite code cannot be resolved', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false, status: 404,
        json: () => Promise.resolve({ error: 'Invalid invite code' }),
      });

      const { container } = render(<PartyJoinIsland />);

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
        expect(container.textContent).toContain('Invalid invite code');
      });
    });
  });

  describe('authenticated user actions', () => {
    it('shows "Join Fellowship" button when authenticated', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          name: 'Test Fellowship',
          member_count: 2,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
        }),
      });

      const { getByText } = render(<PartyJoinIsland />);

      await waitFor(() => {
        expect(getByText('Join Fellowship')).toBeTruthy();
      });
    });

    it('sends join request via POST with auth headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          name: 'Test Fellowship',
          member_count: 2,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
        }),
      });

      const { getByText } = render(<PartyJoinIsland />);

      await waitFor(() => {
        expect(getByText('Join Fellowship')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ party_id: 99 }),
      });

      fireEvent.click(getByText('Join Fellowship'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/party/join/ABCD1234',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });
    });

    it('redirects to party detail page after successful join', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          name: 'Test Fellowship',
          member_count: 2,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
        }),
      });

      const { getByText } = render(<PartyJoinIsland />);

      await waitFor(() => {
        expect(getByText('Join Fellowship')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ party_id: 42 }),
      });

      fireEvent.click(getByText('Join Fellowship'));

      await waitFor(() => {
        expect(window.location.href).toBe('/party/42');
      });
    });

    it('shows error when join fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          name: 'Test Fellowship',
          member_count: 2,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
        }),
      });

      const { container, getByText } = render(<PartyJoinIsland />);

      await waitFor(() => {
        expect(getByText('Join Fellowship')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: false, status: 400,
        json: () => Promise.resolve({ error: 'Already a member' }),
      });

      fireEvent.click(getByText('Join Fellowship'));

      await waitFor(() => {
        expect(container.querySelector('.party-error')).toBeTruthy();
        expect(container.textContent).toContain('Already a member');
      });
    });
  });

  describe('unauthenticated user', () => {
    it('shows "Log in to Join" when not authenticated', async () => {
      sessionToken.value = null;

      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          name: 'Test Fellowship',
          member_count: 2,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
        }),
      });

      const { getByText } = render(<PartyJoinIsland />);

      await waitFor(() => {
        expect(getByText('Log in to Join')).toBeTruthy();
      });
    });

    it('redirects to login with returnTo on login click', async () => {
      sessionToken.value = null;

      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          name: 'Test Fellowship',
          member_count: 2,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
        }),
      });

      const { getByText } = render(<PartyJoinIsland />);

      await waitFor(() => {
        expect(getByText('Log in to Join')).toBeTruthy();
      });

      fireEvent.click(getByText('Log in to Join'));

      expect(window.location.href).toContain('/login?returnTo=');
    });
  });

  describe('distance mode display', () => {
    it('shows cumulative distance mode text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          name: 'Walkers',
          member_count: 1,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'remove',
        }),
      });

      const { container } = render(<PartyJoinIsland />);

      await waitFor(() => {
        expect(container.textContent).toContain('adds together');
      });
    });

    it('shows average distance mode text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({
          name: 'Walkers',
          member_count: 1,
          distance_mode: 'average',
          leave_distance_behavior: 'keep',
        }),
      });

      const { container } = render(<PartyJoinIsland />);

      await waitFor(() => {
        expect(container.textContent).toContain('averaged');
      });
    });
  });
});
