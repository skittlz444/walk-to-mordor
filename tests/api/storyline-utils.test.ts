import {
  applyStorylineOffset,
  roundDistance,
  getDefaultStoryline,
  listActiveStorylines,
  requireActiveStoryline,
  resolveUserStoryline,
  resolvePartyStoryline,
  listStorylineGoals,
  calculatePartyRawTotalDistance,
} from '../../src/storyline-utils';
import { DbClient } from '../../src/db';

describe('storyline-utils', () => {
  let mockDB: any;
  let mockDb: DbClient;

  beforeEach(() => {
    mockDB = { prepare: jest.fn() };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };
  });

  describe('applyStorylineOffset', () => {
    it('applies positive and negative offsets to raw distance', () => {
      expect(applyStorylineOffset(125.55, 10)).toBe(135.55);
      expect(applyStorylineOffset(125.55, -25.5)).toBe(100.05);
    });

    it('clamps displayed distance at zero', () => {
      expect(applyStorylineOffset(20, -50)).toBe(0);
    });
  });

  describe('roundDistance', () => {
    it('rounds distances to two decimal places', () => {
      expect(roundDistance(1.235)).toBe(1.24);
      expect(roundDistance(1.234)).toBe(1.23);
    });
  });

  const mockStorylineRow = {
    id: 1,
    slug: 'frodo-sam',
    title: 'Frodo & Sam',
    description: null,
    path_key: 'fellowship',
    sort_order: 0,
    is_active: 1,
    admin_only: 0,
  };

  describe('getDefaultStoryline', () => {
    it('returns the canonical frodo-sam storyline when active', async () => {
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(mockStorylineRow)) }),
      });

      const result = await getDefaultStoryline(mockDb);
      expect(result.slug).toBe('frodo-sam');
      expect(result.is_active).toBe(true);
    });

    it('falls back to any active storyline when frodo-sam is inactive', async () => {
      const altRow = { ...mockStorylineRow, id: 2, slug: 'alt' };

      // frodo-sam query returns null
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(null)) }),
      });
      // fallback query returns alt
      mockDB.prepare.mockReturnValueOnce({
        first: jest.fn(() => Promise.resolve(altRow)),
      });

      const result = await getDefaultStoryline(mockDb);
      expect(result.slug).toBe('alt');
    });

    it('throws when no active storylines exist', async () => {
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(null)) }),
      });
      mockDB.prepare.mockReturnValueOnce({
        first: jest.fn(() => Promise.resolve(null)),
      });

      await expect(getDefaultStoryline(mockDb)).rejects.toThrow('No storylines are configured');
    });
  });

  describe('listActiveStorylines', () => {
    it('returns all active storylines', async () => {
      mockDB.prepare.mockReturnValueOnce({
        all: jest.fn(() => Promise.resolve({ results: [mockStorylineRow] })),
      });

      const results = await listActiveStorylines(mockDb);
      expect(results).toHaveLength(1);
      expect(results[0].slug).toBe('frodo-sam');
    });

    it('can include admin-only active storylines for admins', async () => {
      const adminOnlyRow = { ...mockStorylineRow, id: 2, slug: 'draft', admin_only: 1 };
      mockDB.prepare.mockReturnValueOnce({
        all: jest.fn(() => Promise.resolve({ results: [mockStorylineRow, adminOnlyRow] })),
      });

      const results = await listActiveStorylines(mockDb, { includeAdminOnly: true });
      expect(results).toHaveLength(2);
      expect(results[1].admin_only).toBe(true);
    });
  });

  describe('requireActiveStoryline', () => {
    it('returns storyline when found and active', async () => {
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(mockStorylineRow)) }),
      });

      const result = await requireActiveStoryline(mockDb, 1);
      expect(result.id).toBe(1);
    });

    it('can return an admin-only storyline when explicitly allowed', async () => {
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve({ ...mockStorylineRow, admin_only: 1 })) }),
      });

      const result = await requireActiveStoryline(mockDb, 1, { includeAdminOnly: true });
      expect(result.admin_only).toBe(true);
    });

    it('throws when storyline not found', async () => {
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(null)) }),
      });

      await expect(requireActiveStoryline(mockDb, 99)).rejects.toThrow('Storyline not found');
    });
  });

  describe('resolveUserStoryline', () => {
    it('returns active user storyline with correct offset', async () => {
      const contextRow = { ...mockStorylineRow, storyline_distance_offset: 5.5 };
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(contextRow)) }),
      });

      const result = await resolveUserStoryline(mockDb, 1);
      expect(result.storyline.id).toBe(1);
      expect(result.distanceOffset).toBe(5.5);
    });

    it('resets offset to 0 when falling back to default (deactivated storyline)', async () => {
      // No active storyline for user (LEFT JOIN returns row with no storyline fields)
      const noStorylineRow = { id: null, storyline_distance_offset: 10.0 };
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(noStorylineRow)) }),
      });
      // getDefaultStoryline call (frodo-sam)
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(mockStorylineRow)) }),
      });

      const result = await resolveUserStoryline(mockDb, 1);
      expect(result.distanceOffset).toBe(0); // stale offset not carried over
      expect(result.storyline.slug).toBe('frodo-sam');
    });
  });

  describe('resolvePartyStoryline', () => {
    it('returns active party storyline with correct offset', async () => {
      const contextRow = { ...mockStorylineRow, storyline_distance_offset: 3.0 };
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(contextRow)) }),
      });

      const result = await resolvePartyStoryline(mockDb, 10);
      expect(result.storyline.id).toBe(1);
      expect(result.distanceOffset).toBe(3.0);
    });

    it('resets offset to 0 when party storyline is deactivated', async () => {
      const noStorylineRow = { id: null, storyline_distance_offset: 8.0 };
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(noStorylineRow)) }),
      });
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ first: jest.fn(() => Promise.resolve(mockStorylineRow)) }),
      });

      const result = await resolvePartyStoryline(mockDb, 10);
      expect(result.distanceOffset).toBe(0);
    });
  });

  describe('listStorylineGoals', () => {
    it('returns goals for a storyline', async () => {
      const mockGoals = [
        { storyline_goal_id: 10, id: 1, title: 'Rivendell', distance: 458, description: null, image_id: null, special: null, sort_order: 1 },
      ];
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ all: jest.fn(() => Promise.resolve({ results: mockGoals })) }),
      });

      const results = await listStorylineGoals(mockDb, 1);
      expect(results).toHaveLength(1);
      expect(results[0].storyline_goal_id).toBe(10);
    });
  });

  describe('calculatePartyRawTotalDistance', () => {
    it('sums active member distances in cumulative mode', async () => {
      const rows = [
        { distance_at_join: 0, total_distance: 50, status: 'active', contribution_at_departure: null },
        { distance_at_join: 0, total_distance: 30, status: 'active', contribution_at_departure: null },
      ];
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ all: jest.fn(() => Promise.resolve({ results: rows })) }),
      });

      const result = await calculatePartyRawTotalDistance(mockDb, 1, 'cumulative');
      expect(result).toBe(80);
    });

    it('uses contribution_at_departure for departed members', async () => {
      const rows = [
        { distance_at_join: 10, total_distance: 60, status: 'active', contribution_at_departure: null },
        { distance_at_join: 5, total_distance: 40, status: 'left', contribution_at_departure: 20 },
      ];
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ all: jest.fn(() => Promise.resolve({ results: rows })) }),
      });

      const result = await calculatePartyRawTotalDistance(mockDb, 1, 'cumulative');
      expect(result).toBe(80); // 60 + 20
    });

    it('uses incremental distance calculation when mode is incremental', async () => {
      const rows = [
        { distance_at_join: 10, total_distance: 60, status: 'active', contribution_at_departure: null },
      ];
      mockDB.prepare.mockReturnValueOnce({
        bind: jest.fn().mockReturnValue({ all: jest.fn(() => Promise.resolve({ results: rows })) }),
      });

      const result = await calculatePartyRawTotalDistance(mockDb, 1, 'incremental');
      expect(result).toBe(50); // 60 - 10
    });
  });
});

