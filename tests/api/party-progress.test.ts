import {
  handlePartyProgress,
  handlePartyActivity,
} from '../../src/party-handlers';
import { syncPartyProgressLog } from '../../src/progress-handlers';
import { validateSession } from '../../src/auth-handlers';
import { calculateTotalDistance } from '../../src/goals-handlers';

// Mock dependencies
jest.mock('../../src/auth-handlers');
jest.mock('../../src/goals-handlers');

describe('Party Progress API (Story 3.4)', () => {
  let mockEnv: { DB: Record<string, jest.Mock> };
  let mockRequest: { headers: { get: jest.Mock } };

  // Reusable chainable mock builder
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
    (calculateTotalDistance as jest.Mock).mockResolvedValue(42.5);

    mockEnv = {
      DB: {
        prepare: jest.fn(() => createChainableMock()),
        batch: jest.fn().mockResolvedValue([]),
      },
    };

    mockRequest = {
      headers: { get: jest.fn() },
    };
  });

  // ─── handlePartyProgress ────────────────────────────────────────────

  describe('handlePartyProgress', () => {
    it('should return 401 if session is invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      });

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(401);
    });

    it('should return 404 if party not found', async () => {
      // party lookup returns null
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 999);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Party not found');
    });

    it('should return 404 if party is dissolved', async () => {
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'incremental',
          leave_distance_behavior: 'keep',
          dissolved_at: '2026-01-01T00:00:00Z',
        }),
      }));

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(404);
    });

    it('should return 403 if user is not an active member', async () => {
      // Party exists
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'incremental',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check returns null
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('You are not an active member of this party');
    });

    it('should return progress in incremental mode', async () => {
      // Party lookup
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'incremental',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check (requesting user is active)
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members query
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 10, total_distance: 30 },
            { user_id: 2, display_name: 'Bob', distance_at_join: 5, total_distance: 20 },
          ],
        }),
      }));
      // Departed members query
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Milestone position
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 5, title: 'Rivendell', distance: 30 }),
      }));
      // Newly passed milestones
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { id: 3, title: 'Crickhollow', distance: 10 },
            { id: 5, title: 'Rivendell', distance: 30 },
          ],
        }),
      }));
      // Update last_viewed_distance
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(200);
      const data = await response.json();

      // Incremental: (30-10) + (20-5) = 20 + 15 = 35
      expect(data.total_distance).toBe(35);
      expect(data.member_count).toBe(2);
      expect(data.distance_mode).toBe('incremental');
      expect(data.leave_distance_behavior).toBe('keep');
      expect(data.calculated_position).toEqual({ id: 5, title: 'Rivendell', distance: 30 });
      expect(data.members).toHaveLength(2);
      expect(data.members[0]).toEqual({
        user_id: 1,
        display_name: 'Alice',
        contribution: 20,
        status: 'active',
        color: 1 % 12,
      });
      expect(data.members[1]).toEqual({
        user_id: 2,
        display_name: 'Bob',
        contribution: 15,
        status: 'active',
        color: 2 % 12,
      });
      expect(data.newly_passed_milestones).toHaveLength(2);
    });

    it('should return progress in cumulative mode', async () => {
      // Party lookup
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 10, total_distance: 30 },
            { user_id: 2, display_name: 'Bob', distance_at_join: 5, total_distance: 20 },
          ],
        }),
      }));
      // Departed members
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Milestone
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Newly passed milestones
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Update last_viewed_distance
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(200);
      const data = await response.json();

      // Cumulative: 30 + 20 = 50
      expect(data.total_distance).toBe(50);
      expect(data.distance_mode).toBe('cumulative');
      expect(data.members[0].contribution).toBe(30);
      expect(data.members[1].contribution).toBe(20);
    });

    it('should include departed members with distance_kept = 1', async () => {
      // Party lookup
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'incremental',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 0, total_distance: 20 },
          ],
        }),
      }));
      // Departed members with kept contributions
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 3, display_name: 'Charlie', status: 'left', contribution_at_departure: 15 },
            { user_id: 4, display_name: 'Diana', status: 'kicked', contribution_at_departure: 8 },
          ],
        }),
      }));
      // Milestone
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Newly passed milestones
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Update last_viewed_distance
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(200);
      const data = await response.json();

      // Incremental: Alice (20-0)=20, Charlie kept 15, Diana kept 8 => 43
      expect(data.total_distance).toBe(43);
      // member_count only counts active members
      expect(data.member_count).toBe(1);
      // All 3 members in breakdown
      expect(data.members).toHaveLength(3);
      expect(data.members[1].status).toBe('left');
      expect(data.members[1].contribution).toBe(15);
      expect(data.members[2].status).toBe('kicked');
      expect(data.members[2].contribution).toBe(8);
    });

    it('should floor contribution at 0 in incremental mode when total < join distance', async () => {
      // Party lookup
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'incremental',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members (total < distance_at_join — edge case)
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 50, total_distance: 30 },
          ],
        }),
      }));
      // Departed members
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Milestone
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Newly passed milestones
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Update last_viewed_distance
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      const data = await response.json();

      expect(data.total_distance).toBe(0);
      expect(data.members[0].contribution).toBe(0);
    });

    it('should compute member color deterministically as user_id % 12', async () => {
      // Party lookup
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members with various user_ids
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 0, display_name: 'U0', distance_at_join: 0, total_distance: 10 },
            { user_id: 11, display_name: 'U11', distance_at_join: 0, total_distance: 10 },
            { user_id: 12, display_name: 'U12', distance_at_join: 0, total_distance: 10 },
            { user_id: 25, display_name: 'U25', distance_at_join: 0, total_distance: 10 },
          ],
        }),
      }));
      // Departed members
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Milestone
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(null) }));
      // Newly passed milestones
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Update last_viewed_distance
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      const data = await response.json();

      expect(data.members[0].color).toBe(0);   // 0 % 12 = 0
      expect(data.members[1].color).toBe(11);  // 11 % 12 = 11
      expect(data.members[2].color).toBe(0);   // 12 % 12 = 0
      expect(data.members[3].color).toBe(1);   // 25 % 12 = 1
    });

    it('should return newly_passed_milestones between previous and current distance', async () => {
      // Party lookup
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership — previously viewed at 50km
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 50 }),
      }));
      // Active members with 100km total
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 0, total_distance: 100 },
          ],
        }),
      }));
      // Departed members
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Milestone position
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 8, title: 'Weathertop', distance: 90 }),
      }));
      // Newly passed milestones (between 50 and 100)
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { id: 6, title: 'Ford of Bruinen', distance: 60 },
            { id: 8, title: 'Weathertop', distance: 90 },
          ],
        }),
      }));
      // Update last_viewed_distance
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      const data = await response.json();

      expect(data.newly_passed_milestones).toEqual([
        { id: 6, title: 'Ford of Bruinen', distance: 60 },
        { id: 8, title: 'Weathertop', distance: 90 },
      ]);
    });

    it('should update last_viewed_distance on each call', async () => {
      // Party lookup
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 0, total_distance: 75 },
          ],
        }),
      }));
      // Departed members
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Milestone
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(null) }));
      // Newly passed milestones
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Update last_viewed_distance
      const mockRun = jest.fn().mockResolvedValue({ meta: { changes: 1 } });
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({ run: mockRun }));

      await handlePartyProgress(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);

      const updatePrepareCall = mockEnv.DB.prepare.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' &&
          sql.includes('UPDATE party_members SET last_viewed_distance'),
      );
      expect(updatePrepareCall).toBeDefined();
    });

    it('should return 500 on database error', async () => {
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(500);
    });
  });

  // ─── handlePartyActivity ───────────────────────────────────────────

  describe('handlePartyActivity', () => {
    it('should return 401 if session is invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      });

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(401);
    });

    it('should return 404 if party not found', async () => {
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 999);
      expect(response.status).toBe(404);
    });

    it('should return 404 if party is dissolved', async () => {
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: '2026-01-01T00:00:00Z' }),
      }));

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(404);
    });

    it('should return 403 if user is not an active member', async () => {
      // Party exists
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check returns null
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(403);
    });

    it('should return activity entries for active members', async () => {
      // Party exists
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));
      // Activity query
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance: 5.5, date: '2026-02-28', logged_at: '2026-02-28T10:00:00Z' },
            { user_id: 2, display_name: 'Bob', distance: 3.2, date: '2026-02-27', logged_at: '2026-02-27T08:00:00Z' },
          ],
        }),
      }));

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.activities).toHaveLength(2);
      expect(data.activities[0]).toEqual({
        user_id: 1,
        display_name: 'Alice',
        distance: 5.5,
        date: '2026-02-28',
        logged_at: '2026-02-28T10:00:00Z',
      });
    });

    it('should only return activity entries from active members', async () => {
      // Party exists
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));
      // Activity query — only active member entries returned (query filters via JOIN)
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            {
              user_id: 1,
              display_name: 'Alice',
              distance: 5.5,
              date: '2026-02-28',
              logged_at: '2026-02-28T10:00:00Z',
            },
          ],
        }),
      }));

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(200);
      const data = await response.json();

      // Only active member entries are returned (departed filtered by query)
      expect(data.activities).toHaveLength(1);
      expect(data.activities[0].user_id).toBe(1);

      // Verify the query includes the active member filter via party_members JOIN
      const activityQueryCall = mockEnv.DB.prepare.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' &&
          sql.includes('party_progress_log') &&
          sql.includes("pm.status = 'active'"),
      );
      expect(activityQueryCall).toBeDefined();
    });

    it('should return empty activities array when no logs exist', async () => {
      // Party exists
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));
      // Activity query — no results
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      const data = await response.json();
      expect(data.activities).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockEnv as unknown as { DB: D1Database }, 1);
      expect(response.status).toBe(500);
    });
  });

  // ─── syncPartyProgressLog ──────────────────────────────────────────

  describe('syncPartyProgressLog', () => {
    it('should insert entries for all active party memberships on insert', async () => {
      const mockBatch = jest.fn().mockResolvedValue([]);
      mockEnv.DB.batch = mockBatch;

      // Active memberships query
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [{ party_id: 10 }, { party_id: 20 }],
        }),
      }));
      // Insert statements — prepare will be called twice
      mockEnv.DB.prepare.mockReturnValue(createChainableMock());

      await syncPartyProgressLog(mockEnv as unknown as { DB: D1Database }, 1, '2026-02-28', 5.5, 'insert');

      expect(mockBatch).toHaveBeenCalledTimes(1);
      // Should batch 2 insert statements (one per party)
      expect(mockBatch.mock.calls[0][0]).toHaveLength(2);
    });

    it('should update entries across all parties on update', async () => {
      const mockRun = jest.fn().mockResolvedValue({ meta: { changes: 2 } });
      // Active memberships query
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [{ party_id: 10 }],
        }),
      }));
      // Update statement
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({ run: mockRun }));

      await syncPartyProgressLog(mockEnv as unknown as { DB: D1Database }, 1, '2026-02-28', 7.0, 'update');

      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    it('should delete entries on delete', async () => {
      const mockRun = jest.fn().mockResolvedValue({ meta: { changes: 1 } });
      // Active memberships query
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [{ party_id: 10 }],
        }),
      }));
      // Delete statement
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({ run: mockRun }));

      await syncPartyProgressLog(mockEnv as unknown as { DB: D1Database }, 1, '2026-02-28', 0, 'delete');

      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when user has no active memberships', async () => {
      mockEnv.DB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));

      await syncPartyProgressLog(mockEnv as unknown as { DB: D1Database }, 1, '2026-02-28', 5.5, 'insert');

      // batch should not be called
      expect(mockEnv.DB.batch).not.toHaveBeenCalled();
    });

    it('should catch and log errors without throwing (graceful degradation)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockEnv.DB.prepare.mockImplementation(() => {
        throw new Error('DB error');
      });

      // Should NOT throw
      await expect(
        syncPartyProgressLog(mockEnv as unknown as { DB: D1Database }, 1, '2026-02-28', 5.5, 'insert')
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error syncing party_progress_log:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
