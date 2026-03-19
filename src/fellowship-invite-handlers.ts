// Fellowship Invite API handlers
import { validateSession } from './auth-handlers';
import type { DbClient } from './db';
import { calculateTotalDistance } from './goals-handlers';
import { createErrorResponse, createSuccessResponse } from './validators';

/** D1 result row for fellowship_invites table */
interface InviteRow {
  id: number;
  party_id: number;
  inviter_id: number;
  invitee_id: number;
  status: string;
  created_at: string;
}

/** D1 result row for party lookup */
interface PartyRow {
  id: number;
  name: string;
  dissolved_at: string | null;
  distance_mode: string;
}

/** D1 result row for the pending invite list query (includes inline total_distance) */
interface PendingInviteRow {
  id: number;
  party_id: number;
  party_name: string;
  distance_mode: string;
  member_count: number;
  total_distance: number;
  inviter_username: string;
  created_at: string;
}

/**
 * POST /api/party/:id/invite-friend — Invite an accepted friend to a party.
 *
 * Request body: { user_id: number }
 * Validates: inviter membership, friendship acceptance, target existence,
 * active-membership absence, no duplicate pending invite, party not dissolved.
 */
export async function handleInviteFriend(
  request: Request,
  db: DbClient,
  partyId: number,
  body: Record<string, unknown>,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
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

  // Cannot invite yourself
  if (targetUserId === userId) {
    return createErrorResponse('Cannot invite yourself', 400);
  }

  try {
    // Verify party exists and is not dissolved
    const party = await db.read.prepare(
      'SELECT id, name, dissolved_at FROM parties WHERE id = ?'
    ).bind(partyId).first<Pick<PartyRow, 'id' | 'name' | 'dissolved_at'>>();

    if (!party) {
      return createErrorResponse('Party not found', 404);
    }

    if (party.dissolved_at !== null) {
      return createErrorResponse('This party has been dissolved', 400);
    }

    // Verify inviter is an active party member
    const inviterMembership = await db.read.prepare(
      'SELECT id FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?'
    ).bind(partyId, userId, 'active').first<{ id: number }>();

    if (!inviterMembership) {
      return createErrorResponse('You are not an active member of this party', 403);
    }

    // Verify target user exists
    const targetUser = await db.read.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(targetUserId).first<{ id: number }>();

    if (!targetUser) {
      return createErrorResponse('User not found', 404);
    }

    // Verify accepted friendship (bidirectional check)
    const friendship = await db.read.prepare(`
      SELECT id FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = ? AND addressee_id = ?)
          OR (requester_id = ? AND addressee_id = ?))
    `).bind(userId, targetUserId, targetUserId, userId).first<{ id: number }>();

    if (!friendship) {
      return createErrorResponse('You can only invite accepted friends', 403);
    }

    // Verify target is not already an active member
    const targetMembership = await db.read.prepare(
      'SELECT id FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?'
    ).bind(partyId, targetUserId, 'active').first<{ id: number }>();

    if (targetMembership) {
      return createErrorResponse('User is already an active member of this party', 400);
    }

    // Check for duplicate pending invite (partial unique index also guards this)
    const existingInvite = await db.read.prepare(
      'SELECT id FROM fellowship_invites WHERE party_id = ? AND invitee_id = ? AND status = ?'
    ).bind(partyId, targetUserId, 'pending').first<{ id: number }>();

    if (existingInvite) {
      return createErrorResponse('A pending invite already exists for this user', 400);
    }

    // Create the invite
    const result = await db.write.prepare('INSERT INTO fellowship_invites (party_id, inviter_id, invitee_id, status) VALUES (?, ?, ?, ?)'
    ).bind(partyId, userId, targetUserId, 'pending').run();

    return createSuccessResponse({
      id: result.meta.last_row_id,
      party_id: partyId,
      party_name: party.name,
      invitee_id: targetUserId,
      status: 'pending',
    }, 201);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return createErrorResponse('A pending invite already exists for this user', 409);
    }
    console.error('Error creating fellowship invite:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * GET /api/user/fellowship-invites — List pending fellowship invites for the current user.
 *
 * Returns pending incoming invites with party preview data (member_count, total_distance).
 * Dissolved parties are excluded. Uses the same active-member and contribution semantics
 * as handlePartyProgress for total_distance.
 */
export async function handleGetFellowshipInvites(
  request: Request,
  db: DbClient,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    const { results } = await db.read.prepare(`
      SELECT
        fi.id,
        fi.party_id,
        p.name as party_name,
        p.distance_mode,
        (SELECT COUNT(*) FROM party_members pm WHERE pm.party_id = fi.party_id AND pm.status = 'active') as member_count,
        COALESCE(
          (SELECT
            SUM(
              CASE WHEN p.distance_mode = 'incremental'
                THEN MAX(0, COALESCE((SELECT SUM(pr.distance) FROM progress pr WHERE pr.user_id = pm2.user_id), 0) - pm2.distance_at_join)
                ELSE COALESCE((SELECT SUM(pr.distance) FROM progress pr WHERE pr.user_id = pm2.user_id), 0)
              END
            )
          FROM party_members pm2
          WHERE pm2.party_id = fi.party_id AND pm2.status = 'active'), 0)
        + COALESCE(
          (SELECT SUM(pm3.contribution_at_departure)
          FROM party_members pm3
          WHERE pm3.party_id = fi.party_id AND pm3.status IN ('left', 'kicked') AND pm3.distance_kept = 1), 0)
        as total_distance,
        u.username as inviter_username,
        fi.created_at
      FROM fellowship_invites fi
      JOIN parties p ON p.id = fi.party_id
      JOIN users u ON u.id = fi.inviter_id
      WHERE fi.invitee_id = ?
        AND fi.status = 'pending'
        AND p.dissolved_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM party_members pm_check WHERE pm_check.party_id = fi.party_id AND pm_check.user_id = fi.invitee_id AND pm_check.status = 'active')
      ORDER BY fi.created_at DESC
    `).bind(userId).all<PendingInviteRow>();

    const invites = results.map(row => ({
      id: row.id,
      party_id: row.party_id,
      party_name: row.party_name,
      member_count: row.member_count,
      total_distance: Number(Number(row.total_distance).toFixed(2)),
      inviter_username: row.inviter_username,
      created_at: row.created_at,
    }));

    return createSuccessResponse({
      invites,
      count: invites.length,
    });
  } catch (error) {
    console.error('Error fetching fellowship invites:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * POST /api/user/fellowship-invites/:inviteId/accept — Accept a fellowship invite.
 *
 * Validates invite ownership and pending status, then reuses the same membership
 * behavior as handleJoinParty: fresh join creates active row, re-join reactivates
 * inactive row with reset fields. distance_at_join, last_viewed_distance, and role
 * follow the existing join-party semantics exactly.
 */
export async function handleAcceptFellowshipInvite(
  request: Request,
  db: DbClient,
  inviteId: number,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    // Look up the invite
    const invite = await db.read.prepare(
      'SELECT id, party_id, inviter_id, invitee_id, status FROM fellowship_invites WHERE id = ?'
    ).bind(inviteId).first<Pick<InviteRow, 'id' | 'party_id' | 'inviter_id' | 'invitee_id' | 'status'>>();

    if (!invite) {
      return createErrorResponse('Invite not found', 404);
    }

    if (invite.invitee_id !== userId) {
      return createErrorResponse('Only the invitee can accept this invite', 403);
    }

    if (invite.status !== 'pending') {
      return createErrorResponse('Invite is not pending', 400);
    }

    // Verify party is not dissolved
    const party = await db.read.prepare(
      'SELECT id, name, dissolved_at FROM parties WHERE id = ?'
    ).bind(invite.party_id).first<Pick<PartyRow, 'id' | 'name' | 'dissolved_at'>>();

    if (!party) {
      return createErrorResponse('Party not found', 404);
    }

    if (party.dissolved_at !== null) {
      return createErrorResponse('This party has been dissolved', 400);
    }

    // === Reuse handleJoinParty join semantics ===
    // Check for existing membership (any status)
    const existingMember = await db.read.prepare(
      'SELECT id, status FROM party_members WHERE party_id = ? AND user_id = ?'
    ).bind(invite.party_id, userId).first<{ id: number; status: string }>();

    if (existingMember) {
      if (existingMember.status === 'active') {
        return createErrorResponse('You are already an active member of this party', 400);
      }

      // Re-join: reactivate existing record (role resets to 'member')
      const totalDistance = await calculateTotalDistance(db, userId);
      const updateMemberStmt = db.write.prepare(
        `UPDATE party_members 
         SET status = 'active', 
             joined_at = CURRENT_TIMESTAMP, 
             distance_at_join = ?, 
             last_viewed_distance = 0, 
             departed_at = NULL, 
             distance_kept = NULL, 
             contribution_at_departure = NULL,
             role = 'member'
         WHERE id = ?`
      ).bind(totalDistance, existingMember.id);

      const updateInviteStmt = db.write.prepare('UPDATE fellowship_invites SET status = ? WHERE id = ? AND status = ?'
      ).bind('accepted', inviteId, 'pending');

      const [, inviteResult] = await db.write.batch([updateMemberStmt, updateInviteStmt]);

      if (!inviteResult.meta.changes) {
        return createErrorResponse('Invite is no longer pending', 409);
      }

      return createSuccessResponse({
        party_id: party.id,
        party_name: party.name,
        rejoined: true,
      });
    }

    // Fresh join: insert new membership
    const totalDistance = await calculateTotalDistance(db, userId);
    try {
      const insertMemberStmt = db.write.prepare('INSERT INTO party_members (party_id, user_id, role, distance_at_join, last_viewed_distance, status) VALUES (?, ?, ?, ?, 0, ?)'
      ).bind(invite.party_id, userId, 'member', totalDistance, 'active');

      const updateInviteStmt = db.write.prepare('UPDATE fellowship_invites SET status = ? WHERE id = ? AND status = ?'
      ).bind('accepted', inviteId, 'pending');

      const [, inviteResult] = await db.write.batch([insertMemberStmt, updateInviteStmt]);

      if (!inviteResult.meta.changes) {
        return createErrorResponse('Invite is no longer pending', 409);
      }
    } catch (insertError: unknown) {
      const message = insertError instanceof Error ? insertError.message : String(insertError);
      if (message.includes('UNIQUE constraint failed') && message.includes('party_members')) {
        return createErrorResponse('You are already an active member of this party', 400);
      }
      throw insertError;
    }

    return createSuccessResponse({
      party_id: party.id,
      party_name: party.name,
      rejoined: false,
    });
  } catch (error) {
    console.error('Error accepting fellowship invite:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * POST /api/user/fellowship-invites/:inviteId/reject — Reject a fellowship invite.
 *
 * Only the invitee can reject. Sets status to 'rejected', removing it from
 * pending-invite surfaces. The rejected row remains to support future re-invite.
 */
export async function handleRejectFellowshipInvite(
  request: Request,
  db: DbClient,
  inviteId: number,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    const invite = await db.read.prepare(
      'SELECT id, party_id, inviter_id, invitee_id, status FROM fellowship_invites WHERE id = ?'
    ).bind(inviteId).first<Pick<InviteRow, 'id' | 'party_id' | 'inviter_id' | 'invitee_id' | 'status'>>();

    if (!invite) {
      return createErrorResponse('Invite not found', 404);
    }

    if (invite.invitee_id !== userId) {
      return createErrorResponse('Only the invitee can reject this invite', 403);
    }

    if (invite.status !== 'pending') {
      return createErrorResponse('Invite is not pending', 400);
    }

    await db.write.prepare('UPDATE fellowship_invites SET status = ? WHERE id = ?'
    ).bind('rejected', inviteId).run();

    return createSuccessResponse({ status: 'rejected' });
  } catch (error) {
    console.error('Error rejecting fellowship invite:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
