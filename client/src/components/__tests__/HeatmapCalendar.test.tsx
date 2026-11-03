import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/preact';
import { HeatmapCalendar } from '../HeatmapCalendar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetch(data: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayOffset(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/** Monday-first weekday labels, as the heatmap must render them left to right. */
const MONDAY_FIRST_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Zero-based Monday-first column index for a UTC date string (Mon=0 … Sun=6). */
function mondayColumn(dateStr: string): number {
  return (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** A recent UTC date (7–13 days ago) whose weekday is `dow` (0=Sun … 6=Sat). */
function recentDateWithDow(dow: number): string {
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  for (let offset = 7; offset < 14; offset++) {
    const candidate = new Date(base);
    candidate.setUTCDate(candidate.getUTCDate() - offset);
    if (candidate.getUTCDay() === dow) {
      return candidate.toISOString().slice(0, 10);
    }
  }
  throw new Error(`No UTC date with day-of-week ${dow} found in the last two weeks`);
}

const EMPTY_DATA = { days: [], currentStreak: 0, longestStreak: 0, startDate: dayOffset(364) };

const SAMPLE_DATA = {
  days: [
    { date: dayOffset(2), distance: 1.5 },
    { date: dayOffset(1), distance: 6.0 },
    { date: today(), distance: 11.0 },
  ],
  currentStreak: 3,
  longestStreak: 5,
  startDate: dayOffset(364),
};

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.setItem('sessionToken', 'test-token-123');
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HeatmapCalendar', () => {
  describe('rendering states', () => {
    it('shows loading message while fetching', () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

      const { container } = render(<HeatmapCalendar />);
      expect(container.querySelector('.heatmap-loading')).not.toBeNull();
      expect(container.textContent).toMatch(/Minas Tirith/i);
    });

    it('shows error when not authenticated', async () => {
      localStorage.removeItem('sessionToken');

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-error')).not.toBeNull();
      });
      expect(container.textContent).toMatch(/Not authenticated/i);
    });

    it('shows error when fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-error')).not.toBeNull();
      });
      expect(container.textContent).toMatch(/Network error/i);
    });

    it('shows error when API returns non-ok status', async () => {
      mockFetch({}, 500);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-error')).not.toBeNull();
      });
      expect(container.textContent).toMatch(/HTTP 500/i);
    });
  });

  describe('data display', () => {
    it('renders heatmap grid when data loads', async () => {
      mockFetch(EMPTY_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-container')).not.toBeNull();
      });
      expect(container.querySelector('.heatmap-grid')).not.toBeNull();
    });

    it('displays streak values', async () => {
      mockFetch(SAMPLE_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-streak-current')).not.toBeNull();
      });

      const currentVal = container.querySelector('.heatmap-streak-current .heatmap-streak-value');
      const longestVal = container.querySelector('.heatmap-streak-longest .heatmap-streak-value');
      expect(currentVal?.textContent).toBe('3');
      expect(longestVal?.textContent).toBe('5');
    });

    it('renders day cells with correct intensity levels', async () => {
      mockFetch(SAMPLE_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-grid')).not.toBeNull();
      });

      // 1.5 km → level 1, 6.0 km → level 3, 11.0 km → level 4
      const level1Cells = container.querySelectorAll('.heatmap-level-1[data-date]');
      const level3Cells = container.querySelectorAll('.heatmap-level-3[data-date]');
      const level4Cells = container.querySelectorAll('.heatmap-level-4[data-date]');

      expect(level1Cells.length).toBeGreaterThanOrEqual(1);
      expect(level3Cells.length).toBeGreaterThanOrEqual(1);
      expect(level4Cells.length).toBeGreaterThanOrEqual(1);
    });

    it('renders legend with 5 intensity levels', async () => {
      mockFetch(EMPTY_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-legend')).not.toBeNull();
      });

      const legendCells = container.querySelectorAll('.heatmap-legend .heatmap-cell');
      expect(legendCells.length).toBe(5);
    });

    it('renders month labels', async () => {
      mockFetch(EMPTY_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-grid')).not.toBeNull();
      });

      // Month labels appear in .heatmap-month-col elements within rows
      const monthCols = container.querySelectorAll('.heatmap-month-col');
      expect(monthCols.length).toBeGreaterThan(0);
      // At least some should have text content (month abbreviations)
      const withText = Array.from(monthCols).filter((el) => el.textContent?.trim());
      expect(withText.length).toBeGreaterThan(0);
    });
  });

  describe('tooltip interaction', () => {
    it('shows tooltip on cell hover', async () => {
      mockFetch(SAMPLE_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-grid')).not.toBeNull();
      });

      // Find a cell with data
      const cell = container.querySelector(`button[data-date="${today()}"]`);
      expect(cell).not.toBeNull();

      fireEvent.mouseEnter(cell!);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-tooltip')).not.toBeNull();
      });

      const tooltip = container.querySelector('.heatmap-tooltip');
      expect(tooltip?.textContent).toMatch(/11\.0 km/);
    });

    it('hides tooltip on mouse leave', async () => {
      mockFetch(SAMPLE_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-grid')).not.toBeNull();
      });

      const cell = container.querySelector(`button[data-date="${today()}"]`);
      fireEvent.mouseEnter(cell!);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-tooltip')).not.toBeNull();
      });

      fireEvent.mouseLeave(cell!);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-tooltip')).toBeNull();
      });
    });

    it('shows tooltip on cell click (mobile)', async () => {
      mockFetch(SAMPLE_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-grid')).not.toBeNull();
      });

      const cell = container.querySelector(`button[data-date="${today()}"]`);
      fireEvent.click(cell!);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-tooltip')).not.toBeNull();
      });
    });

    it('shows tooltip on keyboard focus and hides it on blur', async () => {
      mockFetch(SAMPLE_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-grid')).not.toBeNull();
      });

      const cell = container.querySelector(`button[data-date="${today()}"]`);
      expect(cell).not.toBeNull();

      fireEvent.focus(cell!);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-tooltip')).not.toBeNull();
      });

      fireEvent.blur(cell!);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-tooltip')).toBeNull();
      });
    });
  });

  describe('monday-first week layout', () => {
    it('labels weekday columns Monday through Sunday', async () => {
      mockFetch(EMPTY_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-grid')).not.toBeNull();
      });

      const labels = Array.from(
        container.querySelectorAll('.heatmap-day-header .heatmap-day-label'),
      ).map((el) => el.textContent);

      expect(labels).toEqual(MONDAY_FIRST_LABELS);
    });

    it('aligns every date with its Monday-first column and weekday header', async () => {
      mockFetch(EMPTY_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-grid')).not.toBeNull();
      });

      const headerLabels = Array.from(
        container.querySelectorAll('.heatmap-day-header .heatmap-day-label'),
      );
      expect(headerLabels).toHaveLength(7);

      const cells = Array.from(
        container.querySelectorAll<HTMLButtonElement>('.heatmap-grid button[data-date]'),
      );
      expect(cells).toHaveLength(365);

      for (const cell of cells) {
        const dateStr = cell.dataset.date;
        expect(dateStr).toBeTruthy();

        const row = cell.closest('.heatmap-row');
        expect(row).not.toBeNull();

        const dayCells = Array.from(row!.children).slice(1);
        expect(dayCells).toHaveLength(7);

        const column = dayCells.indexOf(cell);
        const expectedColumn = mondayColumn(dateStr!);
        expect(column).toBe(expectedColumn);
        // Header in the same column names the weekday the date actually falls on.
        expect(headerLabels[column]?.textContent).toBe(MONDAY_FIRST_LABELS[expectedColumn]);
      }

      // Sanity-check the explicit case the spec calls out: today under its own weekday.
      const todayCell = container.querySelector<HTMLButtonElement>(
        `.heatmap-grid button[data-date="${today()}"]`,
      );
      expect(todayCell).not.toBeNull();
      const todayRow = todayCell!.closest('.heatmap-row')!;
      expect(Array.from(todayRow.children).slice(1).indexOf(todayCell!)).toBe(mondayColumn(today()));
    });

    it('pads the earliest week at the front when the start date is not a Monday', async () => {
      const startDate = recentDateWithDow(3); // a Wednesday
      expect(mondayColumn(startDate)).toBe(2);

      mockFetch({ ...EMPTY_DATA, startDate });

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-grid')).not.toBeNull();
      });

      const rows = container.querySelectorAll('.heatmap-grid .heatmap-row');
      expect(rows.length).toBeGreaterThan(0);

      // Rows are reversed: the earliest (chronological) week is the last row.
      const earliestRow = rows[rows.length - 1];
      const children = Array.from(earliestRow.children);
      expect(children[0].classList.contains('heatmap-month-col')).toBe(true);

      const dayCells = children.slice(1);
      expect(dayCells).toHaveLength(7);

      const firstRealIndex = dayCells.findIndex((el) => el.matches('button[data-date]'));
      expect(firstRealIndex).toBe(2);
      expect(
        dayCells.slice(0, firstRealIndex).every((el) => el.classList.contains('heatmap-cell-empty')),
      ).toBe(true);

      // The first real cell of the row is the start date, sitting in the Wednesday column.
      const firstReal = dayCells[firstRealIndex] as HTMLButtonElement;
      expect(firstReal.dataset.date).toBe(startDate);

      // Padding only ever leads: no empty cells once real days start.
      expect(dayCells.slice(firstRealIndex).every((el) => el.matches('button[data-date]'))).toBe(true);
    });
  });

  describe('grid structure', () => {
    it('renders 365 real day cells (plus padding)', async () => {
      mockFetch(EMPTY_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-grid')).not.toBeNull();
      });

      // All cells include day labels, real cells, and empty padding cells
      // 365 days rendered as level-0 cells inside the grid, plus 1 in the legend
      const gridLevel0Cells = container.querySelectorAll('.heatmap-grid .heatmap-level-0');
      expect(gridLevel0Cells.length).toBe(365);
    });

    it('renders only days since account creation when startDate is recent', async () => {
      mockFetch({ ...EMPTY_DATA, startDate: dayOffset(30) });

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-grid')).not.toBeNull();
      });

      const gridLevel0Cells = container.querySelectorAll('.heatmap-grid .heatmap-level-0');
      expect(gridLevel0Cells.length).toBe(31);
    });

    it('passes correct auth header to fetch', async () => {
      mockFetch(EMPTY_DATA);

      render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(1);
      });

      expect(fetch).toHaveBeenCalledWith('/api/stats/heatmap', {
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-123',
        }),
      });
    });

    it('renders interactive heatmap cells as buttons', async () => {
      mockFetch(SAMPLE_DATA);

      const { container } = render(<HeatmapCalendar />);

      await waitFor(() => {
        expect(container.querySelector('.heatmap-grid')).not.toBeNull();
      });

      expect(container.querySelectorAll('.heatmap-grid button[data-date]').length).toBeGreaterThan(0);
    });
  });
});
