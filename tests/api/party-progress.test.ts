import {
  handlePartyProgress,
  handlePartyActivity,
  handleSendPartyMessage,
} from '../../src/party-handlers';
import { syncPartyProgressLog } from '../../src/progress-handlers';
import { validateSession } from '../../src/auth-handlers';
import { DbClient } from '../../src/db';
import { calculateTotalDistance } from '../../src/goals-handlers';

// Mock dependencies
jest.mock('../../src/auth-handlers');
jest.mock('../../src/goals-handlers');

describe('Party Progress API (Story 3.4)', () => {
  let mockDB: Record<string, jest.Mock>;
  let mockDb: DbClient;
  let mockRequest: { headers: { get: jest.Mock }; url: string };

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

    mockDB = {
      prepare: jest.fn(() => createChainableMock()),
      batch: jest.fn().mockResolvedValue([]),
    };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };

    mockRequest = {
      headers: { get: jest.fn() },
      url: 'https://example.com/api/party/1/activity',
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

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(401);
    });

    it('should return 404 if party not found', async () => {
      // party lookup returns null
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockDb, 999);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Party not found');
    });

    it('should return 404 if party is dissolved', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'incremental',
          leave_distance_behavior: 'keep',
          dissolved_at: '2026-01-01T00:00:00Z',
        }),
      }));

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(404);
    });

    it('should return 403 if user is not an active member', async () => {
      // Party exists
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'incremental',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check returns null
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('You are not an active member of this party');
    });

    it('should return progress in incremental mode', async () => {
      // Party lookup
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'incremental',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check (requesting user is active)
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members query
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 10, total_distance: 30, joined_at: '2026-01-15T00:00:00Z' },
            { user_id: 2, display_name: 'Bob', distance_at_join: 5, total_distance: 20, joined_at: '2026-01-16T00:00:00Z' },
          ],
        }),
      }));
      // Departed members query
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Milestone position
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 5, title: 'Rivendell', distance: 30 }),
      }));
      // Next milestone
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Newly passed milestones
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { id: 3, title: 'Crickhollow', distance: 10 },
            { id: 5, title: 'Rivendell', distance: 30 },
          ],
        }),
      }));
      // Update last_viewed_distance
      mockDB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
      const data = await response.json();

      // Incremental: (30-10) + (20-5) = 20 + 15 = 35
      expect(data.total_distance).toBe(35);
      expect(data.member_count).toBe(2);
      expect(data.distance_mode).toBe('incremental');
      expect(data.leave_distance_behavior).toBe('keep');
      expect(data.calculated_position).toEqual({ id: 5, title: 'Rivendell', distance: 30, description: null, image_id: null, special: null });
      expect(data.user_total_distance).toBe(30);
      expect(data.members).toHaveLength(2);
      expect(data.members[0]).toEqual({
        user_id: 1,
        display_name: 'Alice',
        contribution: 20,
        joined_at: '2026-01-15T00:00:00Z',
        status: 'active',
        color: 1 % 12,
        avatar_id: null,
      });
      expect(data.members[1]).toEqual({
        user_id: 2,
        display_name: 'Bob',
        contribution: 15,
        joined_at: '2026-01-16T00:00:00Z',
        status: 'active',
        color: 2 % 12,
        avatar_id: null,
      });
      expect(data.newly_passed_milestones).toHaveLength(2);
    });

    it('should return progress in cumulative mode', async () => {
      // Party lookup
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 10, total_distance: 30, joined_at: '2026-01-15T00:00:00Z' },
            { user_id: 2, display_name: 'Bob', distance_at_join: 5, total_distance: 20, joined_at: '2026-01-16T00:00:00Z' },
          ],
        }),
      }));
      // Departed members
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Milestone
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Next milestone
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Newly passed milestones
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Update last_viewed_distance
      mockDB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
      const data = await response.json();

      // Cumulative: 30 + 20 = 50
      expect(data.total_distance).toBe(50);
      expect(data.distance_mode).toBe('cumulative');
      expect(data.members[0].contribution).toBe(30);
      expect(data.members[1].contribution).toBe(20);
    });

    it('should return next_position when a goal exists beyond current distance', async () => {
      // Party lookup
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 0, total_distance: 50, joined_at: '2026-01-15T00:00:00Z' },
          ],
        }),
      }));
      // Departed members
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Current milestone position (at 45km)
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 7, title: 'Weathertop', distance: 45, description: 'A great hill', image_id: 'img-7', special: null }),
      }));
      // Next milestone (at 72km)
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 8, title: 'Rivendell', distance: 72, description: 'Last Homely House', image_id: 'img-8', special: 'rivendell' }),
      }));
      // Newly passed milestones
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Update last_viewed_distance
      mockDB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.calculated_position).toEqual({
        id: 7, title: 'Weathertop', distance: 45, description: 'A great hill', image_id: 'img-7', special: null,
      });
      expect(data.next_position).toEqual({
        id: 8, title: 'Rivendell', distance: 72, description: 'Last Homely House', image_id: 'img-8', special: 'rivendell',
      });
      expect(data.user_total_distance).toBe(50);
    });

    it('should include departed members with distance_kept = 1', async () => {
      // Party lookup
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'incremental',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 0, total_distance: 20, joined_at: '2026-01-15T00:00:00Z' },
          ],
        }),
      }));
      // Departed members with kept contributions
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 3, display_name: 'Charlie', status: 'left', contribution_at_departure: 15, joined_at: '2026-01-10T00:00:00Z' },
            { user_id: 4, display_name: 'Diana', status: 'kicked', contribution_at_departure: 8, joined_at: '2026-01-11T00:00:00Z' },
          ],
        }),
      }));
      // Milestone
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Next milestone
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Newly passed milestones
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Update last_viewed_distance
      mockDB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockDb, 1);
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
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'incremental',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members (total < distance_at_join — edge case)
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 50, total_distance: 30, joined_at: '2026-01-15T00:00:00Z' },
          ],
        }),
      }));
      // Departed members
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Milestone
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Next milestone
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Newly passed milestones
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Update last_viewed_distance
      mockDB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockDb, 1);
      const data = await response.json();

      expect(data.total_distance).toBe(0);
      expect(data.members[0].contribution).toBe(0);
    });

    it('should compute member color deterministically as user_id % 12', async () => {
      // Party lookup
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members with various user_ids
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 0, display_name: 'U0', distance_at_join: 0, total_distance: 10, joined_at: '2026-01-15T00:00:00Z' },
            { user_id: 11, display_name: 'U11', distance_at_join: 0, total_distance: 10, joined_at: '2026-01-15T00:00:00Z' },
            { user_id: 12, display_name: 'U12', distance_at_join: 0, total_distance: 10, joined_at: '2026-01-15T00:00:00Z' },
            { user_id: 25, display_name: 'U25', distance_at_join: 0, total_distance: 10, joined_at: '2026-01-15T00:00:00Z' },
          ],
        }),
      }));
      // Departed members
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Milestone
      mockDB.prepare.mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(null) }));
      // Next milestone
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Newly passed milestones
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Update last_viewed_distance
      mockDB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockDb, 1);
      const data = await response.json();

      expect(data.members[0].color).toBe(0);   // 0 % 12 = 0
      expect(data.members[1].color).toBe(11);  // 11 % 12 = 11
      expect(data.members[2].color).toBe(0);   // 12 % 12 = 0
      expect(data.members[3].color).toBe(1);   // 25 % 12 = 1
    });

    it('should return newly_passed_milestones between previous and current distance', async () => {
      // Party lookup
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership — previously viewed at 50km
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 50 }),
      }));
      // Active members with 100km total
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 0, total_distance: 100, joined_at: '2026-01-15T00:00:00Z' },
          ],
        }),
      }));
      // Departed members
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Milestone position
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 8, title: 'Weathertop', distance: 90 }),
      }));
      // Next milestone
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Newly passed milestones (between 50 and 100)
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { id: 6, title: 'Ford of Bruinen', distance: 60 },
            { id: 8, title: 'Weathertop', distance: 90 },
          ],
        }),
      }));
      // Update last_viewed_distance
      mockDB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockDb, 1);
      const data = await response.json();

      expect(data.newly_passed_milestones).toEqual([
        { id: 6, title: 'Ford of Bruinen', distance: 60, description: null, image_id: null, special: null },
        { id: 8, title: 'Weathertop', distance: 90, description: null, image_id: null, special: null },
      ]);
    });

    it('should update last_viewed_distance on each call', async () => {
      // Party lookup
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1,
          distance_mode: 'cumulative',
          leave_distance_behavior: 'keep',
          dissolved_at: null,
        }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, last_viewed_distance: 0 }),
      }));
      // Active members
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance_at_join: 0, total_distance: 75, joined_at: '2026-01-15T00:00:00Z' },
          ],
        }),
      }));
      // Departed members
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Milestone
      mockDB.prepare.mockReturnValueOnce(createChainableMock({ first: jest.fn().mockResolvedValue(null) }));
      // Next milestone
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Newly passed milestones
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));
      // Update last_viewed_distance
      const mockRun = jest.fn().mockResolvedValue({ meta: { changes: 1 } });
      mockDB.prepare.mockReturnValueOnce(createChainableMock({ run: mockRun }));

      await handlePartyProgress(mockRequest as unknown as Request, mockDb, 1);

      const updatePrepareCall = mockDB.prepare.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' &&
          sql.includes('UPDATE party_members SET last_viewed_distance'),
      );
      expect(updatePrepareCall).toBeDefined();
    });

    it('should return 500 on database error', async () => {
      mockDB.prepare.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const response = await handlePartyProgress(mockRequest as unknown as Request, mockDb, 1);
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

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(401);
    });

    it('should return 404 if party not found', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockDb, 999);
      expect(response.status).toBe(404);
    });

    it('should return 404 if party is dissolved', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: '2026-01-01T00:00:00Z' }),
      }));

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(404);
    });

    it('should return 403 if user is not an active member', async () => {
      // Party exists
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check returns null
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(403);
    });

    it('should return activity entries for active members', async () => {
      // Party exists
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));
      // Activity query
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [
            { user_id: 1, display_name: 'Alice', distance: 5.5, date: '2026-02-28', logged_at: '2026-02-28T10:00:00Z' },
            { user_id: 2, display_name: 'Bob', distance: 3.2, date: '2026-02-27', logged_at: '2026-02-27T08:00:00Z' },
          ],
        }),
      }));

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockDb, 1);
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
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));
      // Activity query — only active member entries returned (query filters via JOIN)
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
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

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
      const data = await response.json();

      // Only active member entries are returned (departed filtered by query)
      expect(data.activities).toHaveLength(1);
      expect(data.activities[0].user_id).toBe(1);

      // Verify the query includes the active member filter via party_members JOIN
      const activityQueryCall = mockDB.prepare.mock.calls.find(
        ([sql]: [string]) =>
          typeof sql === 'string' &&
          sql.includes('party_progress_log') &&
          sql.includes("pm.status = 'active'"),
      );
      expect(activityQueryCall).toBeDefined();
    });

    it('should return empty activities array when no logs exist', async () => {
      // Party exists
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));
      // Activity query — no results
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockDb, 1);
      const data = await response.json();
      expect(data.activities).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      mockDB.prepare.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const response = await handlePartyActivity(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(500);
    });
  });

  // ─── syncPartyProgressLog ──────────────────────────────────────────

  describe('syncPartyProgressLog', () => {
    it('should insert entries for all active party memberships on insert', async () => {
      const mockBatch = jest.fn().mockResolvedValue([]);
      mockDB.batch = mockBatch;

      // Active memberships query
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [{ party_id: 10 }, { party_id: 20 }],
        }),
      }));
      // Insert statements — prepare will be called twice
      mockDB.prepare.mockReturnValue(createChainableMock());

      await syncPartyProgressLog(mockDb, 1, '2026-02-28', 5.5, 'insert');

      expect(mockBatch).toHaveBeenCalledTimes(1);
      // Should batch 2 insert statements (one per party)
      expect(mockBatch.mock.calls[0][0]).toHaveLength(2);
    });

    it('should update entries across all parties on update', async () => {
      const mockBatch = jest.fn().mockResolvedValue([]);
      mockDB.batch = mockBatch;
      // Active memberships query
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [{ party_id: 10 }, { party_id: 20 }],
        }),
      }));
      // Update statements — prepare will be called per party
      mockDB.prepare.mockReturnValue(createChainableMock());

      await syncPartyProgressLog(mockDb, 1, '2026-02-28', 7.0, 'update');

      expect(mockBatch).toHaveBeenCalledTimes(1);
      // Should batch 2 update statements (one per party)
      expect(mockBatch.mock.calls[0][0]).toHaveLength(2);
    });

    it('should delete entries on delete', async () => {
      const mockBatch = jest.fn().mockResolvedValue([]);
      mockDB.batch = mockBatch;
      // Active memberships query
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({
          results: [{ party_id: 10 }],
        }),
      }));
      // Delete statement
      mockDB.prepare.mockReturnValue(createChainableMock());

      await syncPartyProgressLog(mockDb, 1, '2026-02-28', 0, 'delete');

      expect(mockBatch).toHaveBeenCalledTimes(1);
      // Should batch 1 delete statement (one party)
      expect(mockBatch.mock.calls[0][0]).toHaveLength(1);
    });

    it('should do nothing when user has no active memberships', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));

      await syncPartyProgressLog(mockDb, 1, '2026-02-28', 5.5, 'insert');

      // batch should not be called
      expect(mockDB.batch).not.toHaveBeenCalled();
    });

    it('should catch and log errors without throwing (graceful degradation)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDB.prepare.mockImplementation(() => {
        throw new Error('DB error');
      });

      // Should NOT throw
      await expect(
        syncPartyProgressLog(mockDb, 1, '2026-02-28', 5.5, 'insert')
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error syncing party_progress_log:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ─── handlePartyActivity filters ──────────────────────────────────

  describe('handlePartyActivity filters', () => {
    it('should accept type=walk filter', async () => {
      const walkRequest = {
        headers: { get: jest.fn() },
        url: 'https://example.com/api/party/1/activity?type=walk',
      };
      // Party exists
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));
      // Walk query
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));

      const response = await handlePartyActivity(walkRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.activities).toEqual([]);
    });

    it('should accept type=message filter', async () => {
      const msgRequest = {
        headers: { get: jest.fn() },
        url: 'https://example.com/api/party/1/activity?type=message',
      };
      // Party exists
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));
      // Message query
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        all: jest.fn().mockResolvedValue({ results: [] }),
      }));

      const response = await handlePartyActivity(msgRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
    });

    it('should return 400 for invalid type filter', async () => {
      const badRequest = {
        headers: { get: jest.fn() },
        url: 'https://example.com/api/party/1/activity?type=invalid',
      };
      // Party exists
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));

      const response = await handlePartyActivity(badRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid type filter');
    });
  });

  // ─── handleSendPartyMessage ───────────────────────────────────────

  describe('handleSendPartyMessage', () => {
    function createMessageRequest(body: Record<string, unknown>) {
      return {
        headers: { get: jest.fn() },
        url: 'https://example.com/api/party/1/messages',
        json: jest.fn().mockResolvedValue(body),
      };
    }

    it('should return 401 if session is invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      });

      const request = createMessageRequest({ content: 'Hello' });
      const response = await handleSendPartyMessage(request as unknown as Request, mockDb, 1);
      expect(response.status).toBe(401);
    });

    it('should return 400 if content is missing', async () => {
      const request = createMessageRequest({});
      const response = await handleSendPartyMessage(request as unknown as Request, mockDb, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('content is required');
    });

    it('should return 400 if content is empty after trimming', async () => {
      const request = createMessageRequest({ content: '   ' });
      const response = await handleSendPartyMessage(request as unknown as Request, mockDb, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('cannot be empty');
    });

    it('should return 400 if content exceeds 200 characters', async () => {
      const request = createMessageRequest({ content: 'a'.repeat(201) });
      const response = await handleSendPartyMessage(request as unknown as Request, mockDb, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('200 characters or less');
    });

    it('should return 404 if party not found', async () => {
      const request = createMessageRequest({ content: 'Hello' });
      // Party lookup returns null
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handleSendPartyMessage(request as unknown as Request, mockDb, 999);
      expect(response.status).toBe(404);
    });

    it('should return 404 if party is dissolved', async () => {
      const request = createMessageRequest({ content: 'Hello' });
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: '2026-01-01T00:00:00Z' }),
      }));

      const response = await handleSendPartyMessage(request as unknown as Request, mockDb, 1);
      expect(response.status).toBe(404);
    });

    it('should return 403 if user is not an active member', async () => {
      const request = createMessageRequest({ content: 'Hello' });
      // Party exists
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check returns null
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handleSendPartyMessage(request as unknown as Request, mockDb, 1);
      expect(response.status).toBe(403);
    });

    it('should successfully create a message and return 201', async () => {
      const request = createMessageRequest({ content: 'Hello fellowship!' });
      // Party exists
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));
      // Insert message
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        run: jest.fn().mockResolvedValue({ meta: { last_row_id: 42, changes: 1 } }),
      }));
      // Fetch created message
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 42,
          party_id: 1,
          user_id: 1,
          content: 'Hello fellowship!',
          created_at: '2026-03-15T10:00:00Z',
          display_name: 'Frodo',
          avatar_id: null,
        }),
      }));

      const response = await handleSendPartyMessage(request as unknown as Request, mockDb, 1);
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.message).toEqual({
        id: 42,
        type: 'message',
        user_id: 1,
        display_name: 'Frodo',
        avatar_id: null,
        content: 'Hello fellowship!',
        created_at: '2026-03-15T10:00:00Z',
      });
    });

    it('should trim content before saving', async () => {
      const request = createMessageRequest({ content: '  Hello!  ' });
      // Party exists
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));
      // Insert message
      const runMock = jest.fn().mockResolvedValue({ meta: { last_row_id: 43, changes: 1 } });
      const bindMock = jest.fn(() => ({ run: runMock, all: jest.fn(), first: jest.fn() }));
      mockDB.prepare.mockReturnValueOnce({ bind: bindMock, run: runMock, all: jest.fn(), first: jest.fn() });
      // Fetch created message
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 43, party_id: 1, user_id: 1, content: 'Hello!',
          created_at: '2026-03-15T10:00:00Z', display_name: 'Frodo', avatar_id: null,
        }),
      }));

      const response = await handleSendPartyMessage(request as unknown as Request, mockDb, 1);
      expect(response.status).toBe(201);

      // Verify trimmed content was passed to bind
      expect(bindMock).toHaveBeenCalledWith(1, 1, 'Hello!');
    });

    it('should return 500 on database error', async () => {
      const request = createMessageRequest({ content: 'Hello' });
      mockDB.prepare.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const response = await handleSendPartyMessage(request as unknown as Request, mockDb, 1);
      expect(response.status).toBe(500);
      consoleSpy.mockRestore();
    });

    it('should accept exactly 200 characters', async () => {
      const request = createMessageRequest({ content: 'a'.repeat(200) });
      // Party exists
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, dissolved_at: null }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));
      // Insert message
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        run: jest.fn().mockResolvedValue({ meta: { last_row_id: 44, changes: 1 } }),
      }));
      // Fetch created message
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 44, party_id: 1, user_id: 1, content: 'a'.repeat(200),
          created_at: '2026-03-15T10:00:00Z', display_name: 'Frodo', avatar_id: null,
        }),
      }));

      const response = await handleSendPartyMessage(request as unknown as Request, mockDb, 1);
      expect(response.status).toBe(201);
    });

    it('should return 400 for invalid JSON body', async () => {
      const request = {
        headers: { get: jest.fn() },
        url: 'https://example.com/api/party/1/messages',
        json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      };

      const response = await handleSendPartyMessage(request as unknown as Request, mockDb, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid JSON');
    });
  });
});
