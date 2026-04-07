import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/preact';
import { PalantirInsightModal } from '../PalantirInsightModal';
import * as appStore from '../../stores/appStore';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../stores/appStore', async (importOriginal) => {
  const actual = await importOriginal<typeof appStore>();
  return {
    ...actual,
    markPalantirViewed: vi.fn(),
  };
});

beforeEach(() => {
  // Token available by default
  localStorage.setItem('sessionToken', 'test-token-123');
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetch(data: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response));
}

const FULL_STATS = {
  has_activity: true,
  no_walks_this_week: false,
  this_week_km: 42.5,
  prev_week_km: 30.0,
  pace_trend: 'up' as const,
  pace_change_pct: 41,
  projection: { title: 'Rivendell', distance: 180.0, km_to_next: 26.8, days_away: 12 },
  fellowships: [
    { party_id: 1, party_name: 'The Fellowship', contribution_pct: 82 },
    { party_id: 2, party_name: 'Rangers of the North', contribution_pct: 45 },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PalantirInsightModal', () => {
  describe('rendering states', () => {
    it('shows loading message while fetching', async () => {
      // Never resolves within the test
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

      const { container } = render(<PalantirInsightModal />);
      expect(container.querySelector('.palantir-loading')).not.toBeNull();
      expect(container.querySelector('.palantir-loading')!.textContent).toMatch(/stirs/i);
    });

    it('shows error when not authenticated (no token)', async () => {
      localStorage.removeItem('sessionToken');

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-error')).not.toBeNull();
      });
      expect(container.querySelector('.palantir-error')!.textContent).toMatch(/not authenticated/i);
    });

    it('shows error when fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-error')).not.toBeNull();
      });
      expect(container.querySelector('.palantir-error')!.textContent).toMatch(/clouds over/i);
    });

    it('shows error when fetch returns non-ok status', async () => {
      mockFetch({ message: 'Unauthorized' }, 401);

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-error')).not.toBeNull();
      });
    });

    it('shows "no journeys" message when has_activity is false', async () => {
      mockFetch({ has_activity: false });

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-no-walks')).not.toBeNull();
      });
      expect(container.querySelector('.palantir-no-walks')!.textContent).toMatch(/no journeys/i);
    });

    it('shows "no movement this week" when no_walks_this_week is true', async () => {
      mockFetch({ has_activity: true, no_walks_this_week: true, prev_week_km: 15.0 });

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-no-walks')).not.toBeNull();
      });
      expect(container.querySelector('.palantir-no-walks')!.textContent).toMatch(/no movement/i);
    });

    it('renders supplied initial stats without fetching again', async () => {
      vi.stubGlobal('fetch', vi.fn());

      const { container } = render(<PalantirInsightModal initialStats={FULL_STATS} />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-stats')).not.toBeNull();
      });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  describe('full stats display', () => {
    it('renders this week km', async () => {
      mockFetch(FULL_STATS);

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-stats')).not.toBeNull();
      });
      expect(container.textContent).toContain('42.5 km');
    });

    it('renders pace trend with up arrow and percentage', async () => {
      mockFetch(FULL_STATS);

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.pace-up')).not.toBeNull();
      });
      expect(container.querySelector('.pace-up')!.textContent).toContain('41%');
      expect(container.querySelector('.pace-up')!.textContent).toMatch(/↑/);
    });

    it('renders down trend with down arrow', async () => {
      mockFetch({ ...FULL_STATS, pace_trend: 'down', pace_change_pct: 20 });

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.pace-down')).not.toBeNull();
      });
      expect(container.querySelector('.pace-down')!.textContent).toMatch(/↓/);
    });

    it('renders same trend with horizontal arrow', async () => {
      mockFetch({ ...FULL_STATS, pace_trend: 'same', pace_change_pct: 0 });

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.pace-same')).not.toBeNull();
      });
      expect(container.querySelector('.pace-same')!.textContent).toMatch(/→/);
    });

    it('renders first-active-week copy when previous week had no distance', async () => {
      mockFetch({
        ...FULL_STATS,
        prev_week_km: 0,
        pace_trend: 'up',
        pace_change_pct: null,
      });

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.pace-up')).not.toBeNull();
      });
      expect(container.querySelector('.pace-up')!.textContent).toContain('First active week');
    });

    it('renders projection milestone and days away', async () => {
      mockFetch(FULL_STATS);

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-projection')).not.toBeNull();
      });
      const text = container.querySelector('.palantir-projection')!.textContent;
      expect(text).toContain('26.8 km');
      expect(text).toContain('Rivendell');
      expect(text).toContain('12 days');
    });

    it('renders "day" singular for 1-day projection', async () => {
      mockFetch({ ...FULL_STATS, projection: { title: 'Bree', distance: 10, days_away: 1 } });

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-projection')).not.toBeNull();
      });
      expect(container.querySelector('.palantir-projection')!.textContent).toContain('1 day');
      expect(container.querySelector('.palantir-projection')!.textContent).not.toContain('1 days');
    });

    it('renders no projection block when projection is null', async () => {
      mockFetch({ ...FULL_STATS, projection: null });

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-stats')).not.toBeNull();
      });
      expect(container.querySelector('.palantir-projection')).toBeNull();
    });

    it('renders fellowship list with names and percentages', async () => {
      mockFetch(FULL_STATS);

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-fellowships')).not.toBeNull();
      });
      const items = container.querySelectorAll('.palantir-fellowship-item');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toContain('The Fellowship');
      expect(items[0].textContent).toContain('82%');
      expect(items[1].textContent).toContain('Rangers of the North');
      expect(items[1].textContent).toContain('45%');
    });

    it('renders no fellowship section when list is empty', async () => {
      mockFetch({ ...FULL_STATS, fellowships: [] });

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-stats')).not.toBeNull();
      });
      expect(container.querySelector('.palantir-fellowships')).toBeNull();
    });
  });

  describe('dismiss behaviour (overlay/popup mode)', () => {
    it('renders dismiss button in default (popup) mode', async () => {
      mockFetch(FULL_STATS);

      const { container } = render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-dismiss-btn')).not.toBeNull();
      });
    });

    it('calls markPalantirViewed and onDismiss when dismiss button clicked', async () => {
      mockFetch(FULL_STATS);
      const onDismiss = vi.fn();

      const { container } = render(<PalantirInsightModal onDismiss={onDismiss} />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-dismiss-btn')).not.toBeNull();
      });

      fireEvent.click(container.querySelector('.palantir-dismiss-btn')!);

      expect(appStore.markPalantirViewed).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not mark the Palantír viewed when dismissing a no-activity state', async () => {
      mockFetch({ has_activity: false });
      const onDismiss = vi.fn();

      const { container } = render(<PalantirInsightModal onDismiss={onDismiss} />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-dismiss-btn')).not.toBeNull();
      });

      fireEvent.click(container.querySelector('.palantir-dismiss-btn')!);

      expect(appStore.markPalantirViewed).not.toHaveBeenCalled();
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('dismisses on Escape key press', async () => {
      mockFetch(FULL_STATS);
      const onDismiss = vi.fn();

      render(<PalantirInsightModal onDismiss={onDismiss} />);

      await waitFor(() => {
        // wait for loading to finish so Escape listener is attached
        expect(globalThis.fetch).toHaveBeenCalled();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(appStore.markPalantirViewed).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('dismisses when overlay background is clicked', async () => {
      mockFetch(FULL_STATS);
      const onDismiss = vi.fn();

      const { container } = render(<PalantirInsightModal onDismiss={onDismiss} />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-dismiss-btn')).not.toBeNull();
      });

      const overlay = container.querySelector('.palantir-overlay') as HTMLElement;
      // Click the overlay element directly (not a child)
      fireEvent.click(overlay);

      expect(appStore.markPalantirViewed).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('alwaysOpen mode (inline, /stats page)', () => {
    it('renders .palantir-inline wrapper instead of overlay', async () => {
      mockFetch(FULL_STATS);

      const { container } = render(<PalantirInsightModal alwaysOpen />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-inline')).not.toBeNull();
      });
      expect(container.querySelector('.palantir-overlay')).toBeNull();
    });

    it('does not render dismiss button', async () => {
      mockFetch(FULL_STATS);

      const { container } = render(<PalantirInsightModal alwaysOpen />);

      await waitFor(() => {
        expect(container.querySelector('.palantir-stats')).not.toBeNull();
      });
      expect(container.querySelector('.palantir-dismiss-btn')).toBeNull();
    });

    it('does not attach Escape key listener in alwaysOpen mode', async () => {
      mockFetch(FULL_STATS);
      const onDismiss = vi.fn();

      render(<PalantirInsightModal alwaysOpen onDismiss={onDismiss} />);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(appStore.markPalantirViewed).not.toHaveBeenCalled();
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('dialog has role="dialog" and aria-label', async () => {
      mockFetch(FULL_STATS);

      const { container } = render(<PalantirInsightModal />);

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog!.getAttribute('aria-label')).toContain('Palantír');
    });

    it('orb element has role="img" and aria-label', async () => {
      mockFetch(FULL_STATS);

      const { container } = render(<PalantirInsightModal />);

      const orb = container.querySelector('[role="img"]');
      expect(orb).not.toBeNull();
      expect(orb!.getAttribute('aria-label')).toContain('orb');
    });
  });

  describe('fetch request', () => {
    it('sends Authorization header with session token', async () => {
      mockFetch(FULL_STATS);

      render(<PalantirInsightModal />);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          '/api/stats/weekly',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token-123',
            }),
          }),
        );
      });
    });
  });
});
