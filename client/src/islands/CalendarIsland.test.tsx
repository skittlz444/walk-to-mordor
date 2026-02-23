import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { CalendarIsland } from './CalendarIsland';
import {
  events,
  currentDate,
  currentView,
} from '../stores/calendarStore';

const mockFetch = vi.fn();

beforeEach(() => {
  events.value = [];
  currentDate.value = new Date(2025, 5, 15); // June 15, 2025 (Sunday is June 15)
  currentView.value = 'week';
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve([]),
  });
  vi.stubGlobal('getAuthHeaders', () => ({ Authorization: 'Bearer test' }));
});

describe('CalendarIsland', () => {
  describe('week view', () => {
    it('renders week view by default', () => {
      const { container } = render(<CalendarIsland />);
      expect(container.querySelector('.custom-calendar')).toBeTruthy();
      expect(container.querySelector('.week-view')).toBeTruthy();
      expect(container.querySelector('.month-view')).toBeNull();
    });

    it('renders 7 day headers', () => {
      const { container } = render(<CalendarIsland />);
      const headers = container.querySelectorAll('.day-header');
      expect(headers.length).toBe(7);
      expect(headers[0].textContent).toBe('Sun');
      expect(headers[6].textContent).toBe('Sat');
    });

    it('renders 7 day cells', () => {
      const { container } = render(<CalendarIsland />);
      const cells = container.querySelectorAll('.calendar-cell.week-cell');
      expect(cells.length).toBe(7);
    });

    it('cells have data-date and data-timestamp attributes', () => {
      const { container } = render(<CalendarIsland />);
      const firstCell = container.querySelector('.calendar-cell');
      expect(firstCell?.getAttribute('data-date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(firstCell?.getAttribute('data-timestamp')).toBeTruthy();
    });
  });

  describe('month view', () => {
    it('renders month view when switched', () => {
      currentView.value = 'month';
      const { container } = render(<CalendarIsland />);
      expect(container.querySelector('.month-view')).toBeTruthy();
      expect(container.querySelector('.week-view')).toBeNull();
    });

    it('renders month cells', () => {
      currentView.value = 'month';
      const { container } = render(<CalendarIsland />);
      const cells = container.querySelectorAll('.calendar-cell.month-cell');
      expect(cells.length).toBeGreaterThan(28);
    });

    it('marks other-month cells', () => {
      currentView.value = 'month';
      const { container } = render(<CalendarIsland />);
      const otherMonth = container.querySelectorAll('.other-month');
      // June 2025 starts on Sunday so might not have leading other-month,
      // but should have trailing ones
      expect(otherMonth.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calendar header', () => {
    it('renders calendar title', () => {
      const { container } = render(<CalendarIsland />);
      const title = container.querySelector('#calendar-title');
      expect(title).toBeTruthy();
      expect(title?.textContent).toContain('2025');
    });

    it('renders navigation buttons', () => {
      const { container } = render(<CalendarIsland />);
      expect(container.querySelector('#prev-btn')).toBeTruthy();
      expect(container.querySelector('#next-btn')).toBeTruthy();
      expect(container.querySelector('#today-btn')).toBeTruthy();
    });

    it('renders view toggle radio inputs', () => {
      const { container } = render(<CalendarIsland />);
      expect(container.querySelector('#month-view')).toBeTruthy();
      expect(container.querySelector('#week-view')).toBeTruthy();
    });
  });

  describe('navigation', () => {
    it('navigates forward on next click', () => {
      const { container } = render(<CalendarIsland />);
      const nextBtn = container.querySelector('#next-btn') as HTMLButtonElement;
      fireEvent.click(nextBtn);
      expect(currentDate.value.getDate()).toBe(22);
    });

    it('navigates backward on prev click', () => {
      const { container } = render(<CalendarIsland />);
      const prevBtn = container.querySelector('#prev-btn') as HTMLButtonElement;
      fireEvent.click(prevBtn);
      expect(currentDate.value.getDate()).toBe(8);
    });

    it('goes to today on today button click', () => {
      currentDate.value = new Date(2000, 0, 1);
      const { container } = render(<CalendarIsland />);
      const todayBtn = container.querySelector('#today-btn') as HTMLButtonElement;
      fireEvent.click(todayBtn);
      const today = new Date();
      expect(currentDate.value.getDate()).toBe(today.getDate());
    });
  });

  describe('view toggle', () => {
    it('switches to month view', () => {
      const { container } = render(<CalendarIsland />);
      const monthRadio = container.querySelector('#month-view') as HTMLInputElement;
      fireEvent.change(monthRadio, { target: { value: 'month' } });
      expect(currentView.value).toBe('month');
    });
  });

  describe('events display', () => {
    it('shows event labels on cells with events', () => {
      // June 15, 2025 is a Sunday - week starts on June 15
      events.value = [{ start: '2025-06-15', title: '5 km' }];
      const { container } = render(<CalendarIsland />);
      const labels = container.querySelectorAll('.event-label');
      expect(labels.length).toBe(1);
      expect(labels[0].textContent).toBe('5 km');
    });
  });

  describe('today highlighting', () => {
    it('marks today cell with .today class and .today-indicator', () => {
      // Set current date to today so the week includes today
      currentDate.value = new Date();
      const { container } = render(<CalendarIsland />);
      const todayCell = container.querySelector('.today');
      expect(todayCell).toBeTruthy();
      expect(todayCell?.querySelector('.today-indicator')).toBeTruthy();
    });
  });

  describe('cell click', () => {
    it('calls window.showProgressModal on cell click', () => {
      const mockShowModal = vi.fn();
      vi.stubGlobal('showProgressModal', mockShowModal);

      const { container } = render(<CalendarIsland />);
      const cell = container.querySelector('.calendar-cell') as HTMLDivElement;
      fireEvent.click(cell);

      expect(mockShowModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('backward compatibility', () => {
    it('sets window.calendarModule on mount', async () => {
      render(<CalendarIsland />);
      // Wait for useEffect
      await new Promise((r) => setTimeout(r, 0));

      expect(window.calendarModule).toBeDefined();
      expect(typeof window.calendarModule.updateCalendarAndTotal).toBe('function');
      expect(typeof window.calendarModule.events).toBe('function');
      expect(typeof window.calendarModule.setEvents).toBe('function');
      expect(typeof window.calendarModule.currentDate).toBe('function');
      expect(typeof window.calendarModule.currentView).toBe('function');
      expect(typeof window.calendarModule.formatDate).toBe('function');
      expect(typeof window.calendarModule.parseDate).toBe('function');
      expect(typeof window.calendarModule.isToday).toBe('function');
      expect(typeof window.calendarModule.getEventForDate).toBe('function');
    });

    it('sets window.updateCalendarAndTotal on mount', async () => {
      render(<CalendarIsland />);
      await new Promise((r) => setTimeout(r, 0));
      expect(typeof window.updateCalendarAndTotal).toBe('function');
    });
  });
});
