import {
  handleGetFriends,
  handleGetPendingFriends,
  handleSearchUsers,
  handleResolveFriendCode,
  handleFriendRequest,
  handleFriendRequestByCode,
  handleAcceptFriend,
  handleRejectFriend,
  handleUnfriend,
  handleGetFriendProfile
} from '../../src/friends-handlers';
import { validateSession } from '../../src/auth-handlers';
import { calculateTotalDistance } from '../../src/goals-handlers';

jest.mock('../../src/auth-handlers');
jest.mock('../../src/goals-handlers');

describe('Friends Handlers', () => {
  let mockEnv: any;
  let mockRequest: any;
  let mockFirst: jest.Mock;
  let mockRun: jest.Mock;
  let mockAll: jest.Mock;
  let mockBind: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated as user 1
    (validateSession as jest.Mock).mockResolvedValue({ valid: true, userId: 1 });
    (calculateTotalDistance as jest.Mock).mockResolvedValue(100.50);

    mockFirst = jest.fn().mockResolvedValue(null);
    mockRun = jest.fn().mockResolvedValue({ meta: { last_row_id: 1, changes: 1 } });
    mockAll = jest.fn().mockResolvedValue({ results: [] });
    mockBind = jest.fn(() => ({
      run: mockRun,
      all: mockAll,
      first: mockFirst,
    }));

    mockEnv = {
      DB: {
        prepare: jest.fn(() => ({
          bind: mockBind,
          run: mockRun,
          all: mockAll,
          first: mockFirst,
        })),
      },
    };

    mockRequest = {
      url: 'http://localhost/api/friends',
      method: 'GET',
      headers: { get: jest.fn() },
    };
  });

  // ===== Authentication tests =====
  describe('Authentication', () => {
    it('should return 401 for unauthenticated GET /api/friends', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const response = await handleGetFriends(mockRequest, mockEnv);
      expect(response.status).toBe(401);
    });

    it('should return 401 for unauthenticated GET /api/friends/pending', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const response = await handleGetPendingFriends(mockRequest, mockEnv);
      expect(response.status).toBe(401);
    });

    it('should return 401 for unauthenticated GET /api/friends/search', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      mockRequest.url = 'http://localhost/api/friends/search?q=test';
      const response = await handleSearchUsers(mockRequest, mockEnv);
      expect(response.status).toBe(401);
    });

    it('should resolve friend code without authentication (public endpoint)', async () => {
      mockFirst.mockResolvedValue({ id: 5, username: 'alice', avatar_id: 'arwen' });
      const response = await handleResolveFriendCode(mockRequest, mockEnv, 'AbCd1234');
      expect(response.status).toBe(200);
      const data = await response.json() as { id: number; username: string; avatar_id: string };
      expect(data.username).toBe('alice');
      // validateSession should NOT have been called
      expect(validateSession).not.toHaveBeenCalled();
    });

    it('should return 401 for unauthenticated POST /api/friends/request', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: 2 });
      expect(response.status).toBe(401);
    });

    it('should return 401 for unauthenticated POST /api/friends/request/code', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const response = await handleFriendRequestByCode(mockRequest, mockEnv, { friend_code: 'AbCd1234' });
      expect(response.status).toBe(401);
    });

    it('should return 401 for unauthenticated accept', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const response = await handleAcceptFriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(401);
    });

    it('should return 401 for unauthenticated reject', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const response = await handleRejectFriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(401);
    });

    it('should return 401 for unauthenticated unfriend', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const response = await handleUnfriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(401);
    });
  });

  // ===== GET /api/friends =====
  describe('handleGetFriends', () => {
    it('should return an empty friends list', async () => {
      mockAll.mockResolvedValue({ results: [] });
      const response = await handleGetFriends(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as { friends: unknown[] };
      expect(data.friends).toEqual([]);
    });

    it('should return accepted friends with last_progressed', async () => {
      const friends = [
        { id: 1, username: 'alice', avatar_id: 'gandalf-grey', last_progressed: '2024-01-15' },
        { id: 2, username: 'bob', avatar_id: null, last_progressed: null },
      ];
      mockAll.mockResolvedValue({ results: friends });
      const response = await handleGetFriends(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as { friends: typeof friends };
      expect(data.friends).toEqual(friends);
      expect(data.friends).toHaveLength(2);
    });

    it('should handle database errors', async () => {
      mockAll.mockRejectedValue(new Error('DB error'));
      const originalConsoleError = console.error;
      console.error = jest.fn();
      const response = await handleGetFriends(mockRequest, mockEnv);
      expect(response.status).toBe(500);
      console.error = originalConsoleError;
    });
  });

  // ===== GET /api/friends/pending =====
  describe('handleGetPendingFriends', () => {
    it('should return empty pending list with count 0', async () => {
      mockAll.mockResolvedValue({ results: [] });
      const response = await handleGetPendingFriends(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as { pending: unknown[]; count: number };
      expect(data.pending).toEqual([]);
      expect(data.count).toBe(0);
    });

    it('should return pending requests with count', async () => {
      const pending = [
        { id: 5, username: 'charlie', avatar_id: 'frodo', created_at: '2024-01-10T12:00:00Z' },
        { id: 6, username: 'diana', avatar_id: null, created_at: '2024-01-11T12:00:00Z' },
      ];
      mockAll.mockResolvedValue({ results: pending });
      const response = await handleGetPendingFriends(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as { pending: typeof pending; count: number };
      expect(data.pending).toEqual(pending);
      expect(data.count).toBe(2);
    });

    it('should handle database errors', async () => {
      mockAll.mockRejectedValue(new Error('DB error'));
      const originalConsoleError = console.error;
      console.error = jest.fn();
      const response = await handleGetPendingFriends(mockRequest, mockEnv);
      expect(response.status).toBe(500);
      console.error = originalConsoleError;
    });
  });

  // ===== GET /api/friends/search =====
  describe('handleSearchUsers', () => {
    it('should reject search with missing query', async () => {
      mockRequest.url = 'http://localhost/api/friends/search';
      const response = await handleSearchUsers(mockRequest, mockEnv);
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('at least 3 characters');
    });

    it('should reject search with query shorter than 3 characters', async () => {
      mockRequest.url = 'http://localhost/api/friends/search?q=ab';
      const response = await handleSearchUsers(mockRequest, mockEnv);
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('at least 3 characters');
    });

    it('should reject search with only whitespace under 3 chars', async () => {
      mockRequest.url = 'http://localhost/api/friends/search?q=  a ';
      const response = await handleSearchUsers(mockRequest, mockEnv);
      expect(response.status).toBe(400);
    });

    it('should return search results', async () => {
      const results = [
        { id: 2, username: 'testuser', avatar_id: 'legolas', friendship_status: null },
        { id: 3, username: 'testfriend', avatar_id: null, friendship_status: 'accepted' },
      ];
      mockAll.mockResolvedValue({ results });
      mockRequest.url = 'http://localhost/api/friends/search?q=test';
      const response = await handleSearchUsers(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as { results: typeof results };
      expect(data.results).toEqual(results);
    });

    it('should escape wildcards in search query', async () => {
      mockAll.mockResolvedValue({ results: [] });
      mockRequest.url = 'http://localhost/api/friends/search?q=test%25user';
      const response = await handleSearchUsers(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      // Verify the escaped pattern was passed to bind
      expect(mockBind).toHaveBeenCalled();
      const bindArgs = mockBind.mock.calls[0];
      // The escaped query should have \% instead of raw %
      expect(bindArgs[2]).toBe('test\\%user%');
    });

    it('should escape underscore wildcards', async () => {
      mockAll.mockResolvedValue({ results: [] });
      mockRequest.url = 'http://localhost/api/friends/search?q=test_user';
      const response = await handleSearchUsers(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      const bindArgs = mockBind.mock.calls[0];
      expect(bindArgs[2]).toBe('test\\_user%');
    });

    it('should handle database errors', async () => {
      mockAll.mockRejectedValue(new Error('DB error'));
      const originalConsoleError = console.error;
      console.error = jest.fn();
      mockRequest.url = 'http://localhost/api/friends/search?q=test';
      const response = await handleSearchUsers(mockRequest, mockEnv);
      expect(response.status).toBe(500);
      console.error = originalConsoleError;
    });
  });

  // ===== GET /api/friends/resolve/:friendCode =====
  describe('handleResolveFriendCode', () => {
    it('should reject invalid friend code format (too short)', async () => {
      const response = await handleResolveFriendCode(mockRequest, mockEnv, 'abc');
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('Invalid friend code');
    });

    it('should reject invalid friend code format (special chars)', async () => {
      const response = await handleResolveFriendCode(mockRequest, mockEnv, 'abc!@#$%');
      expect(response.status).toBe(400);
    });

    it('should return 404 for unknown friend code', async () => {
      mockFirst.mockResolvedValue(null);
      const response = await handleResolveFriendCode(mockRequest, mockEnv, 'AbCd1234');
      expect(response.status).toBe(404);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('not found');
    });

    it('should resolve a valid friend code', async () => {
      mockFirst.mockResolvedValue({ id: 5, username: 'alice', avatar_id: 'arwen' });
      const response = await handleResolveFriendCode(mockRequest, mockEnv, 'AbCd1234');
      expect(response.status).toBe(200);
      const data = await response.json() as { id: number; username: string; avatar_id: string };
      expect(data.username).toBe('alice');
      expect(data.avatar_id).toBe('arwen');
      expect(data.id).toBe(5);
    });

    it('should handle database errors', async () => {
      mockFirst.mockRejectedValue(new Error('DB error'));
      const originalConsoleError = console.error;
      console.error = jest.fn();
      const response = await handleResolveFriendCode(mockRequest, mockEnv, 'AbCd1234');
      expect(response.status).toBe(500);
      console.error = originalConsoleError;
    });
  });

  // ===== POST /api/friends/request =====
  describe('handleFriendRequest', () => {
    it('should reject missing user_id', async () => {
      const response = await handleFriendRequest(mockRequest, mockEnv, {});
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('user_id');
    });

    it('should reject non-integer user_id', async () => {
      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: 'abc' });
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('Invalid user_id');
    });

    it('should reject zero user_id', async () => {
      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: 0 });
      expect(response.status).toBe(400);
    });

    it('should reject negative user_id', async () => {
      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: -1 });
      expect(response.status).toBe(400);
    });

    it('should reject float user_id', async () => {
      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: 1.5 });
      expect(response.status).toBe(400);
    });

    it('should reject self-friend request', async () => {
      // User 1 trying to friend user 1
      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: 1 });
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('yourself');
    });

    it('should reject if target user does not exist', async () => {
      // First call: target user check returns null
      mockFirst.mockResolvedValueOnce(null);
      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: 999 });
      expect(response.status).toBe(404);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('User not found');
    });

    it('should reject duplicate accepted friendship', async () => {
      // First call: target user exists
      mockFirst.mockResolvedValueOnce({ id: 2 });
      // Second call: existing friendship found (accepted)
      mockFirst.mockResolvedValueOnce({ id: 10, status: 'accepted' });
      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: 2 });
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('Already friends');
    });

    it('should reject duplicate pending request in same direction', async () => {
      // First call: target user exists
      mockFirst.mockResolvedValueOnce({ id: 2 });
      // Second call: existing pending friendship found
      mockFirst.mockResolvedValueOnce({ id: 10, status: 'pending' });
      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: 2 });
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('pending');
    });

    it('should reject duplicate pending request in reverse direction', async () => {
      // The SQL checks both directions, so a reverse pending is caught too
      mockFirst.mockResolvedValueOnce({ id: 2 }); // target exists
      mockFirst.mockResolvedValueOnce({ id: 11, status: 'pending' }); // reverse pending found
      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: 2 });
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('pending');
    });

    it('should reject when rate limit exceeded (20 pending outgoing)', async () => {
      // First call: target user exists
      mockFirst.mockResolvedValueOnce({ id: 2 });
      // Second call: no existing friendship
      mockFirst.mockResolvedValueOnce(null);
      // Third call: pending count >= 20
      mockFirst.mockResolvedValueOnce({ count: 20 });
      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: 2 });
      expect(response.status).toBe(429);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('Too many pending');
    });

    it('should create friend request successfully', async () => {
      // First call: target user exists
      mockFirst.mockResolvedValueOnce({ id: 2 });
      // Second call: no existing friendship
      mockFirst.mockResolvedValueOnce(null);
      // Third call: pending count under limit
      mockFirst.mockResolvedValueOnce({ count: 5 });
      // Insert succeeds
      mockRun.mockResolvedValueOnce({ meta: { last_row_id: 42, changes: 1 } });

      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: 2 });
      expect(response.status).toBe(201);
      const data = await response.json() as { friendship_id: number; status: string };
      expect(data.friendship_id).toBe(42);
      expect(data.status).toBe('pending');
    });

    it('should handle database errors during request creation', async () => {
      mockFirst.mockResolvedValueOnce({ id: 2 }); // target exists
      mockFirst.mockResolvedValueOnce(null); // no existing friendship
      mockFirst.mockResolvedValueOnce({ count: 0 }); // under rate limit
      mockRun.mockRejectedValueOnce(new Error('DB error'));
      const originalConsoleError = console.error;
      console.error = jest.fn();
      const response = await handleFriendRequest(mockRequest, mockEnv, { user_id: 2 });
      expect(response.status).toBe(500);
      console.error = originalConsoleError;
    });
  });

  // ===== POST /api/friends/request/code =====
  describe('handleFriendRequestByCode', () => {
    it('should reject missing friend_code', async () => {
      const response = await handleFriendRequestByCode(mockRequest, mockEnv, {});
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('friend_code');
    });

    it('should reject invalid friend_code format', async () => {
      const response = await handleFriendRequestByCode(mockRequest, mockEnv, { friend_code: 'short' });
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('Invalid friend code');
    });

    it('should reject non-string friend_code', async () => {
      const response = await handleFriendRequestByCode(mockRequest, mockEnv, { friend_code: 12345678 });
      expect(response.status).toBe(400);
    });

    it('should return 404 for unknown friend code', async () => {
      mockFirst.mockResolvedValueOnce(null); // code not found
      const response = await handleFriendRequestByCode(mockRequest, mockEnv, { friend_code: 'AbCd1234' });
      expect(response.status).toBe(404);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('Friend code not found');
    });

    it('should reject self-friend via friend code', async () => {
      // Resolve code to user 1 (same as current user)
      mockFirst.mockResolvedValueOnce({ id: 1 });
      const response = await handleFriendRequestByCode(mockRequest, mockEnv, { friend_code: 'AbCd1234' });
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('yourself');
    });

    it('should create friend request by code successfully', async () => {
      // Resolve code to user 2
      mockFirst.mockResolvedValueOnce({ id: 2 });
      // Target user exists
      mockFirst.mockResolvedValueOnce({ id: 2 });
      // No existing friendship
      mockFirst.mockResolvedValueOnce(null);
      // Pending count under limit
      mockFirst.mockResolvedValueOnce({ count: 0 });
      // Insert succeeds
      mockRun.mockResolvedValueOnce({ meta: { last_row_id: 55, changes: 1 } });

      const response = await handleFriendRequestByCode(mockRequest, mockEnv, { friend_code: 'AbCd1234' });
      expect(response.status).toBe(201);
      const data = await response.json() as { friendship_id: number; status: string };
      expect(data.friendship_id).toBe(55);
      expect(data.status).toBe('pending');
    });

    it('should handle database errors', async () => {
      mockFirst.mockRejectedValueOnce(new Error('DB error'));
      const originalConsoleError = console.error;
      console.error = jest.fn();
      const response = await handleFriendRequestByCode(mockRequest, mockEnv, { friend_code: 'AbCd1234' });
      expect(response.status).toBe(500);
      console.error = originalConsoleError;
    });
  });

  // ===== POST /api/friends/:friendshipId/accept =====
  describe('handleAcceptFriend', () => {
    it('should return 404 if friendship not found', async () => {
      mockFirst.mockResolvedValueOnce(null);
      const response = await handleAcceptFriend(mockRequest, mockEnv, 99);
      expect(response.status).toBe(404);
    });

    it('should reject if friendship is not pending', async () => {
      mockFirst.mockResolvedValueOnce({
        id: 1, requester_id: 2, addressee_id: 1, status: 'accepted',
      });
      const response = await handleAcceptFriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('not pending');
    });

    it('should reject accept by wrong user (requester, not addressee)', async () => {
      // User 1 is requester, not addressee
      mockFirst.mockResolvedValueOnce({
        id: 1, requester_id: 1, addressee_id: 2, status: 'pending',
      });
      const response = await handleAcceptFriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(403);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('recipient');
    });

    it('should reject accept by unrelated user', async () => {
      mockFirst.mockResolvedValueOnce({
        id: 1, requester_id: 3, addressee_id: 2, status: 'pending',
      });
      const response = await handleAcceptFriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(403);
    });

    it('should accept pending friend request as addressee', async () => {
      // User 1 is the addressee
      mockFirst.mockResolvedValueOnce({
        id: 1, requester_id: 2, addressee_id: 1, status: 'pending',
      });
      const response = await handleAcceptFriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(200);
      const data = await response.json() as { status: string };
      expect(data.status).toBe('accepted');
      // Verify the update SQL was called
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE friendships SET status')
      );
    });

    it('should handle database errors', async () => {
      mockFirst.mockRejectedValueOnce(new Error('DB error'));
      const originalConsoleError = console.error;
      console.error = jest.fn();
      const response = await handleAcceptFriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(500);
      console.error = originalConsoleError;
    });
  });

  // ===== POST /api/friends/:friendshipId/reject =====
  describe('handleRejectFriend', () => {
    it('should return 404 if friendship not found', async () => {
      mockFirst.mockResolvedValueOnce(null);
      const response = await handleRejectFriend(mockRequest, mockEnv, 99);
      expect(response.status).toBe(404);
    });

    it('should reject if friendship is not pending', async () => {
      mockFirst.mockResolvedValueOnce({
        id: 1, requester_id: 2, addressee_id: 1, status: 'accepted',
      });
      const response = await handleRejectFriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(400);
    });

    it('should reject reject by wrong user (requester, not addressee)', async () => {
      mockFirst.mockResolvedValueOnce({
        id: 1, requester_id: 1, addressee_id: 2, status: 'pending',
      });
      const response = await handleRejectFriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(403);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('recipient');
    });

    it('should reject reject by unrelated user', async () => {
      mockFirst.mockResolvedValueOnce({
        id: 1, requester_id: 3, addressee_id: 2, status: 'pending',
      });
      const response = await handleRejectFriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(403);
    });

    it('should delete pending friendship row on reject', async () => {
      // User 1 is the addressee
      mockFirst.mockResolvedValueOnce({
        id: 1, requester_id: 2, addressee_id: 1, status: 'pending',
      });
      const response = await handleRejectFriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(200);
      const data = await response.json() as { status: string };
      expect(data.status).toBe('rejected');
      // Verify delete SQL was called
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM friendships')
      );
    });

    it('should handle database errors', async () => {
      mockFirst.mockRejectedValueOnce(new Error('DB error'));
      const originalConsoleError = console.error;
      console.error = jest.fn();
      const response = await handleRejectFriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(500);
      console.error = originalConsoleError;
    });
  });

  // ===== DELETE /api/friends/:friendshipId =====
  describe('handleUnfriend', () => {
    it('should return 404 if friendship not found', async () => {
      mockFirst.mockResolvedValueOnce(null);
      const response = await handleUnfriend(mockRequest, mockEnv, 99);
      expect(response.status).toBe(404);
    });

    it('should reject if friendship is not accepted', async () => {
      mockFirst.mockResolvedValueOnce({
        id: 1, requester_id: 2, addressee_id: 1, status: 'pending',
      });
      const response = await handleUnfriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('not accepted');
    });

    it('should reject unfriend by unrelated user', async () => {
      mockFirst.mockResolvedValueOnce({
        id: 1, requester_id: 3, addressee_id: 4, status: 'accepted',
      });
      const response = await handleUnfriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(403);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('Not authorized');
    });

    it('should allow requester to unfriend', async () => {
      mockFirst.mockResolvedValueOnce({
        id: 1, requester_id: 1, addressee_id: 2, status: 'accepted',
      });
      const response = await handleUnfriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(200);
      const data = await response.json() as { status: string };
      expect(data.status).toBe('removed');
    });

    it('should allow addressee to unfriend', async () => {
      mockFirst.mockResolvedValueOnce({
        id: 1, requester_id: 2, addressee_id: 1, status: 'accepted',
      });
      const response = await handleUnfriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(200);
      const data = await response.json() as { status: string };
      expect(data.status).toBe('removed');
    });

    it('should handle database errors', async () => {
      mockFirst.mockRejectedValueOnce(new Error('DB error'));
      const originalConsoleError = console.error;
      console.error = jest.fn();
      const response = await handleUnfriend(mockRequest, mockEnv, 1);
      expect(response.status).toBe(500);
      console.error = originalConsoleError;
    });
  });

  // ===== handleGetFriendProfile tests =====
  describe('handleGetFriendProfile', () => {
    it('should return 401 for unauthenticated request', async () => {
      (validateSession as jest.Mock).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      });
      const response = await handleGetFriendProfile(mockRequest, mockEnv, 2);
      expect(response.status).toBe(401);
    });

    it('should return 404 when users are not friends', async () => {
      // No friendship found
      mockFirst.mockResolvedValueOnce(null);
      const response = await handleGetFriendProfile(mockRequest, mockEnv, 2);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('User not found or not a friend');
    });

    it('should return 404 when target user does not exist', async () => {
      // Friendship exists
      mockFirst.mockResolvedValueOnce({ id: 10 });
      // User not found
      mockFirst.mockResolvedValueOnce(null);
      const response = await handleGetFriendProfile(mockRequest, mockEnv, 999);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('User not found or not a friend');
    });

    it('should return 200 with correct profile shape for valid friend', async () => {
      // Friendship exists
      mockFirst.mockResolvedValueOnce({ id: 10 });
      // User found
      mockFirst.mockResolvedValueOnce({ username: 'alice', avatar_id: 'gandalf-grey', created_at: '2024-01-01T00:00:00Z' });
      // Goals
      mockAll.mockResolvedValueOnce({
        results: [
          { id: 1, distance: 50, title: 'Bag End' },
          { id: 2, distance: 200, title: 'Rivendell' },
          { id: 3, distance: 500, title: 'Moria' },
        ],
      });
      // Fellowships
      mockAll.mockResolvedValueOnce({ results: [] });

      (calculateTotalDistance as jest.Mock).mockResolvedValue(100.50);

      const response = await handleGetFriendProfile(mockRequest, mockEnv, 2);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.username).toBe('alice');
      expect(data.avatar_id).toBe('gandalf-grey');
      expect(data.total_distance).toBe(100.50);
      expect(data.member_since).toBe('2024-01-01T00:00:00Z');
      expect(data.current_goal_title).toBe('Rivendell'); // next goal after 100.50
      expect(data.friendship_id).toBe(10);
      expect(data.fellowships).toEqual([]);
    });

    it('should include shared fellowship decoration', async () => {
      // Friendship exists
      mockFirst.mockResolvedValueOnce({ id: 10 });
      // User found
      mockFirst.mockResolvedValueOnce({ username: 'bob', avatar_id: null, created_at: '2024-06-15T00:00:00Z' });
      // Goals
      mockAll.mockResolvedValueOnce({
        results: [{ id: 1, distance: 50, title: 'Bag End' }],
      });
      // Fellowships with is_shared decoration
      mockAll.mockResolvedValueOnce({
        results: [
          { id: 1, name: 'The Fellowship', is_shared: 1 },
          { id: 2, name: 'Solo Quest', is_shared: 0 },
        ],
      });

      const response = await handleGetFriendProfile(mockRequest, mockEnv, 3);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fellowships).toEqual([
        { id: 1, name: 'The Fellowship', is_shared: true },
        { id: 2, name: 'Solo Quest', is_shared: false },
      ]);
    });

    it('should return empty fellowships array when friend has no fellowships', async () => {
      // Friendship exists
      mockFirst.mockResolvedValueOnce({ id: 10 });
      // User found
      mockFirst.mockResolvedValueOnce({ username: 'carol', avatar_id: null, created_at: '2024-01-01T00:00:00Z' });
      // Goals
      mockAll.mockResolvedValueOnce({
        results: [{ id: 1, distance: 50, title: 'Bag End' }],
      });
      // No fellowships
      mockAll.mockResolvedValueOnce({ results: [] });

      const response = await handleGetFriendProfile(mockRequest, mockEnv, 4);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fellowships).toEqual([]);
    });

    it('should return total_distance 0 when friend has no progress', async () => {
      // Friendship exists
      mockFirst.mockResolvedValueOnce({ id: 10 });
      // User found
      mockFirst.mockResolvedValueOnce({ username: 'dave', avatar_id: null, created_at: '2024-01-01T00:00:00Z' });

      (calculateTotalDistance as jest.Mock).mockResolvedValue(0);

      // Goals
      mockAll.mockResolvedValueOnce({
        results: [{ id: 1, distance: 50, title: 'Bag End' }],
      });
      // No fellowships
      mockAll.mockResolvedValueOnce({ results: [] });

      const response = await handleGetFriendProfile(mockRequest, mockEnv, 5);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.total_distance).toBe(0);
      expect(data.current_goal_title).toBe('Bag End');
    });

    it('should return last goal title when all goals are passed', async () => {
      // Friendship exists
      mockFirst.mockResolvedValueOnce({ id: 10 });
      // User found
      mockFirst.mockResolvedValueOnce({ username: 'eve', avatar_id: null, created_at: '2024-01-01T00:00:00Z' });

      (calculateTotalDistance as jest.Mock).mockResolvedValue(99999);

      // Goals
      mockAll.mockResolvedValueOnce({
        results: [
          { id: 1, distance: 50, title: 'Bag End' },
          { id: 2, distance: 200, title: 'Rivendell' },
          { id: 3, distance: 500, title: 'Moria' },
        ],
      });
      // No fellowships
      mockAll.mockResolvedValueOnce({ results: [] });

      const response = await handleGetFriendProfile(mockRequest, mockEnv, 6);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.current_goal_title).toBe('Moria'); // last goal
    });

    it('should handle database errors', async () => {
      mockFirst.mockRejectedValueOnce(new Error('DB error'));
      const originalConsoleError = console.error;
      console.error = jest.fn();
      const response = await handleGetFriendProfile(mockRequest, mockEnv, 2);
      expect(response.status).toBe(500);
      console.error = originalConsoleError;
    });
  });
});
