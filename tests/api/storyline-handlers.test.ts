import {
  handleGetStorylines,
  handleSetActiveStoryline,
  handleSetPartyStoryline,
} from '../../src/storyline-handlers';
import { validateSession } from '../../src/auth-handlers';
import { DbClient } from '../../src/db';

jest.mock('../../src/auth-handlers');

describe('Storyline handlers (multi-storyline foundation)', () => {
  let mockDB: Record<string, jest.Mock>;
  let mockDb: DbClient;
  let mockRequest: { headers: { get: jest.Mock }; url: string };

  function createChainableMock(overrides?: {
    first?: jest.Mock;
    all?: jest.Mock;
    run?: jest.Mock;
  }) {
    const first = overrides?.first ?? jest.fn().mockResolvedValue(null);
    const all = overrides?.all ?? jest.fn().mockResolvedValue({ results: [] });
    const run = overrides?.run ?? jest.fn().mockResolvedValue({ meta: { changes: 1 } });
    const bind = jest.fn(() => ({ run, all, first }));
    return { bind, run, all, first };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });

    mockDB = {
      prepare: jest.fn(() => createChainableMock()),
      batch: jest.fn().mockResolvedValue([]),
    };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };

    mockRequest = {
      headers: { get: jest.fn() },
      url: 'https://example.com/api/storylines',
    };
  });

  // ─── GET /api/storylines ───────────────────────────────────────────────

  describe('handleGetStorylines', () => {
    it('returns 401 when session invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response('Unauthorized', { status: 401 }),
      });
      const resp = await handleGetStorylines(mockRequest as unknown as Request, mockDb);
      expect(resp.status).toBe(401);
    });

    it('lists storylines ordered by sort_order', async () => {
      const storylines = [
        { id: 1, slug: 'frodo-to-mount-doom', name: 'Frodo to Mount Doom', description: null, sort_order: 0 },
        { id: 2, slug: 'aragorn', name: "Aragorn's Path", description: null, sort_order: 1 },
      ];
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: storylines }),
      }));

      const resp = await handleGetStorylines(mockRequest as unknown as Request, mockDb);
      expect(resp.status).toBe(200);
      const data = await resp.json() as { storylines: typeof storylines };
      expect(data.storylines).toHaveLength(2);
      expect(data.storylines[0].slug).toBe('frodo-to-mount-doom');
    });

    it('returns 500 on database error', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockRejectedValue(new Error('boom')),
      }));
      const resp = await handleGetStorylines(mockRequest as unknown as Request, mockDb);
      expect(resp.status).toBe(500);
    });
  });

  // ─── PUT /api/user/active-storyline ────────────────────────────────────

  describe('handleSetActiveStoryline', () => {
    it('returns 401 when session invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response('Unauthorized', { status: 401 }),
      });
      const resp = await handleSetActiveStoryline(
        mockRequest as unknown as Request,
        mockDb,
        { storylineSlug: 'x', onSwitch: 'keep' },
      );
      expect(resp.status).toBe(401);
    });

    it('rejects missing storylineSlug', async () => {
      const resp = await handleSetActiveStoryline(
        mockRequest as unknown as Request,
        mockDb,
        { onSwitch: 'keep' } as Record<string, unknown>,
      );
      expect(resp.status).toBe(400);
    });

    it('rejects unknown onSwitch value', async () => {
      const resp = await handleSetActiveStoryline(
        mockRequest as unknown as Request,
        mockDb,
        { storylineSlug: 'a', onSwitch: 'reset' as unknown as string },
      );
      expect(resp.status).toBe(400);
    });

    it('returns 404 when target storyline does not exist', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null), // storyline lookup
      }));
      const resp = await handleSetActiveStoryline(
        mockRequest as unknown as Request,
        mockDb,
        { storylineSlug: 'unknown', onSwitch: 'keep' },
      );
      expect(resp.status).toBe(404);
    });

    it('keep: carries personal distance forward and detects crossed goal thresholds', async () => {
      // Sequence of prepare() calls inside handleSetActiveStoryline (keep, prev != target):
      //  1) SELECT storyline by slug  (target)
      //  2) SELECT users row          (previous storyline + distance)
      //  3) UPDATE user_storyline_history (close previous row)
      //  4) UPDATE users (set new storyline + distance)
      //  5) INSERT user_storyline_history (open new row)
      //  6) SELECT storyline_goals    (thresholds crossed)
      const target = { id: 2, slug: 'pippin', name: 'Pippin' };
      const userRow = { active_storyline_id: 1, active_storyline_distance_km: 412 };
      const crossedGoals = [
        { goal_id: 10, distance: 50, is_challenge_end: 0, title: 'Goal 50', special: null },
        { goal_id: 11, distance: 120, is_challenge_end: 0, title: 'Goal 120', special: null },
        { goal_id: 12, distance: 300, is_challenge_end: 1, title: 'Goal 300', special: 'Challenge End' },
      ];

      mockDB.prepare
        .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(target) }))
        .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(userRow) }))
        .mockReturnValueOnce(createChainableMock())
        .mockReturnValueOnce(createChainableMock())
        .mockReturnValueOnce(createChainableMock())
        .mockReturnValueOnce(createChainableMock({
          all: jest.fn().mockResolvedValue({ results: crossedGoals }),
        }));

      const resp = await handleSetActiveStoryline(
        mockRequest as unknown as Request,
        mockDb,
        { storylineSlug: 'pippin', onSwitch: 'keep' },
      );
      expect(resp.status).toBe(200);
      const data = await resp.json() as {
        carriedOver: boolean;
        distanceKm: number;
        goalsReached: Array<{ goal_id: number; is_challenge_end: boolean }>;
      };
      expect(data.carriedOver).toBe(true);
      expect(data.distanceKm).toBe(412);
      expect(data.goalsReached).toHaveLength(3);
      expect(data.goalsReached[2].is_challenge_end).toBe(true);
    });

    it('discard: resets personal distance to 0 and fires no goal thresholds', async () => {
      const target = { id: 2, slug: 'pippin', name: 'Pippin' };
      const userRow = { active_storyline_id: 1, active_storyline_distance_km: 412 };

      mockDB.prepare
        .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(target) }))
        .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(userRow) }))
        // history close, users update, history insert — all generic
        .mockReturnValueOnce(createChainableMock())
        .mockReturnValueOnce(createChainableMock())
        .mockReturnValueOnce(createChainableMock());

      const resp = await handleSetActiveStoryline(
        mockRequest as unknown as Request,
        mockDb,
        { storylineSlug: 'pippin', onSwitch: 'discard' },
      );
      expect(resp.status).toBe(200);
      const data = await resp.json() as {
        carriedOver: boolean;
        distanceKm: number;
        goalsReached: unknown[];
      };
      expect(data.carriedOver).toBe(false);
      expect(data.distanceKm).toBe(0);
      expect(data.goalsReached).toEqual([]);
    });

    it('is idempotent when user is already on the target storyline', async () => {
      const target = { id: 1, slug: 'frodo', name: 'Frodo' };
      const userRow = { active_storyline_id: 1, active_storyline_distance_km: 200 };

      mockDB.prepare
        .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(target) }))
        .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(userRow) }));

      const resp = await handleSetActiveStoryline(
        mockRequest as unknown as Request,
        mockDb,
        { storylineSlug: 'frodo', onSwitch: 'keep' },
      );
      expect(resp.status).toBe(200);
      const data = await resp.json() as { unchanged?: boolean; distanceKm: number };
      expect(data.unchanged).toBe(true);
      expect(data.distanceKm).toBe(200);
    });
  });

  // ─── PUT /api/party/:id/storyline ──────────────────────────────────────

  describe('handleSetPartyStoryline', () => {
    it('returns 401 when session invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response('Unauthorized', { status: 401 }),
      });
      const resp = await handleSetPartyStoryline(
        mockRequest as unknown as Request,
        mockDb,
        1,
        { storylineSlug: 'x', onSwitch: 'keep' },
      );
      expect(resp.status).toBe(401);
    });

    it('rejects invalid onSwitch value', async () => {
      const resp = await handleSetPartyStoryline(
        mockRequest as unknown as Request,
        mockDb,
        1,
        { storylineSlug: 'x', onSwitch: 'discard' as string },
      );
      expect(resp.status).toBe(400);
    });

    it('returns 404 when party not found', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null), // party lookup
      }));
      const resp = await handleSetPartyStoryline(
        mockRequest as unknown as Request,
        mockDb,
        999,
        { storylineSlug: 'frodo', onSwitch: 'keep' },
      );
      expect(resp.status).toBe(404);
    });

    it('returns 400 when party is dissolved', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: '2024-01-01', storyline_id: 1 }),
      }));
      const resp = await handleSetPartyStoryline(
        mockRequest as unknown as Request,
        mockDb,
        1,
        { storylineSlug: 'frodo', onSwitch: 'keep' },
      );
      expect(resp.status).toBe(400);
    });

    it('returns 403 when caller is not the leader', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 99, dissolved_at: null, storyline_id: 1 }),
      }));
      const resp = await handleSetPartyStoryline(
        mockRequest as unknown as Request,
        mockDb,
        1,
        { storylineSlug: 'frodo', onSwitch: 'keep' },
      );
      expect(resp.status).toBe(403);
    });

    it('keep: switches party storyline without touching log rows', async () => {
      const party = { id: 1, leader_id: 1, dissolved_at: null, storyline_id: 1 };
      const target = { id: 2, slug: 'pippin', name: 'Pippin' };

      const updateRun = jest.fn().mockResolvedValue({ meta: { changes: 1 } });

      mockDB.prepare
        .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(party) }))
        .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(target) }))
        .mockReturnValueOnce(createChainableMock({ run: updateRun }));

      const resp = await handleSetPartyStoryline(
        mockRequest as unknown as Request,
        mockDb,
        1,
        { storylineSlug: 'pippin', onSwitch: 'keep' },
      );
      expect(resp.status).toBe(200);
      const data = await resp.json() as { reset: boolean };
      expect(data.reset).toBe(false);
      // No superseded_at stamp queries were issued
      const sqlsRun = mockDB.prepare.mock.calls.map((c) => c[0] as string);
      expect(sqlsRun.some((s) => s.includes('superseded_at'))).toBe(false);
    });

    it('reset: stamps superseded_at and resets distance_at_join', async () => {
      const party = { id: 1, leader_id: 1, dissolved_at: null, storyline_id: 1 };
      const target = { id: 2, slug: 'pippin', name: 'Pippin' };

      mockDB.prepare
        .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(party) }))
        .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(target) }))
        // UPDATE parties
        .mockReturnValueOnce(createChainableMock())
        // UPDATE party_progress_log superseded_at
        .mockReturnValueOnce(createChainableMock())
        // UPDATE party_members distance_at_join
        .mockReturnValueOnce(createChainableMock());

      const resp = await handleSetPartyStoryline(
        mockRequest as unknown as Request,
        mockDb,
        1,
        { storylineSlug: 'pippin', onSwitch: 'reset' },
      );
      expect(resp.status).toBe(200);
      const data = await resp.json() as { reset: boolean };
      expect(data.reset).toBe(true);
      const sqls = mockDB.prepare.mock.calls.map((c) => c[0] as string);
      expect(sqls.some((s) => s.includes('superseded_at'))).toBe(true);
      expect(sqls.some((s) => s.includes('distance_at_join'))).toBe(true);
    });

    it('is idempotent when party is already on the target storyline', async () => {
      const party = { id: 1, leader_id: 1, dissolved_at: null, storyline_id: 2 };
      const target = { id: 2, slug: 'pippin', name: 'Pippin' };

      mockDB.prepare
        .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(party) }))
        .mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(target) }));

      const resp = await handleSetPartyStoryline(
        mockRequest as unknown as Request,
        mockDb,
        1,
        { storylineSlug: 'pippin', onSwitch: 'reset' },
      );
      expect(resp.status).toBe(200);
      const data = await resp.json() as { unchanged?: boolean; reset: boolean };
      expect(data.unchanged).toBe(true);
      expect(data.reset).toBe(false);
    });
  });
});
