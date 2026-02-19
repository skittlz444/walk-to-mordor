/**
 * Goal Unlock Check Unit Tests
 *
 * @see Story 2.8 - Map Walk Logging
 */

import { describe, it, expect } from 'vitest';
import { checkNewlyUnlockedGoals } from './goal-unlock-check';
import type { Milestone } from '../types/map';

// Helper to create test milestones
function createMilestone(id: number, distance: number, title: string): Milestone {
  return {
    id,
    distance,
    title,
    x: 0,
    y: 0,
  };
}

describe('checkNewlyUnlockedGoals', () => {
  const milestones: Milestone[] = [
    createMilestone(1, 10, 'First Step'),
    createMilestone(2, 25, 'Getting Going'),
    createMilestone(3, 50, 'Halfway Point'),
    createMilestone(4, 75, 'Almost There'),
    createMilestone(5, 100, 'The End'),
  ];

  describe('when no new milestones are unlocked', () => {
    it('returns empty array when progress decreases', () => {
      const result = checkNewlyUnlockedGoals(50, 40, milestones);
      expect(result).toEqual([]);
    });

    it('returns empty array when progress stays the same', () => {
      const result = checkNewlyUnlockedGoals(50, 50, milestones);
      expect(result).toEqual([]);
    });

    it('returns empty array when progress increases but crosses no thresholds', () => {
      const result = checkNewlyUnlockedGoals(26, 30, milestones);
      expect(result).toEqual([]);
    });

    it('returns empty array when already past all milestones', () => {
      const result = checkNewlyUnlockedGoals(100, 150, milestones);
      expect(result).toEqual([]);
    });

    it('returns empty array with empty milestones list', () => {
      const result = checkNewlyUnlockedGoals(0, 50, []);
      expect(result).toEqual([]);
    });
  });

  describe('when milestones are unlocked', () => {
    it('returns single milestone when crossing one threshold', () => {
      const result = checkNewlyUnlockedGoals(20, 30, milestones);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({ id: 2, distance: 25 }));
    });

    it('returns only the furthest milestone when crossing multiple thresholds', () => {
      const result = checkNewlyUnlockedGoals(20, 60, milestones);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({ id: 3, distance: 50 }));
    });

    it('includes milestone when progress exactly equals milestone distance', () => {
      const result = checkNewlyUnlockedGoals(49, 50, milestones);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({ id: 3, distance: 50 }));
    });

    it('excludes milestone when old progress equals milestone distance', () => {
      const result = checkNewlyUnlockedGoals(50, 60, milestones);
      expect(result).toHaveLength(0);
    });

    it('returns only the furthest milestone when starting from zero', () => {
      const result = checkNewlyUnlockedGoals(0, 100, milestones);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({ id: 5, distance: 100 }));
    });
  });

  describe('furthest milestone selection', () => {
    it('returns the furthest milestone regardless of list order', () => {
      // Milestones in reverse order
      const unorderedMilestones: Milestone[] = [
        createMilestone(5, 100, 'Fifth'),
        createMilestone(1, 10, 'First'),
        createMilestone(3, 50, 'Third'),
        createMilestone(2, 25, 'Second'),
        createMilestone(4, 75, 'Fourth'),
      ];

      const result = checkNewlyUnlockedGoals(0, 100, unorderedMilestones);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({ id: 5, distance: 100 }));
    });

    it('returns furthest milestone from subset of unlocked milestones', () => {
      const unorderedMilestones: Milestone[] = [
        createMilestone(5, 100, 'Fifth'),
        createMilestone(3, 50, 'Third'),
        createMilestone(2, 25, 'Second'),
      ];

      const result = checkNewlyUnlockedGoals(20, 60, unorderedMilestones);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({ id: 3, distance: 50 }));
    });
  });

  describe('edge cases', () => {
    it('handles milestones with same distance by returning one', () => {
      const sameDistanceMilestones: Milestone[] = [
        createMilestone(1, 50, 'First at 50'),
        createMilestone(2, 50, 'Second at 50'),
      ];

      const result = checkNewlyUnlockedGoals(40, 60, sameDistanceMilestones);
      expect(result).toHaveLength(1);
      expect(result[0].distance).toBe(50);
    });

    it('handles very small progress increments', () => {
      const result = checkNewlyUnlockedGoals(9.99, 10.01, milestones);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({ id: 1, distance: 10 }));
    });

    it('handles negative progress values gracefully', () => {
      const result = checkNewlyUnlockedGoals(-10, 15, milestones);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({ id: 1, distance: 10 }));
    });
  });
});
