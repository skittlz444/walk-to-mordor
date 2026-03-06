import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/preact';
import { AdminDashboardIsland } from './AdminDashboardIsland';

const mockFetch = vi.fn();
let savedLocation: Location;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => (key === 'sessionToken' ? 'admin-token' : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  savedLocation = window.location;
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
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

const mockStats = {
  totalUsers: 42,
  totalDistanceKm: 1500,
  activeParties: 7,
  totalGoals: 150,
};

describe('AdminDashboardIsland', () => {
  it('renders skeleton loading state initially', () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    const { container } = render(<AdminDashboardIsland />);

    expect(container.querySelector('.admin-stat-card--skeleton')).toBeTruthy();
    expect(container.querySelectorAll('.admin-stat-card--skeleton').length).toBe(4);
  });

  it('renders stat cards after successful fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockStats),
    });

    const { getByText } = render(<AdminDashboardIsland />);

    await waitFor(() => {
      expect(getByText('42')).toBeTruthy();
    });

    expect(getByText('Registered Users')).toBeTruthy();
    expect(getByText(/1[\s,.]?500 km/)).toBeTruthy();
    expect(getByText('Total Distance')).toBeTruthy();
    expect(getByText('7')).toBeTruthy();
    expect(getByText('Active Fellowships')).toBeTruthy();
    expect(getByText('150')).toBeTruthy();
    expect(getByText('Total Goals')).toBeTruthy();
  });

  it('renders error state when fetch fails with 500', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const { getByText, getByRole } = render(<AdminDashboardIsland />);

    await waitFor(() => {
      expect(getByRole('alert')).toBeTruthy();
    });

    expect(getByText('Failed to load dashboard statistics')).toBeTruthy();
    expect(getByText(/Retry/)).toBeTruthy();
  });

  it('retries fetch when Retry button is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockStats),
      });

    const { getByText } = render(<AdminDashboardIsland />);

    await waitFor(() => {
      expect(getByText(/Retry/)).toBeTruthy();
    });

    getByText(/Retry/).click();

    await waitFor(() => {
      expect(getByText('Registered Users')).toBeTruthy();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('redirects to /login on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });

    render(<AdminDashboardIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/login');
    });
  });

  it('redirects to /journey on 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({}),
    });

    render(<AdminDashboardIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/journey');
    });
  });

  it('renders heading "System Overview"', () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    const { getByText } = render(<AdminDashboardIsland />);

    expect(getByText('System Overview')).toBeTruthy();
  });

  it('fetches /api/admin/dashboard with auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockStats),
    });

    render(<AdminDashboardIsland />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/dashboard',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
        }),
      );
    });
  });
});
