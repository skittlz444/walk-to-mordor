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
      fellowship_name: 'The Ring Bearers',
    },
  ],
  total: 1,
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
    expect(getByText('Walker')).toBeTruthy();
    expect(getByText('The Ring Bearers')).toBeTruthy();
    expect(container.querySelector('td[data-label="Support Actions"]')).toBeTruthy();
    expect(container.querySelectorAll('.admin-user-actions .admin-btn').length).toBe(4);
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

    const { getByText } = render(<AdminUsersListIsland />);

    await waitFor(() => {
      expect(getByText('frodo')).toBeTruthy();
    });

    fireEvent.click(getByText('Verify'));

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

    const { getByText } = render(<AdminUsersListIsland />);

    await waitFor(() => {
      expect(getByText('Delete')).toBeTruthy();
    });

    fireEvent.click(getByText('Delete'));

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
