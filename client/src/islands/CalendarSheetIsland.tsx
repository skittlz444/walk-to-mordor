import { h } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import {
  events,
  currentDate,
  currentView,
  formatDate,
  isToday,
  getDateAtMidnight,
  getEventForDate,
  fetchEvents,
  setView,
} from '../stores/calendarStore';
import type { CalendarEvent, CalendarView } from '../stores/calendarStore';

// ============================================================================
// Global declarations
// ============================================================================

declare global {
  interface Window {
    showDistanceModal?: (event: CalendarEvent | undefined, date: Date) => void;
    showCalendarModal: () => void;
    onCalendarDismiss: (callback: (() => void) | null) => void;
  }
}

// ============================================================================
// Module state for dismiss callback
// ============================================================================

let calendarModalDismissCallback: (() => void) | null = null;

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

function SheetWeekView({ onCellClick }: { onCellClick: (date: Date) => void }) {
  const startOfWeek = new Date(currentDate.value);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const cells = [];
  for (let i = 0; i < 7; i++) {
    const cellDate = new Date(startOfWeek);
    cellDate.setDate(cellDate.getDate() + i);
    const dateStr = formatDate(cellDate);
    const event = getEventForDate(cellDate);
    const isCurrentDay = isToday(cellDate);
    const midnight = getDateAtMidnight(cellDate);

    cells.push(
      <div
        key={dateStr}
        class={`calendar-cell week-cell${isCurrentDay ? ' today' : ''}`}
        data-date={dateStr}
        data-timestamp={String(midnight.getTime())}
        onClick={() => onCellClick(new Date(midnight))}
      >
        <div class="day-number">{cellDate.getDate()}</div>
        {event ? <div class="event-label">{event.title}</div> : null}
      </div>,
    );
  }

  return (
    <div class="week-view">
      <DayHeaders />
      <div class="week-row">{cells}</div>
    </div>
  );
}

function SheetMonthView({ onCellClick }: { onCellClick: (date: Date) => void }) {
  const cur = currentDate.value;
  const firstDay = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
  const startPadding = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const emptyCells = [];
  for (let i = 0; i < startPadding; i++) {
    emptyCells.push(<div class="calendar-cell empty" key={`empty-${i}`} />);
  }

  const dayCells = [];
  for (let day = 1; day <= totalDays; day++) {
    const cellDate = new Date(cur.getFullYear(), cur.getMonth(), day);
    const dateStr = formatDate(cellDate);
    const event = getEventForDate(cellDate);
    const isCurrentDay = isToday(cellDate);
    const midnight = getDateAtMidnight(cellDate);

    dayCells.push(
      <div
        key={dateStr}
        class={`calendar-cell month-cell${isCurrentDay ? ' today' : ''}`}
        data-date={dateStr}
        data-timestamp={String(midnight.getTime())}
        onClick={() => onCellClick(new Date(midnight))}
      >
        <div class="day-number">{day}</div>
        {event ? <div class="event-label">{event.title}</div> : null}
      </div>,
    );
  }

  return (
    <div class="month-view">
      <DayHeaders />
      <div class="month-grid">
        {emptyCells}
        {dayCells}
      </div>
    </div>
  );
}

// ============================================================================
// Calendar Title
// ============================================================================

function getSheetTitle(): string {
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

export function CalendarSheetIsland() {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Read signals to subscribe
  const view = currentView.value;
  const _date = currentDate.value;
  const _events = events.value;
  void _date;
  void _events;

  const closeSheet = useCallback(
    (wasDismissed: boolean) => {
      setOpen(false);
      const el = sheetRef.current;
      if (el) {
        const onEnd = () => {
          el.style.display = 'none';
          el.removeEventListener('transitionend', onEnd);
        };
        el.addEventListener('transitionend', onEnd, { once: true });
      }
      if (wasDismissed && calendarModalDismissCallback) {
        calendarModalDismissCallback();
        calendarModalDismissCallback = null;
      }
    },
    [],
  );

  const handleCellClick = useCallback(
    (cellDate: Date) => {
      const existingEvent = getEventForDate(cellDate);
      closeSheet(false);
      if (typeof window.showDistanceModal === 'function') {
        window.showDistanceModal(existingEvent, cellDate);
      }
    },
    [closeSheet],
  );

  const handleNavigate = useCallback((direction: number) => {
    const d = new Date(currentDate.value);
    if (currentView.value === 'week') {
      d.setDate(d.getDate() + direction * 7);
    } else {
      d.setMonth(d.getMonth() + direction);
    }
    currentDate.value = d;
  }, []);

  const handleToday = useCallback(() => {
    currentDate.value = new Date();
  }, []);

  const handleViewChange = useCallback((newView: CalendarView) => {
    setView(newView);
  }, []);

  // ESC handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        closeSheet(true);
      }
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, closeSheet]);

  // Expose globals on mount
  useEffect(() => {
    window.showCalendarModal = () => {
      // Fetch latest events then show
      fetchEvents().then(() => {
        if (sheetRef.current) {
          sheetRef.current.style.display = '';
        }
        requestAnimationFrame(() => {
          setOpen(true);
        });
      }).catch(() => {
        // Show anyway with current data
        if (sheetRef.current) {
          sheetRef.current.style.display = '';
        }
        requestAnimationFrame(() => {
          setOpen(true);
        });
      });
    };

    window.onCalendarDismiss = (callback: (() => void) | null) => {
      calendarModalDismissCallback = callback;
    };
  }, []);

  return (
    <div
      id="map-calendar-sheet"
      class={`map-calendar-sheet${open ? ' open' : ''}`}
      ref={sheetRef}
      style={{ display: 'none' }}
    >
      <div id="map-eventcalendar" class="custom-calendar">
        <div class="calendar-header">
          <div class="calendar-left">
            <div class="calendar-title" id="sheet-calendar-title">
              {getSheetTitle()}
            </div>
          </div>
          <div class="calendar-center">
            <div class="calendar-view-toggle">
              <div class="view-toggle-group">
                <input
                  type="radio"
                  name="sheet-view-toggle"
                  id="sheet-month-view"
                  value="month"
                  aria-label="Month view"
                  checked={view === 'month'}
                  onChange={() => handleViewChange('month')}
                />
                <label for="sheet-month-view">
                  <i class="fa-solid fa-calendar-days" />
                </label>
                <input
                  type="radio"
                  name="sheet-view-toggle"
                  id="sheet-week-view"
                  value="week"
                  aria-label="Week view"
                  checked={view === 'week'}
                  onChange={() => handleViewChange('week')}
                />
                <label for="sheet-week-view">
                  <i class="fa-solid fa-calendar-week" />
                </label>
              </div>
            </div>
          </div>
          <div class="calendar-nav">
            <div class="nav-buttons">
              <button
                class="nav-btn"
                id="sheet-prev-btn"
                aria-label="Previous"
                onClick={() => handleNavigate(-1)}
              >
                <i class="fas fa-chevron-left" />
              </button>
              <button
                class="nav-btn"
                id="sheet-next-btn"
                aria-label="Next"
                onClick={() => handleNavigate(1)}
              >
                <i class="fas fa-chevron-right" />
              </button>
            </div>
            <button class="today-btn" id="sheet-today-btn" onClick={handleToday}>
              Today
            </button>
            <button
              class="nav-btn calendar-close-btn"
              id="sheet-close-btn"
              aria-label="Close calendar"
              onClick={() => closeSheet(true)}
            >
              <i class="fas fa-times" />
            </button>
          </div>
        </div>
        <div class="calendar-grid" id="sheet-calendar-grid">
          {view === 'week' ? (
            <SheetWeekView onCellClick={handleCellClick} />
          ) : (
            <SheetMonthView onCellClick={handleCellClick} />
          )}
        </div>
      </div>
    </div>
  );
}
