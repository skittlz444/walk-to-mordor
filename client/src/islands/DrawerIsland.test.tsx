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
  it('does not show the Admin link when session isAdmin is false', async () => {
    mockFetch.mockResolvedValueOnce({
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
    mockFetch.mockResolvedValueOnce({
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
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { queryByText } = render(<DrawerIsland />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(queryByText('Admin')).toBeNull();
  });

  it('does not show Admin link when session response is not ok', async () => {
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ isAdmin: false }),
    });

    const { getByText } = render(<DrawerIsland />);

    expect(getByText('Journey')).toBeTruthy();
    expect(getByText('Map')).toBeTruthy();
    expect(getByText('Fellowships')).toBeTruthy();
    expect(getByText('Profile')).toBeTruthy();
  });
});
