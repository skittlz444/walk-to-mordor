import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  events,
  currentDate,
  currentView,
  loading,
  formatDate,
  parseDate,
  isToday,
  getDateAtMidnight,
  getEventForDate,
  fetchEvents,
  navigateCalendar,
  goToToday,
  setView,
} from './calendarStore';

const mockFetch = vi.fn();

beforeEach(() => {
  events.value = [];
  currentDate.value = new Date(2025, 5, 15); // June 15, 2025
  currentView.value = 'week';
  loading.value = false;
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
  // Provide getAuthHeaders
  vi.stubGlobal('getAuthHeaders', () => ({ Authorization: 'Bearer test' }));
});

describe('calendarStore', () => {
  describe('formatDate', () => {
    it('formats a date as YYYY-MM-DD', () => {
      expect(formatDate(new Date(2025, 0, 5))).toBe('2025-01-05');
      expect(formatDate(new Date(2025, 11, 25))).toBe('2025-12-25');
    });
  });

  describe('parseDate', () => {
    it('parses YYYY-MM-DD string to Date', () => {
      const d = parseDate('2025-06-15');
      expect(d.getFullYear()).toBe(2025);
      expect(d.getMonth()).toBe(5);
      expect(d.getDate()).toBe(15);
    });
  });

  describe('isToday', () => {
    it('returns true for today', () => {
      expect(isToday(new Date())).toBe(true);
    });

    it('returns false for other dates', () => {
      expect(isToday(new Date(2000, 0, 1))).toBe(false);
    });
  });

  describe('getDateAtMidnight', () => {
    it('sets time to 00:00:00.000', () => {
      const d = getDateAtMidnight(new Date(2025, 5, 15, 14, 30, 45));
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
      expect(d.getSeconds()).toBe(0);
      expect(d.getMilliseconds()).toBe(0);
    });
  });

  describe('getEventForDate', () => {
    it('returns matching event', () => {
      events.value = [{ start: '2025-06-15', title: '5 km' }];
      const result = getEventForDate(new Date(2025, 5, 15));
      expect(result).toEqual({ start: '2025-06-15', title: '5 km' });
    });

    it('returns undefined when no match', () => {
      events.value = [{ start: '2025-06-15', title: '5 km' }];
      expect(getEventForDate(new Date(2025, 5, 16))).toBeUndefined();
    });
  });

  describe('fetchEvents', () => {
    it('fetches events and updates signal', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve([{ start: '2025-06-15', title: '5' }]),
      });

      await fetchEvents();

      expect(events.value).toEqual([{ start: '2025-06-15', title: '5 km' }]);
      expect(loading.value).toBe(false);
    });

    it('appends km to title', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve([{ start: '2025-06-15', title: '10.5' }]),
      });

      await fetchEvents();
      expect(events.value[0].title).toBe('10.5 km');
    });

    it('handles empty title', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve([{ start: '2025-06-15', title: '' }]),
      });

      await fetchEvents();
      expect(events.value[0].title).toBe('');
    });

    it('sets loading during fetch', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(
        promise.then(() => ({
          json: () => Promise.resolve([]),
        })),
      );

      const fetchPromise = fetchEvents();
      expect(loading.value).toBe(true);

      resolvePromise!(undefined);
      await fetchPromise;
      expect(loading.value).toBe(false);
    });

    it('handles fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await fetchEvents();

      expect(loading.value).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('navigateCalendar', () => {
    it('moves forward by a week in week view', () => {
      currentView.value = 'week';
      currentDate.value = new Date(2025, 5, 15);
      navigateCalendar(1);
      expect(currentDate.value.getDate()).toBe(22);
    });

    it('moves backward by a week in week view', () => {
      currentView.value = 'week';
      currentDate.value = new Date(2025, 5, 15);
      navigateCalendar(-1);
      expect(currentDate.value.getDate()).toBe(8);
    });

    it('moves forward by a month in month view', () => {
      currentView.value = 'month';
      currentDate.value = new Date(2025, 5, 15);
      navigateCalendar(1);
      expect(currentDate.value.getMonth()).toBe(6);
    });

    it('moves backward by a month in month view', () => {
      currentView.value = 'month';
      currentDate.value = new Date(2025, 5, 15);
      navigateCalendar(-1);
      expect(currentDate.value.getMonth()).toBe(4);
    });
  });

  describe('goToToday', () => {
    it('resets currentDate to today', () => {
      currentDate.value = new Date(2000, 0, 1);
      goToToday();
      const today = new Date();
      expect(currentDate.value.getFullYear()).toBe(today.getFullYear());
      expect(currentDate.value.getMonth()).toBe(today.getMonth());
      expect(currentDate.value.getDate()).toBe(today.getDate());
    });
  });

  describe('setView', () => {
    it('switches to month view', () => {
      currentView.value = 'week';
      setView('month');
      expect(currentView.value).toBe('month');
    });

    it('switches to week view', () => {
      currentView.value = 'month';
      setView('week');
      expect(currentView.value).toBe('week');
    });
  });
});
