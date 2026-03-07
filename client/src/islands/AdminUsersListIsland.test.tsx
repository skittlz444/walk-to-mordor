import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/preact';
import { AdminUsersListIsland } from './AdminUsersListIsland';

const mockFetch = vi.fn();
let savedLocation: Location;

const mockUsersResponse = {
  users: [
    {
      id: 1,
      username: 'frodo',
      email: 'frodo@example.com',
      email_verified: false,
      is_admin: false,
      total_distance_km: 87.2,
      last_active_date: '2026-03-05',
      fellowship_names: ['The Ring Bearers'],
    },
    {
      id: 2,
      username: 'samwise',
      email: 'samwise@example.com',
      email_verified: true,
      is_admin: false,
      total_distance_km: 64.5,
      last_active_date: '2026-03-04',
      fellowship_names: [],
    },
    {
      id: 3,
      username: 'aragorn',
      email: 'aragorn@example.com',
      email_verified: true,
      is_admin: true,
      total_distance_km: 300.0,
      last_active_date: '2026-03-03',
      fellowship_names: ['The Fellowship of the Ring', 'The Dúnedain'],
    },
  ],
  total: 3,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => (key === 'sessionToken' ? 'admin-token' : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal('prompt', vi.fn(() => 'frodo'));
  savedLocation = window.location;
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });

  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockUsersResponse),
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: savedLocation,
    writable: true,
    configurable: true,
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AdminUsersListIsland', () => {
  it('renders fetched user support data', async () => {
    const { getByText, container } = render(<AdminUsersListIsland />);

    await waitFor(() => {
      expect(getByText('frodo')).toBeTruthy();
    });

    expect(getByText('frodo@example.com')).toBeTruthy();
    expect(getByText('Pending')).toBeTruthy();
    expect(getByText('The Ring Bearers')).toBeTruthy();
    expect(container.querySelector('td[data-label="Support Actions"]')).toBeTruthy();
    expect(container.querySelectorAll('.admin-user-actions .admin-btn').length).toBeGreaterThanOrEqual(4);
  });

  it('shows "Solo trail" tag when a user has no fellowships', async () => {
    const { getByText } = render(<AdminUsersListIsland />);

    await waitFor(() => {
      expect(getByText('samwise')).toBeTruthy();
    });

    expect(getByText('Solo trail')).toBeTruthy();
  });

  it('renders multiple fellowship tags for a user in several fellowships', async () => {
    const { getByText } = render(<AdminUsersListIsland />);

    await waitFor(() => {
      expect(getByText('aragorn')).toBeTruthy();
    });

    expect(getByText('The Fellowship of the Ring')).toBeTruthy();
    expect(getByText('The Dúnedain')).toBeTruthy();
  });

  it('shows a clean empty-state label when a user has no walks yet', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        ...mockUsersResponse,
        users: [{ ...mockUsersResponse.users[0], last_active_date: null }],
      }),
    });

    const { getByText, queryByText } = render(<AdminUsersListIsland />);

    await waitFor(() => {
      expect(getByText('No walks yet')).toBeTruthy();
    });

    expect(queryByText('Last active No walks yet')).toBeNull();
  });

  it('redirects to /login on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });

    render(<AdminUsersListIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/login');
    });
  });

  it('verifies a user and refreshes the table', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockUsersResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, email_verified: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          ...mockUsersResponse,
          users: [{ ...mockUsersResponse.users[0], email_verified: true }],
        }),
      });

    const { getByText, getAllByText } = render(<AdminUsersListIsland />);

    await waitFor(() => {
      expect(getByText('frodo')).toBeTruthy();
    });

    fireEvent.click(getAllByText('Verify')[0]);

    await waitFor(() => {
      expect(getByText('frodo is now verified.')).toBeTruthy();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/users/1/verify',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('deletes a user after prompt confirmation', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockUsersResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ users: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
      });

    const { getAllByText } = render(<AdminUsersListIsland />);

    await waitFor(() => {
      expect(getAllByText('Delete').length).toBeGreaterThan(0);
    });

    fireEvent.click(getAllByText('Delete')[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/users/1',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ confirmation: 'frodo' }),
        })
      );
    });
  });
});
