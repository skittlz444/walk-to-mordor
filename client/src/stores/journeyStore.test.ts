import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  goals,
  currentDistance,
  loading,
  error,
  showFutureGoalsUnlocked,
  completedGoals,
  upcomingGoals,
  nextGoal,
  lastCompleted,
  fetchGoals,
  checkForNewlyPassedGoals,
  syncPreference,
} from './journeyStore';
import type { Goal } from '../types/goal';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const sampleGoals: Goal[] = [
  { id: 1, distance: 10, title: 'Bag End' },
  { id: 2, distance: 20, title: 'Bucklebury Ferry', special: 'Milestone' },
  { id: 3, distance: 30, title: 'Bree' },
  { id: 4, distance: 50, title: 'Weathertop' },
  { id: 5, distance: 100, title: 'Rivendell', special: 'Major Milestone' },
];

describe('journeyStore', () => {
  beforeEach(() => {
    // Reset all signals
    goals.value = [];
    currentDistance.value = 0;
    loading.value = false;
    error.value = null;
    showFutureGoalsUnlocked.value = true;
    mockFetch.mockReset();

    // Setup window globals
    window.getAuthHeaders = vi.fn(() => ({ Authorization: 'Bearer test' }));
    window.userPreferences = undefined;
  });

  describe('computed signals', () => {
    it('completedGoals filters by currentDistance', () => {
      goals.value = sampleGoals;
      currentDistance.value = 25;

      expect(completedGoals.value).toHaveLength(2);
      expect(completedGoals.value.map((g) => g.id)).toEqual([1, 2]);
    });

    it('upcomingGoals filters goals above currentDistance', () => {
      goals.value = sampleGoals;
      currentDistance.value = 25;

      expect(upcomingGoals.value).toHaveLength(3);
      expect(upcomingGoals.value[0].title).toBe('Bree');
    });

    it('nextGoal returns first upcoming goal', () => {
      goals.value = sampleGoals;
      currentDistance.value = 25;

      expect(nextGoal.value).not.toBeNull();
      expect(nextGoal.value!.title).toBe('Bree');
    });

    it('nextGoal returns null when all goals completed', () => {
      goals.value = sampleGoals;
      currentDistance.value = 200;

      expect(nextGoal.value).toBeNull();
    });

    it('lastCompleted returns last 3 completed goals', () => {
      goals.value = sampleGoals;
      currentDistance.value = 60;

      // Completed: Bag End, Bucklebury Ferry, Bree, Weathertop (4 goals)
      expect(lastCompleted.value).toHaveLength(3);
      expect(lastCompleted.value.map((g) => g.id)).toEqual([2, 3, 4]);
    });

    it('lastCompleted returns all when fewer than 3 completed', () => {
      goals.value = sampleGoals;
      currentDistance.value = 15;

      expect(lastCompleted.value).toHaveLength(1);
      expect(lastCompleted.value[0].title).toBe('Bag End');
    });
  });

  describe('fetchGoals', () => {
    it('fetches and sorts goals on success', async () => {
      const unsorted = [sampleGoals[2], sampleGoals[0], sampleGoals[1]];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => unsorted,
      });

      await fetchGoals(25);

      expect(loading.value).toBe(false);
      expect(error.value).toBeNull();
      expect(goals.value).toHaveLength(3);
      expect(goals.value[0].distance).toBe(10);
      expect(goals.value[1].distance).toBe(20);
      expect(goals.value[2].distance).toBe(30);
      expect(currentDistance.value).toBe(25);
    });

    it('sets error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await fetchGoals(25);

      expect(loading.value).toBe(false);
      expect(error.value).toContain('500');
    });

    it('sets error on invalid data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ not: 'an array' }),
      });

      await fetchGoals(25);

      expect(error.value).toContain('expected array');
    });

    it('sets error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

      await fetchGoals(25);

      expect(error.value).toBe('fetch failed');
    });

    it('calls getAuthHeaders for fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await fetchGoals(10);

      expect(window.getAuthHeaders).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith('/api/goals', {
        headers: { Authorization: 'Bearer test' },
      });
    });
  });

  describe('checkForNewlyPassedGoals', () => {
    it('returns highest newly passed goal', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleGoals,
      });

      const result = await checkForNewlyPassedGoals(15, 35);

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Bree');
    });

    it('returns null when no goals passed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleGoals,
      });

      const result = await checkForNewlyPassedGoals(5, 9);

      expect(result).toBeNull();
    });

    it('returns null on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'));

      const result = await checkForNewlyPassedGoals(5, 35);

      expect(result).toBeNull();
    });
  });

  describe('syncPreference', () => {
    it('reads from window.userPreferences', () => {
      window.userPreferences = { showFutureGoalsUnlocked: false };
      syncPreference();
      expect(showFutureGoalsUnlocked.value).toBe(false);
    });

    it('defaults to true when no preference set', () => {
      showFutureGoalsUnlocked.value = true;
      window.userPreferences = undefined;
      syncPreference();
      expect(showFutureGoalsUnlocked.value).toBe(true);
    });
  });
});
