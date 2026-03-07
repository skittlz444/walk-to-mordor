import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/preact';
import { AdminMetricsIsland } from './AdminMetricsIsland';

const mockFetch = vi.fn();
let savedLocation: Location;

const summaryResponse = {
  totalGroupDistanceKm: 1500,
  activeWalkers: 6,
  milestonesUnlocked: 12,
};

const timelineResponse = {
  points: Array.from({ length: 30 }, (_, index) => ({
    date: `2026-02-${String(index + 1).padStart(2, '0')}`,
    distance_km: index % 2 === 0 ? 5 : 0,
  })),
  maxDistanceKm: 5,
};

const leaderboardResponse = {
  rows: [
    { id: 1, username: 'frodo', email: 'frodo@example.com', distance_km: 100 },
    { id: 2, username: 'sam', email: 'sam@example.com', distance_km: 0 },
  ],
  start: null,
  end: null,
  maxDistanceKm: 100,
};

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

  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(summaryResponse),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(timelineResponse),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(leaderboardResponse),
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

describe('AdminMetricsIsland', () => {
  it('renders summary cards, leaderboard, and timeline', async () => {
    const { getByText, container } = render(<AdminMetricsIsland />);

    await waitFor(() => {
      expect(getByText(/1[\s,.]?500 km/)).toBeTruthy();
    });

    expect(getByText('Active Walkers (7 days)')).toBeTruthy();
    expect(getByText('Milestones Unlocked')).toBeTruthy();
    expect(getByText('1. frodo')).toBeTruthy();
    expect(getByText('Distance (km)')).toBeTruthy();
    expect(getByText('Date')).toBeTruthy();
    expect(getByText('2.5 km')).toBeTruthy();
    expect(container.querySelectorAll('.admin-timeline-svg__bar').length).toBe(30);
  });

  it('redirects to /journey on 403', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({}),
    });

    render(<AdminMetricsIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/journey');
    });
  });

  it('loads a custom leaderboard range', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(summaryResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(timelineResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(leaderboardResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(leaderboardResponse),
      });

    const { getByText, getByLabelText } = render(<AdminMetricsIsland />);

    await waitFor(() => {
      expect(getByText('Custom')).toBeTruthy();
    });

    fireEvent.click(getByText('Custom'));
    fireEvent.input(getByLabelText('Start') as HTMLInputElement, { target: { value: '2026-02-01' } });
    fireEvent.input(getByLabelText('End') as HTMLInputElement, { target: { value: '2026-02-10' } });
    fireEvent.click(getByText('Apply'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/metrics/leaderboard?start=2026-02-01&end=2026-02-10',
        expect.any(Object)
      );
    });
  });
});
