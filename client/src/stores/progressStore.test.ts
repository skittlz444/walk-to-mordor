import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isModalOpen,
  currentEvent,
  currentDate,
  totalDistance,
  showDistanceModal,
  closeModal,
  saveDistance,
  deleteDistance,
  fetchTotalDistance,
  setOnWalkSaved,
  setOnDismiss,
} from './progressStore';

// Mock fetch globally
const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('getAuthHeaders', () => ({ Authorization: 'Bearer test' }));

  // Reset signals
  isModalOpen.value = false;
  currentEvent.value = null;
  currentDate.value = null;
  totalDistance.value = 0;

  // Reset window modules
  window.updateCalendarAndTotal = undefined;
  window.calendarModule = undefined;
  window.goalsModule = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('progressStore', () => {
  describe('showDistanceModal', () => {
    it('opens modal with event and date', () => {
      const event = { start: '2026-01-15', title: '5 km' };
      const date = new Date(2026, 0, 15);

      showDistanceModal(event, date);

      expect(isModalOpen.value).toBe(true);
      expect(currentEvent.value).toEqual(event);
      expect(currentDate.value).toEqual(date);
    });

    it('opens modal for new entry when event is null', () => {
      const date = new Date(2026, 0, 15);

      showDistanceModal(null, date);

      expect(isModalOpen.value).toBe(true);
      expect(currentEvent.value).toBeNull();
      expect(currentDate.value).toEqual(date);
    });

    it('opens modal for new entry when event is undefined', () => {
      const date = new Date(2026, 0, 15);

      showDistanceModal(undefined, date);

      expect(isModalOpen.value).toBe(true);
      expect(currentEvent.value).toBeNull();
    });
  });

  describe('closeModal', () => {
    it('closes modal and resets state', () => {
      isModalOpen.value = true;
      currentEvent.value = { start: '2026-01-15', title: '5 km' };
      currentDate.value = new Date(2026, 0, 15);

      closeModal(false);

      expect(isModalOpen.value).toBe(false);
      expect(currentEvent.value).toBeNull();
      expect(currentDate.value).toBeNull();
    });

    it('calls dismiss callback when wasDismissed is true', () => {
      const dismissCb = vi.fn();
      setOnDismiss(dismissCb);
      isModalOpen.value = true;

      closeModal(true);

      expect(dismissCb).toHaveBeenCalledTimes(1);
    });

    it('does not call dismiss callback when wasDismissed is false', () => {
      const dismissCb = vi.fn();
      setOnDismiss(dismissCb);
      isModalOpen.value = true;

      closeModal(false);

      expect(dismissCb).not.toHaveBeenCalled();
    });
  });

  describe('saveDistance', () => {
    it('posts new distance and closes modal', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const savedCb = vi.fn();
      setOnWalkSaved(savedCb);
      window.calendarModule = {
        events: () => [],
        setEvents: vi.fn(),
        formatDate: (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      };

      showDistanceModal(null, new Date(2026, 0, 15));
      await saveDistance(3.5);

      expect(mockFetch).toHaveBeenCalledWith('/api/calendar-progress', {
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ start: '2026-01-15', title: '3.5' }),
      });
      expect(savedCb).toHaveBeenCalledWith({
        action: 'save',
        date: '2026-01-15',
        distance: 3.5,
      });
      expect(isModalOpen.value).toBe(false);
    });

    it('puts updated distance for edits', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const event = { start: '2026-01-15', title: '5' };
      window.calendarModule = {
        events: () => [event],
        setEvents: vi.fn(),
        formatDate: (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      };

      showDistanceModal(event, new Date(2026, 0, 15));
      await saveDistance(10);

      expect(mockFetch).toHaveBeenCalledWith('/api/calendar-progress', {
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ start: '2026-01-15', title: '10' }),
      });
    });

    it('calls updateCalendarAndTotal after save', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const updateFn = vi.fn();
      window.updateCalendarAndTotal = updateFn;
      window.calendarModule = {
        events: () => [],
        setEvents: vi.fn(),
        formatDate: (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      };

      showDistanceModal(null, new Date(2026, 0, 15));
      await saveDistance(5);

      expect(updateFn).toHaveBeenCalled();
    });

    it('does nothing when no date is set', async () => {
      await saveDistance(5);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('deleteDistance', () => {
    it('sends DELETE request and closes modal', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const savedCb = vi.fn();
      setOnWalkSaved(savedCb);
      window.calendarModule = {
        events: () => [{ start: '2026-01-15', title: '5' }],
        setEvents: vi.fn(),
        formatDate: (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      };

      const event = { start: '2026-01-15', title: '5' };
      showDistanceModal(event, new Date(2026, 0, 15));
      await deleteDistance();

      expect(mockFetch).toHaveBeenCalledWith('/api/calendar-progress', {
        method: 'DELETE',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ start: '2026-01-15' }),
      });
      expect(savedCb).toHaveBeenCalledWith({
        action: 'delete',
        date: '2026-01-15',
      });
      expect(isModalOpen.value).toBe(false);
    });

    it('does nothing when no date is set', async () => {
      await deleteDistance();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('fetchTotalDistance', () => {
    it('fetches and updates total distance', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ totalDistance: 42.5 }),
      });

      const el = document.createElement('div');
      el.id = 'total-distance-value';
      document.body.appendChild(el);

      await fetchTotalDistance();

      expect(totalDistance.value).toBe(42.5);
      expect(el.textContent).toBe('42.5 km');

      document.body.removeChild(el);
    });

    it('sets 0 km on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const el = document.createElement('div');
      el.id = 'total-distance-value';
      document.body.appendChild(el);

      await fetchTotalDistance();

      expect(el.textContent).toBe('0 km');

      document.body.removeChild(el);
    });

    it('calls goalsModule.renderGoals with total distance', async () => {
      const renderGoals = vi.fn();
      window.goalsModule = {
        renderGoals,
        showGoalModal: vi.fn(),
        checkForNewlyPassedGoals: vi.fn(),
        makeGoalClickable: vi.fn(),
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ totalDistance: 25 }),
      });

      await fetchTotalDistance();

      expect(renderGoals).toHaveBeenCalledWith(25);
    });

    it('sets 0 km on non-401 error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const el = document.createElement('div');
      el.id = 'total-distance-value';
      document.body.appendChild(el);

      await fetchTotalDistance();

      expect(el.textContent).toBe('0 km');

      document.body.removeChild(el);
    });
  });

  describe('callbacks', () => {
    it('setOnWalkSaved registers callback', async () => {
      const cb = vi.fn();
      setOnWalkSaved(cb);
      mockFetch.mockResolvedValue({ ok: true });
      window.calendarModule = {
        events: () => [],
        setEvents: vi.fn(),
        formatDate: (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      };

      showDistanceModal(null, new Date(2026, 0, 15));
      await saveDistance(1);

      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'save' })
      );
    });

    it('setOnDismiss registers callback', () => {
      const cb = vi.fn();
      setOnDismiss(cb);
      isModalOpen.value = true;

      closeModal(true);

      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});
