import {
  handleLeaveParty,
  handleKickMember,
  handleUpdatePartySettings,
  handleTransferLeadership,
} from '../../src/party-handlers';
import { validateSession } from '../../src/auth-handlers';
import { DbClient } from '../../src/db';
import { calculateTotalDistance } from '../../src/goals-handlers';

// Mock dependencies
jest.mock('../../src/auth-handlers');
jest.mock('../../src/goals-handlers');

describe('Party Management API (Story 3.5)', () => {
  let mockDB: Record<string, jest.Mock>;
  let mockDb: DbClient;
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

    mockDB = {
      prepare: jest.fn(() => createChainableMock()),
      batch: jest.fn().mockResolvedValue([]),
    };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };

    mockRequest = {
      headers: { get: jest.fn() },
    };
  });

  // ─── handleLeaveParty ──────────────────────────────────────────────

  describe('handleLeaveParty', () => {
    it('should return 401 if session is invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      });

      const response = await handleLeaveParty(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(401);
    });

    it('should return 404 if party not found', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handleLeaveParty(mockRequest as unknown as Request, mockDb, 999);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Party not found');
    });

    it('should return 400 if party is dissolved', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: '2026-01-01T00:00:00Z',
        }),
      }));

      const response = await handleLeaveParty(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('This party has been dissolved');
    });

    it('should return 403 if user is not an active member', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 2, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handleLeaveParty(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('You are not an active member of this party');
    });

    it('should leave as a regular member with distance_kept=1 (keep)', async () => {
      // Party lookup
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 2, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));
      // Membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, distance_at_join: 10, role: 'member' }),
      }));
      // Build UPDATE batch statement (prepare call consumed by stmts.push)
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      // Remaining count check (leader still active)
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ count: 1 }),
      }));

      const response = await handleLeaveParty(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('You have left the party');
      expect(mockDB.batch).toHaveBeenCalledTimes(1);

      const batchCalls = mockDB.batch.mock.calls[0][0];
      expect(batchCalls).toHaveLength(1); // Just the member update (leader still exists)
    });

    it('should leave as a regular member with distance_kept=0 (remove)', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 2, distance_mode: 'incremental',
          leave_distance_behavior: 'remove', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, distance_at_join: 10, role: 'member' }),
      }));
      // Build UPDATE batch statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ count: 1 }),
      }));

      const response = await handleLeaveParty(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
    });

    it('should compute contribution in cumulative mode', async () => {
      (calculateTotalDistance as jest.Mock).mockResolvedValue(100);
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 2, distance_mode: 'cumulative',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, distance_at_join: 50, role: 'member' }),
      }));
      // Build UPDATE batch statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ count: 1 }),
      }));

      const response = await handleLeaveParty(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
      // In cumulative mode, contribution = total_distance = 100
      expect(calculateTotalDistance).toHaveBeenCalledWith(mockDb, 1);
    });

    it('should transfer leadership to oldest active member when leader leaves', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, distance_at_join: 10, role: 'leader' }),
      }));
      // Build UPDATE member statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      // Next leader lookup
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 20, user_id: 5 }),
      }));
      // Build UPDATE next leader role statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      // Build UPDATE parties.leader_id statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handleLeaveParty(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
      const batchCalls = mockDB.batch.mock.calls[0][0];
      // 1 = member update, 2 = next leader role update, 3 = parties.leader_id update
      expect(batchCalls).toHaveLength(3);
    });

    it('should auto-dissolve when leader leaves and no active members remain', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, distance_at_join: 10, role: 'leader' }),
      }));
      // Build UPDATE member statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      // No next leader found
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));
      // Build dissolve statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      // Build fellowship invite invalidation statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handleLeaveParty(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
      const batchCalls = mockDB.batch.mock.calls[0][0];
      // 1 = member update, 2 = dissolve party, 3 = invalidate fellowship invites
      expect(batchCalls).toHaveLength(3);
    });

    it('should auto-dissolve when last non-leader member leaves', async () => {
      (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 5 });
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 15, distance_at_join: 10, role: 'member' }),
      }));
      // Build UPDATE member statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      // Remaining count = 0 (only the leaving member was "active")
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ count: 0 }),
      }));
      // Build dissolve statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      // Build fellowship invite invalidation statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handleLeaveParty(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
      const batchCalls = mockDB.batch.mock.calls[0][0];
      // 1 = member update, 2 = dissolve party, 3 = invalidate fellowship invites
      expect(batchCalls).toHaveLength(3);
    });

    it('should floor contribution at 0 in incremental mode', async () => {
      (calculateTotalDistance as jest.Mock).mockResolvedValue(5);
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 2, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10, distance_at_join: 50, role: 'member' }),
      }));
      // Build UPDATE batch statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ count: 1 }),
      }));

      const response = await handleLeaveParty(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(200);
    });

    it('should return 500 on database error', async () => {
      mockDB.prepare.mockImplementation(() => { throw new Error('DB failure'); });

      const response = await handleLeaveParty(mockRequest as unknown as Request, mockDb, 1);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error while leaving party');
    });
  });

  // ─── handleKickMember ──────────────────────────────────────────────

  describe('handleKickMember', () => {
    it('should return 401 if session is invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      });

      const response = await handleKickMember(mockRequest as unknown as Request, mockDb, 1, 2, {});
      expect(response.status).toBe(401);
    });

    it('should return 404 if party not found', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handleKickMember(mockRequest as unknown as Request, mockDb, 999, 2, {});
      expect(response.status).toBe(404);
    });

    it('should return 400 if party is dissolved', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: '2026-01-01T00:00:00Z',
        }),
      }));

      const response = await handleKickMember(mockRequest as unknown as Request, mockDb, 1, 2, {});
      expect(response.status).toBe(400);
    });

    it('should return 403 if requester is not the leader', async () => {
      (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 5 });
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));

      const response = await handleKickMember(mockRequest as unknown as Request, mockDb, 1, 2, {});
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Only the party leader can kick members');
    });

    it('should return 400 if leader tries to kick themselves', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));

      const response = await handleKickMember(mockRequest as unknown as Request, mockDb, 1, 1, {});
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Cannot kick yourself. Use the leave endpoint instead.');
    });

    it('should return 404 if target user is not an active member', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handleKickMember(mockRequest as unknown as Request, mockDb, 1, 99, {});
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Target user is not an active member of this party');
    });

    it('should kick a member using party default (keep)', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 20, distance_at_join: 10 }),
      }));
      // Build UPDATE batch statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      // Remaining count
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ count: 1 }),
      }));

      const response = await handleKickMember(mockRequest as unknown as Request, mockDb, 1, 2, {});
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Member has been kicked from the party');
      const batchCalls = mockDB.batch.mock.calls[0][0];
      expect(batchCalls).toHaveLength(1); // Just member update (leader still active)
    });

    it('should kick with removeDistance=true overriding party default', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 20, distance_at_join: 10 }),
      }));
      // Build UPDATE batch statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ count: 1 }),
      }));

      const response = await handleKickMember(
        mockRequest as unknown as Request,
        mockDb,
        1, 2, { removeDistance: true },
      );
      expect(response.status).toBe(200);
    });

    it('should kick with removeDistance=false overriding party default', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'incremental',
          leave_distance_behavior: 'remove', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 20, distance_at_join: 10 }),
      }));
      // Build UPDATE batch statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ count: 1 }),
      }));

      const response = await handleKickMember(
        mockRequest as unknown as Request,
        mockDb,
        1, 2, { removeDistance: false },
      );
      expect(response.status).toBe(200);
    });

    it('should auto-dissolve when last member is kicked', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'incremental',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 20, distance_at_join: 10 }),
      }));
      // Build UPDATE batch statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      // No remaining active members
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ count: 0 }),
      }));
      // Build dissolve statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      // Build fellowship invite invalidation statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());

      const response = await handleKickMember(mockRequest as unknown as Request, mockDb, 1, 2, {});
      expect(response.status).toBe(200);
      const batchCalls = mockDB.batch.mock.calls[0][0];
      expect(batchCalls).toHaveLength(3); // member update + dissolve + invalidate fellowship invites
    });

    it('should compute contribution in cumulative mode', async () => {
      (calculateTotalDistance as jest.Mock).mockResolvedValue(100);
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, distance_mode: 'cumulative',
          leave_distance_behavior: 'keep', dissolved_at: null,
        }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 20, distance_at_join: 50 }),
      }));
      // Build UPDATE batch statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ count: 1 }),
      }));

      const response = await handleKickMember(mockRequest as unknown as Request, mockDb, 1, 2, {});
      expect(response.status).toBe(200);
      // In cumulative mode, calculates on target user (2)
      expect(calculateTotalDistance).toHaveBeenCalledWith(mockDb, 2);
    });

    it('should return 500 on database error', async () => {
      mockDB.prepare.mockImplementation(() => { throw new Error('DB failure'); });

      const response = await handleKickMember(mockRequest as unknown as Request, mockDb, 1, 2, {});
      expect(response.status).toBe(500);
    });
  });

  // ─── handleUpdatePartySettings ─────────────────────────────────────

  describe('handleUpdatePartySettings', () => {
    it('should return 401 if session is invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      });

      const response = await handleUpdatePartySettings(mockRequest as unknown as Request, mockDb, 1, {});
      expect(response.status).toBe(401);
    });

    it('should return 404 if party not found', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handleUpdatePartySettings(mockRequest as unknown as Request, mockDb, 999, {});
      expect(response.status).toBe(404);
    });

    it('should return 400 if party is dissolved', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, dissolved_at: '2026-01-01T00:00:00Z',
        }),
      }));

      const response = await handleUpdatePartySettings(mockRequest as unknown as Request, mockDb, 1, {});
      expect(response.status).toBe(400);
    });

    it('should return 403 if requester is not the leader', async () => {
      (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 5 });
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, leader_id: 1, dissolved_at: null,
        }),
      }));

      const response = await handleUpdatePartySettings(mockRequest as unknown as Request, mockDb, 1, { name: 'New Name' });
      expect(response.status).toBe(403);
    });

    it('should return 400 if distance_mode is provided', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));

      const response = await handleUpdatePartySettings(
        mockRequest as unknown as Request,
        mockDb,
        1, { distance_mode: 'cumulative' },
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('distance_mode is immutable and cannot be changed');
    });

    it('should return 400 if no valid fields provided', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));

      const response = await handleUpdatePartySettings(mockRequest as unknown as Request, mockDb, 1, {});
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No valid fields to update');
    });

    it('should return 400 if name is empty', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));

      const response = await handleUpdatePartySettings(mockRequest as unknown as Request, mockDb, 1, { name: '   ' });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Name cannot be empty');
    });

    it('should return 400 if name is over 50 characters', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));

      const response = await handleUpdatePartySettings(
        mockRequest as unknown as Request,
        mockDb,
        1, { name: 'A'.repeat(51) },
      );
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid leave_distance_behavior', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));

      const response = await handleUpdatePartySettings(
        mockRequest as unknown as Request,
        mockDb,
        1, { leave_distance_behavior: 'invalid' },
      );
      expect(response.status).toBe(400);
    });

    it('should update name only', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));
      // Update statement
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      // Fetch updated party
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, name: 'New Name', leader_id: 1, distance_mode: 'incremental', leave_distance_behavior: 'keep',
        }),
      }));

      const response = await handleUpdatePartySettings(mockRequest as unknown as Request, mockDb, 1, { name: 'New Name' });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('New Name');
    });

    it('should update leave_distance_behavior only', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, name: 'Party', leader_id: 1, distance_mode: 'incremental', leave_distance_behavior: 'remove',
        }),
      }));

      const response = await handleUpdatePartySettings(
        mockRequest as unknown as Request,
        mockDb,
        1, { leave_distance_behavior: 'remove' },
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.leave_distance_behavior).toBe('remove');
    });

    it('should update both name and leave_distance_behavior', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));
      mockDB.prepare.mockReturnValueOnce(createChainableMock());
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({
          id: 1, name: 'Updated', leader_id: 1, distance_mode: 'incremental', leave_distance_behavior: 'remove',
        }),
      }));

      const response = await handleUpdatePartySettings(
        mockRequest as unknown as Request,
        mockDb,
        1, { name: 'Updated', leave_distance_behavior: 'remove' },
      );
      expect(response.status).toBe(200);
    });

    it('should return 500 on database error', async () => {
      mockDB.prepare.mockImplementation(() => { throw new Error('DB failure'); });

      const response = await handleUpdatePartySettings(mockRequest as unknown as Request, mockDb, 1, { name: 'Fail' });
      expect(response.status).toBe(500);
    });
  });

  // ─── handleTransferLeadership ──────────────────────────────────────

  describe('handleTransferLeadership', () => {
    it('should return 401 if session is invalid', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      });

      const response = await handleTransferLeadership(mockRequest as unknown as Request, mockDb, 1, { new_leader_id: 2 });
      expect(response.status).toBe(401);
    });

    it('should return 404 if party not found', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handleTransferLeadership(mockRequest as unknown as Request, mockDb, 999, { new_leader_id: 2 });
      expect(response.status).toBe(404);
    });

    it('should return 400 if party is dissolved', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: '2026-01-01T00:00:00Z' }),
      }));

      const response = await handleTransferLeadership(mockRequest as unknown as Request, mockDb, 1, { new_leader_id: 2 });
      expect(response.status).toBe(400);
    });

    it('should return 403 if requester is not the leader', async () => {
      (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 5 });
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));

      const response = await handleTransferLeadership(mockRequest as unknown as Request, mockDb, 1, { new_leader_id: 2 });
      expect(response.status).toBe(403);
    });

    it('should return 400 if new_leader_id is missing', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));

      const response = await handleTransferLeadership(mockRequest as unknown as Request, mockDb, 1, {});
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Valid new_leader_id is required');
    });

    it('should return 400 if new_leader_id is not a number', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));

      const response = await handleTransferLeadership(mockRequest as unknown as Request, mockDb, 1, { new_leader_id: 'abc' });
      expect(response.status).toBe(400);
    });

    it('should return 400 if new_leader_id is the current leader', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));

      const response = await handleTransferLeadership(mockRequest as unknown as Request, mockDb, 1, { new_leader_id: 1 });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('You are already the leader');
    });

    it('should return 404 if new leader is not an active member', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));
      // New leader membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue(null),
      }));

      const response = await handleTransferLeadership(mockRequest as unknown as Request, mockDb, 1, { new_leader_id: 99 });
      expect(response.status).toBe(404);
    });

    it('should transfer leadership successfully', async () => {
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 1, leader_id: 1, dissolved_at: null }),
      }));
      // New leader membership check
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 20 }),
      }));
      // Current leader membership
      mockDB.prepare.mockReturnValueOnce(createChainableMock({
        first: jest.fn().mockResolvedValue({ id: 10 }),
      }));

      const response = await handleTransferLeadership(mockRequest as unknown as Request, mockDb, 1, { new_leader_id: 2 });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Leadership transferred successfully');
      expect(data.new_leader_id).toBe(2);
      expect(mockDB.batch).toHaveBeenCalledTimes(1);
      // 3 statements: old leader role, new leader role, parties.leader_id
      const batchCalls = mockDB.batch.mock.calls[0][0];
      expect(batchCalls).toHaveLength(3);
    });

    it('should return 500 on database error', async () => {
      mockDB.prepare.mockImplementation(() => { throw new Error('DB failure'); });

      const response = await handleTransferLeadership(mockRequest as unknown as Request, mockDb, 1, { new_leader_id: 2 });
      expect(response.status).toBe(500);
    });
  });
});
