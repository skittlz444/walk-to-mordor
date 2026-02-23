import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import {
  events,
  currentDate,
  currentView,
  formatDate,
  parseDate,
  isToday,
  getDateAtMidnight,
  getEventForDate,
  fetchEvents,
  navigateCalendar,
  goToToday,
  setView,
} from '../stores/calendarStore';
import type { CalendarEvent, CalendarView } from '../stores/calendarStore';

// ============================================================================
// Global declarations for backward compatibility
// ============================================================================

declare global {
  interface Window {
    showProgressModal?: (event: CalendarEvent | undefined, date: Date) => void;
    calendarModule: {
      updateCalendarAndTotal: () => Promise<void>;
      events: () => CalendarEvent[];
      setEvents: (newEvents: CalendarEvent[]) => void;
      currentDate: () => Date;
      currentView: () => CalendarView;
      formatDate: (date: Date) => string;
      parseDate: (dateStr: string) => Date;
      isToday: (date: Date) => boolean;
      getEventForDate: (date: Date) => CalendarEvent | undefined;
    };
    updateCalendarAndTotal: () => Promise<void>;
  }
}

// ============================================================================
// Cell Click Handler
// ============================================================================

function handleCellClick(dateStr: string): void {
  const cellDate = parseDate(dateStr);
  const existingEvent = getEventForDate(cellDate);
  if (typeof window.showProgressModal === 'function') {
    window.showProgressModal(existingEvent, cellDate);
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function DayHeaders() {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <div class="day-headers">
      {dayNames.map((day) => (
        <div class="day-header" key={day}>{day}</div>
      ))}
    </div>
  );
}

function CalendarCell({
  date,
  event,
  isCurrentDay,
  cellClass,
  otherMonth,
}: {
  date: Date;
  event: CalendarEvent | undefined;
  isCurrentDay: boolean;
  cellClass: string;
  otherMonth?: boolean;
}) {
  const dateStr = formatDate(date);
  const midnight = getDateAtMidnight(date);
  const classes = [
    'calendar-cell',
    cellClass,
    isCurrentDay ? 'today' : '',
    otherMonth ? 'other-month' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      class={classes}
      data-date={dateStr}
      data-timestamp={String(midnight.getTime())}
      onClick={() => handleCellClick(dateStr)}
    >
      <div class="day-number">{date.getDate()}</div>
      {event ? <div class="event-label">{event.title}</div> : null}
      {isCurrentDay ? <div class="today-indicator" /> : null}
    </div>
  );
}

function WeekView() {
  const startOfWeek = new Date(currentDate.value);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const cells = [];
  for (let i = 0; i < 7; i++) {
    const cellDate = new Date(startOfWeek);
    cellDate.setDate(cellDate.getDate() + i);
    cells.push(
      <CalendarCell
        key={formatDate(cellDate)}
        date={cellDate}
        event={getEventForDate(cellDate)}
        isCurrentDay={isToday(cellDate)}
        cellClass="week-cell"
      />,
    );
  }

  return (
    <div class="week-view">
      <DayHeaders />
      <div class="week-row">{cells}</div>
    </div>
  );
}

function MonthView() {
  const cur = currentDate.value;
  const firstDay = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);

  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const weeks = [];
  const cellDate = new Date(startDate);

  for (let week = 0; week < 6; week++) {
    const cells = [];
    for (let day = 0; day < 7; day++) {
      const d = new Date(cellDate);
      cells.push(
        <CalendarCell
          key={formatDate(d)}
          date={d}
          event={getEventForDate(d)}
          isCurrentDay={isToday(d)}
          cellClass="month-cell"
          otherMonth={d.getMonth() !== cur.getMonth()}
        />,
      );
      cellDate.setDate(cellDate.getDate() + 1);
    }
    weeks.push(
      <div class="week-row" key={week}>
        {cells}
      </div>,
    );

    if (cellDate > lastDay) break;
  }

  return (
    <div class="month-view">
      <DayHeaders />
      <div class="month-grid">{weeks}</div>
    </div>
  );
}

// ============================================================================
// Calendar Title
// ============================================================================

function getCalendarTitle(): string {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  if (currentView.value === 'week') {
    const startOfWeek = new Date(currentDate.value);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    return formatter.format(startOfWeek);
  }
  return formatter.format(currentDate.value);
}

// ============================================================================
// Main Component
// ============================================================================

export function CalendarIsland() {
  // Set up window globals on mount
  useEffect(() => {
    window.calendarModule = {
      updateCalendarAndTotal: fetchEvents,
      events: () => events.value,
      setEvents: (newEvents: CalendarEvent[]) => {
        events.value = newEvents;
      },
      currentDate: () => currentDate.value,
      currentView: () => currentView.value,
      formatDate,
      parseDate,
      isToday,
      getEventForDate,
    };
    window.updateCalendarAndTotal = fetchEvents;

    // Fetch events on mount
    fetchEvents();
  }, []);

  // Read signals to subscribe
  const view = currentView.value;
  const _date = currentDate.value;
  const _events = events.value;

  // Suppress unused variable warnings — these reads subscribe to signals
  void _date;
  void _events;

  return (
    <div id="eventcalendar">
    <div class="custom-calendar">
      <div class="calendar-header">
        <div class="calendar-left">
          <div class="calendar-title" id="calendar-title">
            {getCalendarTitle()}
          </div>
        </div>
        <div class="calendar-center">
          <div class="calendar-view-toggle">
            <div class="view-toggle-group">
              <input
                type="radio"
                name="view-toggle"
                id="month-view"
                value="month"
                aria-label="Month view"
                checked={view === 'month'}
                onChange={() => setView('month')}
              />
              <label for="month-view">
                <i class="fa-solid fa-calendar-days" />
              </label>
              <input
                type="radio"
                name="view-toggle"
                id="week-view"
                value="week"
                aria-label="Week view"
                checked={view === 'week'}
                onChange={() => setView('week')}
              />
              <label for="week-view">
                <i class="fa-solid fa-calendar-week" />
              </label>
            </div>
          </div>
        </div>
        <div class="calendar-nav">
          <div class="nav-buttons">
            <button
              class="nav-btn"
              id="prev-btn"
              aria-label="Previous"
              onClick={() => navigateCalendar(-1)}
            >
              <i class="fas fa-chevron-left" />
            </button>
            <button
              class="nav-btn"
              id="next-btn"
              aria-label="Next"
              onClick={() => navigateCalendar(1)}
            >
              <i class="fas fa-chevron-right" />
            </button>
          </div>
          <button class="today-btn" id="today-btn" onClick={goToToday}>
            Today
          </button>
        </div>
      </div>
      <div class="calendar-grid" id="calendar-grid">
        {view === 'week' ? <WeekView /> : <MonthView />}
      </div>
    </div>
    </div>
  );
}
