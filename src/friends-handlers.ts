// Friends (Social) API handlers
import { validateSession } from './auth-handlers';
import { createErrorResponse, createSuccessResponse } from './validators';

/** Maximum number of pending outgoing friend requests per user */
const MAX_PENDING_OUTGOING = 20;

/** Minimum length for username search query */
const MIN_SEARCH_LENGTH = 3;

/** Maximum results for username search */
const MAX_SEARCH_RESULTS = 10;

/** D1 result row for accepted friends list */
interface FriendRow {
  id: number;
  username: string;
  avatar_id: string | null;
  last_progressed: string | null;
}

/** D1 result row for pending friends list */
interface PendingFriendRow {
  id: number;
  username: string;
  avatar_id: string | null;
  created_at: string;
}

/** D1 result row for friend search */
interface SearchResultRow {
  id: number;
  username: string;
  avatar_id: string | null;
  friendship_status: string | null;
}

/** D1 result row for friend code resolution */
interface ResolveRow {
  id: number;
  username: string;
  avatar_id: string | null;
}

/** D1 result row for friendship record */
interface FriendshipRow {
  id: number;
  requester_id: number;
  addressee_id: number;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Escape special LIKE wildcard characters for safe prefix search.
 * Mirrors the pattern in admin-handlers.ts.
 */
function escapeLikeSearch(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * GET /api/friends — List accepted friends for the current user.
 *
 * Returns friends with { id, username, avatar_id, last_progressed }.
 * Uses a grouped SQL subquery to avoid N+1 for last_progressed.
 */
export async function handleGetFriends(request: Request, env: { DB: D1Database }): Promise<Response> {
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    const { results } = await env.DB.prepare(`
      SELECT
        u.id,
        u.username,
        u.avatar_id,
        lp.last_progressed
      FROM friendships f
      JOIN users u ON u.id = CASE
        WHEN f.requester_id = ? THEN f.addressee_id
        ELSE f.requester_id
      END
      LEFT JOIN (
        SELECT user_id, MAX(date) as last_progressed
        FROM progress
        GROUP BY user_id
      ) lp ON lp.user_id = u.id
      WHERE f.status = 'accepted'
        AND (f.requester_id = ? OR f.addressee_id = ?)
      ORDER BY u.username COLLATE NOCASE ASC
    `).bind(userId, userId, userId).all<FriendRow>();

    return createSuccessResponse({ friends: results });
  } catch (error) {
    console.error('Error fetching friends list:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * GET /api/friends/pending — List incoming pending friend requests.
 *
 * Returns pending requests where the current user is the addressee,
 * with { id, username, avatar_id, created_at } and a count.
 */
export async function handleGetPendingFriends(request: Request, env: { DB: D1Database }): Promise<Response> {
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    const { results } = await env.DB.prepare(`
      SELECT
        f.id,
        u.username,
        u.avatar_id,
        f.created_at
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = ?
        AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `).bind(userId).all<PendingFriendRow>();

    return createSuccessResponse({
      pending: results,
      count: results.length
    });
  } catch (error) {
    console.error('Error fetching pending friends:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * GET /api/friends/search?q=<username> — Search users by username prefix.
 *
 * Minimum 3 characters, limit 10 results, excludes current user.
 * Returns { id, username, avatar_id, friendship_status } where status is null, 'pending', or 'accepted'.
 */
export async function handleSearchUsers(request: Request, env: { DB: D1Database }): Promise<Response> {
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query || query.trim().length < MIN_SEARCH_LENGTH) {
    return createErrorResponse('Search query must be at least 3 characters', 400);
  }

  const trimmedQuery = query.trim();

  try {
    const escapedQuery = `${escapeLikeSearch(trimmedQuery)}%`;

    const { results } = await env.DB.prepare(`
      SELECT DISTINCT
        u.id,
        u.username,
        u.avatar_id,
        CASE
          WHEN f.status IS NOT NULL THEN f.status
          ELSE NULL
        END as friendship_status
      FROM users u
      LEFT JOIN friendships f ON (
        (f.requester_id = ? AND f.addressee_id = u.id)
        OR (f.addressee_id = ? AND f.requester_id = u.id)
      )
      WHERE u.username LIKE ? ESCAPE '\\'
        AND u.id != ?
      ORDER BY u.username COLLATE NOCASE ASC
      LIMIT ?
    `).bind(userId, userId, escapedQuery, userId, MAX_SEARCH_RESULTS).all<SearchResultRow>();

    return createSuccessResponse({ results });
  } catch (error) {
    console.error('Error searching users:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * GET /api/friends/resolve/:friendCode — Resolve a friend code to user info.
 *
 * Returns { username, avatar_id } or 404 if code not found.
 */
export async function handleResolveFriendCode(request: Request, env: { DB: D1Database }, friendCode: string): Promise<Response> {
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }

  if (!friendCode || friendCode.length !== 8 || !/^[A-Za-z0-9]{8}$/.test(friendCode)) {
    return createErrorResponse('Invalid friend code format', 400);
  }

  try {
    const user = await env.DB.prepare(
      'SELECT id, username, avatar_id FROM users WHERE friend_code = ?'
    ).bind(friendCode).first<ResolveRow>();

    if (!user) {
      return createErrorResponse('Friend code not found', 404);
    }

    return createSuccessResponse({
      id: user.id,
      username: user.username,
      avatar_id: user.avatar_id
    });
  } catch (error) {
    console.error('Error resolving friend code:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * Shared logic for creating a friend request given a resolved target user ID.
 * Used by both request-by-user_id and request-by-friend_code flows.
 */
async function createFriendRequest(
  env: { DB: D1Database },
  requesterId: number,
  targetUserId: number
): Promise<Response> {
  // Self-friend check
  if (requesterId === targetUserId) {
    return createErrorResponse('Cannot send a friend request to yourself', 400);
  }

  try {
    // Verify target user exists
    const targetUser = await env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(targetUserId).first();

    if (!targetUser) {
      return createErrorResponse('User not found', 404);
    }

    // Check for existing friendship in either direction
    const existing = await env.DB.prepare(`
      SELECT id, status FROM friendships
      WHERE (requester_id = ? AND addressee_id = ?)
         OR (requester_id = ? AND addressee_id = ?)
    `).bind(requesterId, targetUserId, targetUserId, requesterId).first<FriendshipRow>();

    if (existing) {
      if (existing.status === 'accepted') {
        return createErrorResponse('Already friends with this user', 400);
      }
      return createErrorResponse('A pending friend request already exists', 400);
    }

    // Rate limit: max 20 pending outgoing requests
    const pendingCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM friendships WHERE requester_id = ? AND status = ?'
    ).bind(requesterId, 'pending').first<{ count: number }>();

    if (pendingCount && pendingCount.count >= MAX_PENDING_OUTGOING) {
      return createErrorResponse('Too many pending friend requests. Please wait for some to be accepted or rejected.', 429);
    }

    // Create the friend request
    const result = await env.DB.prepare(
      'INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, ?)'
    ).bind(requesterId, targetUserId, 'pending').run();

    return createSuccessResponse({
      friendship_id: result.meta.last_row_id,
      status: 'pending'
    }, 201);
  } catch (error: unknown) {
    // Handle UNIQUE constraint violation from concurrent duplicate requests
    if (
      error instanceof Error &&
      error.message.includes('UNIQUE constraint failed')
    ) {
      return createErrorResponse('Friend request already exists', 409);
    }
    console.error('Error creating friend request:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * POST /api/friends/request — Create a friend request by user_id.
 *
 * Request body: { user_id: number }
 */
export async function handleFriendRequest(request: Request, env: { DB: D1Database }, body: Record<string, unknown>): Promise<Response> {
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  const { user_id: targetUserId } = body || {};

  if (targetUserId === undefined || targetUserId === null) {
    return createErrorResponse('Missing required field: user_id', 400);
  }

  if (typeof targetUserId !== 'number' || !Number.isInteger(targetUserId) || targetUserId <= 0) {
    return createErrorResponse('Invalid user_id', 400);
  }

  return createFriendRequest(env, userId, targetUserId);
}

/**
 * POST /api/friends/request/code — Create a friend request by friend_code.
 *
 * Request body: { friend_code: string }
 */
export async function handleFriendRequestByCode(request: Request, env: { DB: D1Database }, body: Record<string, unknown>): Promise<Response> {
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  const { friend_code: friendCode } = body || {};

  if (!friendCode || typeof friendCode !== 'string') {
    return createErrorResponse('Missing required field: friend_code', 400);
  }

  if (friendCode.length !== 8 || !/^[A-Za-z0-9]{8}$/.test(friendCode)) {
    return createErrorResponse('Invalid friend code format', 400);
  }

  try {
    // Resolve friend code to user
    const targetUser = await env.DB.prepare(
      'SELECT id FROM users WHERE friend_code = ?'
    ).bind(friendCode).first<{ id: number }>();

    if (!targetUser) {
      return createErrorResponse('Friend code not found', 404);
    }

    return createFriendRequest(env, userId, targetUser.id);
  } catch (error) {
    console.error('Error creating friend request by code:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * POST /api/friends/:friendshipId/accept — Accept a pending friend request.
 *
 * Only the addressee can accept. Transitions status from 'pending' to 'accepted'.
 */
export async function handleAcceptFriend(request: Request, env: { DB: D1Database }, friendshipId: number): Promise<Response> {
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    const friendship = await env.DB.prepare(
      'SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = ?'
    ).bind(friendshipId).first<FriendshipRow>();

    if (!friendship) {
      return createErrorResponse('Friendship not found', 404);
    }

    if (friendship.status !== 'pending') {
      return createErrorResponse('Friendship is not pending', 400);
    }

    if (friendship.addressee_id !== userId) {
      return createErrorResponse('Only the recipient can accept a friend request', 403);
    }

    await env.DB.prepare(
      'UPDATE friendships SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind('accepted', friendshipId).run();

    return createSuccessResponse({ status: 'accepted' });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * POST /api/friends/:friendshipId/reject — Reject a pending friend request.
 *
 * Only the addressee can reject. Deletes the pending row.
 */
export async function handleRejectFriend(request: Request, env: { DB: D1Database }, friendshipId: number): Promise<Response> {
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    const friendship = await env.DB.prepare(
      'SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = ?'
    ).bind(friendshipId).first<FriendshipRow>();

    if (!friendship) {
      return createErrorResponse('Friendship not found', 404);
    }

    if (friendship.status !== 'pending') {
      return createErrorResponse('Friendship is not pending', 400);
    }

    if (friendship.addressee_id !== userId) {
      return createErrorResponse('Only the recipient can reject a friend request', 403);
    }

    await env.DB.prepare(
      'DELETE FROM friendships WHERE id = ?'
    ).bind(friendshipId).run();

    return createSuccessResponse({ status: 'rejected' });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * DELETE /api/friends/:friendshipId — Remove an accepted friendship (unfriend).
 *
 * Either party can unfriend. Deletes the accepted friendship row.
 */
export async function handleUnfriend(request: Request, env: { DB: D1Database }, friendshipId: number): Promise<Response> {
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    const friendship = await env.DB.prepare(
      'SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = ?'
    ).bind(friendshipId).first<FriendshipRow>();

    if (!friendship) {
      return createErrorResponse('Friendship not found', 404);
    }

    if (friendship.status !== 'accepted') {
      return createErrorResponse('Friendship is not accepted', 400);
    }

    if (friendship.requester_id !== userId && friendship.addressee_id !== userId) {
      return createErrorResponse('Not authorized to remove this friendship', 403);
    }

    await env.DB.prepare(
      'DELETE FROM friendships WHERE id = ?'
    ).bind(friendshipId).run();

    return createSuccessResponse({ status: 'removed' });
  } catch (error) {
    console.error('Error removing friendship:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
