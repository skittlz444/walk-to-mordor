import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/preact';
import { DrawerIsland } from './DrawerIsland';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => (key === 'sessionToken' ? 'test-token' : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DrawerIsland — Admin link visibility', () => {
  /** Helper: mock session + badge fetches. Badge fetches fire only after session success. */
  function mockSessionAndBadges(sessionResponse: Parameters<typeof mockFetch.mockResolvedValueOnce>[0]) {
    // 1st call: /api/session — if ok, badge fetches follow
    mockFetch.mockResolvedValueOnce(sessionResponse);
    // 2nd call: /api/friends/pending (badge) — only fires if session ok
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 0 }) });
    // 3rd call: /api/user/fellowship-invites (badge) — only fires if session ok
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 0 }) });
  }

  it('does not show the Admin link when session isAdmin is false', async () => {
    mockSessionAndBadges({
      ok: true,
      json: () => Promise.resolve({ isAdmin: false }),
    });

    const { queryByText } = render(<DrawerIsland />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/session',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }),
      );
    });

    expect(queryByText('Admin')).toBeNull();
  });

  it('shows the Admin link when session isAdmin is true', async () => {
    mockSessionAndBadges({
      ok: true,
      json: () => Promise.resolve({ isAdmin: true }),
    });

    const { getByText } = render(<DrawerIsland />);

    await waitFor(() => {
      expect(getByText('Admin')).toBeTruthy();
    });

    const adminLink = getByText('Admin') as HTMLAnchorElement;
    expect(adminLink.href).toContain('/admin');
  });

  it('does not show Admin link when there is no session token', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    const { queryByText } = render(<DrawerIsland />);

    // When there is no token the effect returns early — no fetch call, no Admin link
    expect(mockFetch).not.toHaveBeenCalled();
    expect(queryByText('Admin')).toBeNull();
  });

  it('does not show Admin link when session fetch fails', async () => {
    // Session fails — badge fetches should NOT fire
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { queryByText } = render(<DrawerIsland />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(queryByText('Admin')).toBeNull();
  });

  it('does not show Admin link when session response is not ok', async () => {
    // Session not ok — badge fetches should NOT fire (no extra mocks needed)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });

    const { queryByText } = render(<DrawerIsland />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(queryByText('Admin')).toBeNull();
  });

  it('always renders standard nav links regardless of admin status', () => {
    mockSessionAndBadges({
      ok: true,
      json: () => Promise.resolve({ isAdmin: false }),
    });

    const { getByText } = render(<DrawerIsland />);

    expect(getByText('Journey')).toBeTruthy();
    expect(getByText('Map')).toBeTruthy();
    expect(getByText(/Fellowships/)).toBeTruthy();
    expect(getByText(/Friends/)).toBeTruthy();
    expect(getByText('Profile')).toBeTruthy();
  });
});
