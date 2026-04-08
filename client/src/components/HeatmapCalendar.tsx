import { useSignal, useComputed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { fetchHeatmapData, type HeatmapDay } from '../utils/heatmap';

/** Map distance to an intensity level (0–4) for colour coding */
function intensityLevel(distance: number): number {
  if (distance <= 0) return 0;
  if (distance < 2) return 1;
  if (distance < 5) return 2;
  if (distance < 10) return 3;
  return 4;
}

/** Readable label for an intensity bucket */
const INTENSITY_LABELS: Record<number, string> = {
  0: 'No journey logged',
  1: 'A short trail (< 2 km)',
  2: 'A fair march (2–5 km)',
  3: 'A great ride (5–10 km)',
  4: 'An epic quest (10+ km)',
};

function parseUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

/** Build a UTC-safe grid from the response start date through today. */
function buildGrid(days: HeatmapDay[], startDate: string | null): { date: string; distance: number }[][] {
  const lookup = new Map<string, number>();
  for (const d of days) {
    lookup.set(d.date, d.distance);
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const gridStart = startDate
    ? parseUtcDate(startDate)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 364));
  const cells: { date: string; distance: number; dayOfWeek: number }[] = [];
  for (const d = new Date(gridStart); d.getTime() <= today.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    cells.push({
      date: dateStr,
      distance: lookup.get(dateStr) ?? 0,
      dayOfWeek: d.getUTCDay(),
    });
  }

  // Group into week rows (each row = 7 cols, Sun=0 … Sat=6)
  const weeks: { date: string; distance: number }[][] = [];
  let currentWeek: { date: string; distance: number }[] = [];

  // Pad leading empty cells for the first partial week
  const firstDow = cells[0].dayOfWeek;
  for (let pad = 0; pad < firstDow; pad++) {
    currentWeek.push({ date: '', distance: -1 });
  }

  for (const cell of cells) {
    currentWeek.push({ date: cell.date, distance: cell.distance });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: '', distance: -1 });
    }
    weeks.push(currentWeek);
  }

  // Reverse so latest week is first (top)
  return weeks.reverse();
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTooltipDate(dateStr: string): string {
  const d = parseUtcDate(dateStr);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function HeatmapCalendar() {
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  const days = useSignal<HeatmapDay[]>([]);
  const startDate = useSignal<string | null>(null);
  const currentStreak = useSignal(0);
  const longestStreak = useSignal(0);
  const tooltip = useSignal<{ x: number; y: number; date: string; distance: number } | null>(null);

  const weeks = useComputed(() => buildGrid(days.value, startDate.value));

  useEffect(() => {
    let cancelled = false;
    fetchHeatmapData()
      .then((data) => {
        if (cancelled) return;
        days.value = data.days;
        startDate.value = data.startDate ?? null;
        currentStreak.value = data.currentStreak;
        longestStreak.value = data.longestStreak;
        loading.value = false;
      })
      .catch((err: Error) => {
        if (cancelled) return;
        error.value = err.message;
        loading.value = false;
      });
    return () => { cancelled = true; };
  }, []);

  function showTooltip(target: EventTarget | null, date: string, distance: number) {
    if (!date || !(target instanceof HTMLElement)) return;
    const rect = target.getBoundingClientRect();
    tooltip.value = { x: rect.left + rect.width / 2, y: rect.top, date, distance };
  }

  function handleCellLeave() {
    tooltip.value = null;
  }

  // Month labels on the left — show label on the first week of each month
  const monthLabels = useComputed(() => {
    const labels = new Map<number, string>(); // row index → label
    let lastMonth = -1;
    // Iterate in chronological order (bottom to top) for correct month transitions
    for (let w = weeks.value.length - 1; w >= 0; w--) {
      for (const cell of weeks.value[w]) {
        if (cell.date) {
          const month = parseUtcDate(cell.date).getUTCMonth();
          if (month !== lastMonth) {
            labels.set(w, MONTH_NAMES[month]);
            lastMonth = month;
          }
          break;
        }
      }
    }
    return labels;
  });

  if (loading.value) {
    return (
      <div class="heatmap-loading">
        <p>Consulting the archives of Minas Tirith…</p>
      </div>
    );
  }

  if (error.value) {
    return (
      <div class="heatmap-error">
        <p>The archives could not be reached. ({error.value})</p>
      </div>
    );
  }

  return (
    <div class="heatmap-container">
      {/* Streak display */}
      <div class="heatmap-streaks">
        <div class="heatmap-streak-card heatmap-streak-current">
          <span class="heatmap-streak-icon">🔥</span>
          <span class="heatmap-streak-value">{currentStreak.value}</span>
          <span class="heatmap-streak-label">day streak</span>
        </div>
        <div class="heatmap-streak-card heatmap-streak-longest">
          <span class="heatmap-streak-icon">⚔️</span>
          <span class="heatmap-streak-value">{longestStreak.value}</span>
          <span class="heatmap-streak-label">longest quest</span>
        </div>
      </div>

      {/* Heatmap grid — vertical: latest week at top, days as columns */}
      <div class="heatmap-grid-area">
        {/* Day-of-week header row */}
        <div class="heatmap-day-header">
          <span class="heatmap-month-col" />
          {DAY_LABELS.map((d) => (
            <span key={d} class="heatmap-day-label">{d}</span>
          ))}
        </div>

        {/* Week rows */}
        <div class="heatmap-grid">
          {weeks.value.map((week, w) => (
            <div key={w} class="heatmap-row">
              <span class="heatmap-month-col">
                {monthLabels.value.get(w) ?? ''}
              </span>
              {week.map((cell, col) => {
                if (!cell || cell.distance < 0) {
                  return <span key={col} class="heatmap-cell heatmap-cell-empty" />;
                }
                const level = intensityLevel(cell.distance);
                return (
                  <button
                    key={col}
                    type="button"
                    class={`heatmap-cell heatmap-cell-button heatmap-level-${level}`}
                    data-date={cell.date}
                    data-distance={cell.distance}
                    onMouseEnter={(e) => showTooltip(e.currentTarget, cell.date, cell.distance)}
                    onMouseLeave={handleCellLeave}
                    onFocus={(e) => showTooltip(e.currentTarget, cell.date, cell.distance)}
                    onBlur={handleCellLeave}
                    onClick={(e) => showTooltip(e.currentTarget, cell.date, cell.distance)}
                    aria-label={`View walk details for ${formatTooltipDate(cell.date)}: ${cell.distance.toFixed(1)} km`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div class="heatmap-legend">
        <span class="heatmap-legend-label">Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} class={`heatmap-cell heatmap-level-${level}`} title={INTENSITY_LABELS[level]} />
        ))}
        <span class="heatmap-legend-label">More</span>
      </div>

      {/* Tooltip */}
      {tooltip.value && (
        <div
          class="heatmap-tooltip"
          style={{
            position: 'fixed',
            left: `${tooltip.value.x}px`,
            top: `${tooltip.value.y - 8}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <strong>{formatTooltipDate(tooltip.value.date)}</strong>
          <br />
          {tooltip.value.distance > 0
            ? `${tooltip.value.distance.toFixed(1)} km — ${INTENSITY_LABELS[intensityLevel(tooltip.value.distance)]}`
            : 'No journey logged'}
        </div>
      )}
    </div>
  );
}
