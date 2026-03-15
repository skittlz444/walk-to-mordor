import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/preact';
import { ActivityFeed } from './ActivityFeed';

const mockFetch = vi.fn();

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    user_id: 10,
    display_name: 'Frodo',
    distance: 5.25,
    date: todayStr(),
    logged_at: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);

  const store: Record<string, string> = { sessionToken: 'test-token' };
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  });

  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ activities: [] }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('ActivityFeed', () => {
  it('shows loading spinner initially', () => {
    // Never-resolving fetch keeps loading state
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { container } = render(<ActivityFeed partyId={1} currentUserId={1} />);

    expect(container.querySelector('.party-activity-feed--loading')).toBeTruthy();
    expect(container.textContent).toContain('Loading activity');
  });

  it('renders activities with correct formatting', async () => {
    const activities = [
      makeActivity({ user_id: 10, display_name: 'Frodo', distance: 5.25, logged_at: '2025-01-15T10:00:00Z' }),
      makeActivity({ user_id: 20, display_name: 'Sam', distance: 3.10, logged_at: '2025-01-15T11:00:00Z' }),
      makeActivity({ user_id: 30, display_name: 'Gandalf', distance: 12.00, logged_at: '2025-01-15T12:00:00Z' }),
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ activities }),
    });

    const { container } = render(<ActivityFeed partyId={1} currentUserId={99} />);

    await waitFor(() => {
      const items = container.querySelectorAll('.party-activity-item');
      expect(items).toHaveLength(3);
    });

    const items = container.querySelectorAll('.party-activity-item');
    expect(items[0].textContent).toContain('Frodo');
    expect(items[0].textContent).toContain('5.25 km');
    expect(items[1].textContent).toContain('Sam');
    expect(items[1].textContent).toContain('3.10 km');
    expect(items[2].textContent).toContain('Gandalf');
    expect(items[2].textContent).toContain('12.00 km');
  });

  it('highlights own activities with --own class and shows "You"', async () => {
    const activities = [
      makeActivity({ user_id: 42, display_name: 'Frodo', distance: 5.0 }),
      makeActivity({ user_id: 99, display_name: 'Other', distance: 3.0, logged_at: '2025-01-15T11:00:00Z' }),
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ activities }),
    });

    const { container } = render(<ActivityFeed partyId={1} currentUserId={42} />);

    await waitFor(() => {
      expect(container.querySelectorAll('.party-activity-item')).toHaveLength(2);
    });

    const items = container.querySelectorAll('.party-activity-item');
    expect(items[0].classList.contains('party-activity-item--own')).toBe(true);
    expect(items[0].textContent).toContain('You');
    expect(items[0].textContent).not.toContain('Frodo');
  });

  it('shows display_name for other members', async () => {
    const activities = [
      makeActivity({ user_id: 99, display_name: 'Sam', distance: 2.5 }),
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ activities }),
    });

    const { container } = render(<ActivityFeed partyId={1} currentUserId={1} />);

    await waitFor(() => {
      expect(container.querySelectorAll('.party-activity-item')).toHaveLength(1);
    });

    const item = container.querySelector('.party-activity-item')!;
    expect(item.classList.contains('party-activity-item--own')).toBe(false);
    expect(item.textContent).toContain('Sam');
  });

  it('shows empty state when no activities', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ activities: [] }),
    });

    const { container } = render(<ActivityFeed partyId={1} currentUserId={1} />);

    await waitFor(() => {
      expect(container.querySelector('.party-activity-feed--empty')).toBeTruthy();
    });

    expect(container.textContent).toContain('No recent activity');
  });

  it('shows error state with retry button on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { container } = render(<ActivityFeed partyId={1} currentUserId={1} />);

    await waitFor(() => {
      expect(container.querySelector('.party-activity-feed--error')).toBeTruthy();
    });

    expect(container.textContent).toContain('Network error');
    expect(container.querySelector('.party-btn')).toBeTruthy();
    expect(container.querySelector('.party-btn')?.textContent).toBe('Retry');
  });

  it('shows forbidden message on 403 response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({}),
    });

    const { container } = render(<ActivityFeed partyId={1} currentUserId={1} />);

    await waitFor(() => {
      expect(container.querySelector('.party-activity-feed--error')).toBeTruthy();
    });

    expect(container.textContent).toContain('no longer have access');
  });

  it('formats Today, Yesterday, and older dates correctly', async () => {
    const today = todayStr();
    const yesterday = yesterdayStr();

    const activities = [
      makeActivity({ date: today, logged_at: '2025-01-15T10:00:00Z' }),
      makeActivity({ user_id: 20, date: yesterday, logged_at: '2025-01-15T11:00:00Z' }),
      makeActivity({ user_id: 30, date: '2024-03-15', logged_at: '2025-01-15T12:00:00Z' }),
      makeActivity({ user_id: 40, date: '2023-06-05', logged_at: '2025-01-15T13:00:00Z' }),
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ activities }),
    });

    const { container } = render(<ActivityFeed partyId={1} currentUserId={99} />);

    await waitFor(() => {
      expect(container.querySelectorAll('.party-activity-item')).toHaveLength(4);
    });

    const items = container.querySelectorAll('.party-activity-item');
    // Relative dates: no "on" prefix
    expect(items[0].textContent).toContain('Today');
    expect(items[0].textContent).not.toContain('on Today');
    expect(items[1].textContent).toContain('Yesterday');
    expect(items[1].textContent).not.toContain('on Yesterday');
    // Absolute dates: "on" prefix retained
    // 2024-03-15 => "Mar 15" (same year check depends on current year, but 2024 is past)
    expect(items[2].textContent).toContain('on Mar 15');
    // 2023-06-05 => "Jun 5, 2023"
    expect(items[3].textContent).toContain('on Jun 5, 2023');
  });

  it('sets up auto-refresh interval with 60000ms', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'setInterval');

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ activities: [] }),
    });

    render(<ActivityFeed partyId={1} currentUserId={1} />);

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 60000);

    spy.mockRestore();
  });

  it('refreshes on visibilitychange to visible', async () => {
    vi.useFakeTimers();

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ activities: [] }),
    });

    render(<ActivityFeed partyId={1} currentUserId={1} />);

    // Flush initial fetch
    await vi.advanceTimersByTimeAsync(0);
    const callsBeforeEvent = mockFetch.mock.calls.length;

    // Simulate tab becoming visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBeforeEvent);
  });
});
