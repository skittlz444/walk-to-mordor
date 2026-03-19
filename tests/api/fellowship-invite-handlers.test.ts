import {
  handleInviteFriend,
  handleGetFellowshipInvites,
  handleAcceptFellowshipInvite,
  handleRejectFellowshipInvite
} from '../../src/fellowship-invite-handlers';
import { validateSession } from '../../src/auth-handlers';
import { calculateTotalDistance } from '../../src/goals-handlers';
import { DbClient } from '../../src/db';

jest.mock('../../src/auth-handlers');
jest.mock('../../src/goals-handlers');

describe('Fellowship Invite Handlers', () => {
  let mockDB: any;
  let mockDb: DbClient;
  let mockRequest: any;
  let mockFirst: jest.Mock;
  let mockRun: jest.Mock;
  let mockAll: jest.Mock;
  let mockBind: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated as user 1
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });
    (calculateTotalDistance as jest.Mock).mockResolvedValue(42.5);

    mockFirst = jest.fn().mockResolvedValue(null);
    mockRun = jest.fn().mockResolvedValue({ meta: { last_row_id: 1, changes: 1 } });
    mockAll = jest.fn().mockResolvedValue({ results: [] });
    mockBind = jest.fn(() => ({
      run: mockRun,
      all: mockAll,
      first: mockFirst,
    }));

    mockDB = {
      prepare: jest.fn(() => ({
        bind: mockBind,
        run: mockRun,
        all: mockAll,
        first: mockFirst,
      })),
      batch: jest.fn().mockResolvedValue([
        { meta: { changes: 1 } },
        { meta: { changes: 1 } },
      ]),
    };
    mockDb = { read: mockDB as unknown as D1Database, write: mockDB as unknown as D1Database };

    mockRequest = {
      url: 'http://localhost/api/party/1/invite-friend',
      method: 'POST',
      headers: { get: jest.fn() },
    };
  });

  // ===== Authentication tests =====
  describe('Authentication', () => {
    it('should return 401 for unauthenticated POST /api/party/:id/invite-friend', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 2 });
      expect(response.status).toBe(401);
    });

    it('should return 401 for unauthenticated GET /api/user/fellowship-invites', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const response = await handleGetFellowshipInvites(mockRequest, mockDb);
      expect(response.status).toBe(401);
    });

    it('should return 401 for unauthenticated accept', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(401);
    });

    it('should return 401 for unauthenticated reject', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const response = await handleRejectFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(401);
    });
  });

  // ===== handleInviteFriend tests =====
  describe('handleInviteFriend', () => {
    it('should return 400 if user_id is missing', async () => {
      const response = await handleInviteFriend(mockRequest, mockDb, 1, {});
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required field: user_id');
    });

    it('should return 400 if user_id is null', async () => {
      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: null });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required field: user_id');
    });

    it('should return 400 if user_id is not a number', async () => {
      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 'abc' });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid user_id');
    });

    it('should return 400 if user_id is not a positive integer', async () => {
      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: -1 });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid user_id');
    });

    it('should return 400 if user_id is zero', async () => {
      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 0 });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid user_id');
    });

    it('should return 400 if user_id is a float', async () => {
      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 1.5 });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid user_id');
    });

    it('should return 400 for self-invite', async () => {
      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 1 });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Cannot invite yourself');
    });

    it('should return 404 if party not found', async () => {
      const mockFirst = jest.fn().mockResolvedValue(null); // party not found
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleInviteFriend(mockRequest, mockDb, 999, { user_id: 2 });
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Party not found');
    });

    it('should return 400 if party is dissolved', async () => {
      const mockFirst = jest.fn().mockResolvedValue({
        id: 1, name: 'Old Party', dissolved_at: '2026-01-01T00:00:00Z'
      });
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 2 });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('This party has been dissolved');
    });

    it('should return 403 if inviter is not an active member', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: 'Party', dissolved_at: null }) // party exists
        .mockResolvedValueOnce(null); // inviter not a member
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 2 });
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('You are not an active member of this party');
    });

    it('should return 404 if target user does not exist', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: 'Party', dissolved_at: null }) // party
        .mockResolvedValueOnce({ id: 10 }) // inviter is member
        .mockResolvedValueOnce(null); // target user not found
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 999 });
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('User not found');
    });

    it('should return 403 if target is not an accepted friend', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: 'Party', dissolved_at: null }) // party
        .mockResolvedValueOnce({ id: 10 }) // inviter is member
        .mockResolvedValueOnce({ id: 2 }) // target user exists
        .mockResolvedValueOnce(null); // no accepted friendship
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 2 });
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('You can only invite accepted friends');
    });

    it('should return 400 if target is already an active member', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: 'Party', dissolved_at: null }) // party
        .mockResolvedValueOnce({ id: 10 }) // inviter is member
        .mockResolvedValueOnce({ id: 2 }) // target user exists
        .mockResolvedValueOnce({ id: 5 }) // accepted friendship
        .mockResolvedValueOnce({ id: 20 }); // target already active member
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 2 });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('User is already an active member of this party');
    });

    it('should return 400 if a pending invite already exists', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: 'Party', dissolved_at: null }) // party
        .mockResolvedValueOnce({ id: 10 }) // inviter is member
        .mockResolvedValueOnce({ id: 2 }) // target user exists
        .mockResolvedValueOnce({ id: 5 }) // accepted friendship
        .mockResolvedValueOnce(null) // target not active member
        .mockResolvedValueOnce({ id: 99 }); // existing pending invite
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 2 });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('A pending invite already exists for this user');
    });

    it('should create invite successfully and return 201', async () => {
      const mockRun = jest.fn().mockResolvedValue({ meta: { last_row_id: 42 } });
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: 'The Fellowship', dissolved_at: null }) // party
        .mockResolvedValueOnce({ id: 10 }) // inviter is member
        .mockResolvedValueOnce({ id: 2 }) // target user exists
        .mockResolvedValueOnce({ id: 5 }) // accepted friendship
        .mockResolvedValueOnce(null) // target not active member
        .mockResolvedValueOnce(null); // no existing pending invite
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: mockRun });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 2 });
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBe(42);
      expect(data.party_id).toBe(1);
      expect(data.party_name).toBe('The Fellowship');
      expect(data.invitee_id).toBe(2);
      expect(data.status).toBe('pending');
    });

    it('should return 409 on UNIQUE constraint race condition', async () => {
      const mockRun = jest.fn().mockRejectedValue(new Error('UNIQUE constraint failed: fellowship_invites.party_id'));
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, name: 'Party', dissolved_at: null }) // party
        .mockResolvedValueOnce({ id: 10 }) // inviter is member
        .mockResolvedValueOnce({ id: 2 }) // target user exists
        .mockResolvedValueOnce({ id: 5 }) // accepted friendship
        .mockResolvedValueOnce(null) // target not active member
        .mockResolvedValueOnce(null); // no existing pending invite
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: mockRun });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 2 });
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('A pending invite already exists for this user');
    });

    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const mockBind = jest.fn().mockReturnValue({
          first: jest.fn().mockRejectedValue(new Error('DB error'))
        });
        mockDB.prepare.mockReturnValue({ bind: mockBind });

        const response = await handleInviteFriend(mockRequest, mockDb, 1, { user_id: 2 });
        expect(response.status).toBe(500);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('should return 400 when body is null/undefined', async () => {
      const response = await handleInviteFriend(mockRequest, mockDb, 1, undefined as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required field: user_id');
    });
  });

  // ===== handleGetFellowshipInvites tests =====
  describe('handleGetFellowshipInvites', () => {
    it('should return empty invites list when no pending invites', async () => {
      mockAll.mockResolvedValue({ results: [] });

      const response = await handleGetFellowshipInvites(mockRequest, mockDb);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invites).toEqual([]);
      expect(data.count).toBe(0);
    });

    it('should return pending invites with party preview data', async () => {
      // Single query now returns total_distance inline (no N+1 calls)
      const inviteRows = [
        {
          id: 1,
          party_id: 10,
          party_name: 'The Fellowship',
          distance_mode: 'incremental',
          member_count: 3,
          total_distance: 45,
          inviter_username: 'gandalf',
          created_at: '2026-01-15T12:00:00Z',
        },
      ];

      const mockAll = jest.fn().mockResolvedValueOnce({ results: inviteRows });
      const mockBind = jest.fn().mockReturnValue({
        all: mockAll,
        first: jest.fn(),
        run: jest.fn(),
      });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleGetFellowshipInvites(mockRequest, mockDb);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.count).toBe(1);
      expect(data.invites[0].id).toBe(1);
      expect(data.invites[0].party_name).toBe('The Fellowship');
      expect(data.invites[0].inviter_username).toBe('gandalf');
      expect(data.invites[0].member_count).toBe(3);
      expect(data.invites[0].total_distance).toBe(45);
      // Verify only 1 DB prepare call (single inline query, no N+1)
      expect(mockDB.prepare).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        mockAll.mockRejectedValue(new Error('DB error'));
        const response = await handleGetFellowshipInvites(mockRequest, mockDb);
        expect(response.status).toBe(500);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  // ===== handleAcceptFellowshipInvite tests =====
  describe('handleAcceptFellowshipInvite', () => {
    it('should return 404 if invite not found', async () => {
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 999);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Invite not found');
    });

    it('should return 403 if user is not the invitee', async () => {
      const mockFirst = jest.fn().mockResolvedValue({
        id: 1, party_id: 10, inviter_id: 3, invitee_id: 99, status: 'pending'
      });
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Only the invitee can accept this invite');
    });

    it('should return 400 if invite is not pending (already accepted)', async () => {
      const mockFirst = jest.fn().mockResolvedValue({
        id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'accepted'
      });
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invite is not pending');
    });

    it('should return 400 if invite is not pending (rejected)', async () => {
      const mockFirst = jest.fn().mockResolvedValue({
        id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'rejected'
      });
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invite is not pending');
    });

    it('should return 404 if party not found', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'pending' }) // invite
        .mockResolvedValueOnce(null); // party not found
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Party not found');
    });

    it('should return 400 if party is dissolved', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'pending' }) // invite
        .mockResolvedValueOnce({ id: 10, name: 'Dissolved Party', dissolved_at: '2026-01-01T00:00:00Z' }); // party dissolved
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('This party has been dissolved');
    });

    it('should return 400 if user is already an active member (stale invite)', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'pending' }) // invite
        .mockResolvedValueOnce({ id: 10, name: 'Party', dissolved_at: null }) // party
        .mockResolvedValueOnce({ id: 50, status: 'active' }); // already active member
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('You are already an active member of this party');
    });

    it('should re-join if previously left and mark invite as accepted', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'pending' }) // invite
        .mockResolvedValueOnce({ id: 10, name: 'Party', dissolved_at: null }) // party
        .mockResolvedValueOnce({ id: 50, status: 'left' }); // previously left member
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: jest.fn() });
      mockDB.prepare.mockReturnValue({ bind: mockBind });
      mockDB.batch.mockResolvedValue([
        { meta: { changes: 1 } }, // member update
        { meta: { changes: 1 } }, // invite update
      ]);

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.party_id).toBe(10);
      expect(data.party_name).toBe('Party');
      expect(data.rejoined).toBe(true);
      expect(calculateTotalDistance).toHaveBeenCalled();
      expect(mockDB.batch).toHaveBeenCalledTimes(1);
      const batchArgs = mockDB.batch.mock.calls[0][0];
      expect(batchArgs).toHaveLength(2);
    });

    it('should re-join if previously kicked and mark invite as accepted', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'pending' }) // invite
        .mockResolvedValueOnce({ id: 10, name: 'Party', dissolved_at: null }) // party
        .mockResolvedValueOnce({ id: 50, status: 'kicked' }); // previously kicked member
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: jest.fn() });
      mockDB.prepare.mockReturnValue({ bind: mockBind });
      mockDB.batch.mockResolvedValue([
        { meta: { changes: 1 } },
        { meta: { changes: 1 } },
      ]);

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.rejoined).toBe(true);
      expect(calculateTotalDistance).toHaveBeenCalled();
      expect(mockDB.batch).toHaveBeenCalledTimes(1);
    });

    it('should fresh-join as new member and mark invite as accepted', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'pending' }) // invite
        .mockResolvedValueOnce({ id: 10, name: 'The Fellowship', dissolved_at: null }) // party
        .mockResolvedValueOnce(null); // no existing membership
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: jest.fn() });
      mockDB.prepare.mockReturnValue({ bind: mockBind });
      mockDB.batch.mockResolvedValue([
        { meta: { changes: 1 } }, // insert member
        { meta: { changes: 1 } }, // invite update
      ]);

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.party_id).toBe(10);
      expect(data.party_name).toBe('The Fellowship');
      expect(data.rejoined).toBe(false);
      expect(calculateTotalDistance).toHaveBeenCalledWith(mockDb, 1);
      expect(mockDB.batch).toHaveBeenCalledTimes(1);
      const batchArgs = mockDB.batch.mock.calls[0][0];
      expect(batchArgs).toHaveLength(2);
    });

    it('should return 400 on UNIQUE constraint race condition during fresh join', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'pending' }) // invite
        .mockResolvedValueOnce({ id: 10, name: 'Party', dissolved_at: null }) // party
        .mockResolvedValueOnce(null); // no existing member (race condition)
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: jest.fn() });
      mockDB.prepare.mockReturnValue({ bind: mockBind });
      mockDB.batch.mockRejectedValue(new Error('UNIQUE constraint failed: party_members.party_id, party_members.user_id'));

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('You are already an active member of this party');
    });

    it('should return 409 if invite was accepted by another request (optimistic locking race on re-join)', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'pending' }) // invite
        .mockResolvedValueOnce({ id: 10, name: 'Party', dissolved_at: null }) // party
        .mockResolvedValueOnce({ id: 50, status: 'left' }); // previously left
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: jest.fn() });
      mockDB.prepare.mockReturnValue({ bind: mockBind });
      mockDB.batch.mockResolvedValue([
        { meta: { changes: 1 } }, // member update succeeded
        { meta: { changes: 0 } }, // invite update found no pending row (race)
      ]);

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('Invite is no longer pending');
    });

    it('should return 409 if invite was accepted by another request (optimistic locking race on fresh join)', async () => {
      const mockFirst = jest.fn()
        .mockResolvedValueOnce({ id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'pending' }) // invite
        .mockResolvedValueOnce({ id: 10, name: 'Party', dissolved_at: null }) // party
        .mockResolvedValueOnce(null); // no existing membership
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: jest.fn() });
      mockDB.prepare.mockReturnValue({ bind: mockBind });
      mockDB.batch.mockResolvedValue([
        { meta: { changes: 1 } }, // insert member succeeded
        { meta: { changes: 0 } }, // invite update found no pending row (race)
      ]);

      const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('Invite is no longer pending');
    });

    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const mockBind = jest.fn().mockReturnValue({
          first: jest.fn().mockRejectedValue(new Error('DB error'))
        });
        mockDB.prepare.mockReturnValue({ bind: mockBind });

        const response = await handleAcceptFellowshipInvite(mockRequest, mockDb, 1);
        expect(response.status).toBe(500);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });

  // ===== handleRejectFellowshipInvite tests =====
  describe('handleRejectFellowshipInvite', () => {
    it('should return 404 if invite not found', async () => {
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleRejectFellowshipInvite(mockRequest, mockDb, 999);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Invite not found');
    });

    it('should return 403 if user is not the invitee', async () => {
      const mockFirst = jest.fn().mockResolvedValue({
        id: 1, party_id: 10, inviter_id: 3, invitee_id: 99, status: 'pending'
      });
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleRejectFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Only the invitee can reject this invite');
    });

    it('should return 400 if invite is not pending', async () => {
      const mockFirst = jest.fn().mockResolvedValue({
        id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'accepted'
      });
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleRejectFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invite is not pending');
    });

    it('should reject invite successfully and return status rejected', async () => {
      const mockRun = jest.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockFirst = jest.fn().mockResolvedValue({
        id: 1, party_id: 10, inviter_id: 3, invitee_id: 1, status: 'pending'
      });
      const mockBind = jest.fn().mockReturnValue({ first: mockFirst, run: mockRun });
      mockDB.prepare.mockReturnValue({ bind: mockBind });

      const response = await handleRejectFellowshipInvite(mockRequest, mockDb, 1);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('rejected');
    });

    it('should handle database errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const mockBind = jest.fn().mockReturnValue({
          first: jest.fn().mockRejectedValue(new Error('DB error'))
        });
        mockDB.prepare.mockReturnValue({ bind: mockBind });

        const response = await handleRejectFellowshipInvite(mockRequest, mockDb, 1);
        expect(response.status).toBe(500);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });
});
