// Party (Fellowship) API handlers
import { validateSession } from "./auth-handlers";
import { generateAlphanumericCode } from "./auth-utils";
import { isValidAvatarSlug } from "./avatar-slugs";
import { calculateTotalDistance } from "./goals-handlers";
import { createErrorResponse, createSuccessResponse } from "./validators";
import type { DbClient } from './db';

/** Palette size for deterministic member color assignment */
const COLOR_PALETTE_SIZE = 12;

/** D1 result row for goals table */
interface GoalRow {
  id: number;
  title: string;
  distance: number;
  description?: string | null;
  image_id?: string | null;
  special?: string | null;
}

/** D1 result row for parties table */
interface PartyRow {
  id: number;
  name: string;
  leader_id: number;
  created_at: string;
  invite_code: string;
  distance_mode: string;
  leave_distance_behavior: string;
  dissolved_at: string | null;
  avatar_id: string | null;
}

/** D1 result row for party_members table */
interface PartyMemberRow {
  id: number;
  party_id: number;
  user_id: number;
  joined_at: string;
  distance_at_join: number;
  role: string;
  status: string;
  last_viewed_distance: number;
  departed_at: string | null;
  distance_kept: number | null;
  contribution_at_departure: number | null;
}

/**
 * Generate a cryptographically secure 8-character alphanumeric invite code.
 * Uses crypto.getRandomValues() for non-enumerable codes.
 */
export function generateInviteCode(): string {
  return generateAlphanumericCode();
}

/**
 * POST /api/party — Create a new Fellowship (party).
 *
 * Request body: { name: string, distance_mode?: 'cumulative' | 'incremental', leave_distance_behavior?: 'keep' | 'remove' }
 * Returns the created party details including invite code and configured settings.
 */
export async function handleCreateParty(request: Request, db: DbClient, body: Record<string, unknown>, allowTestAuth?: string): Promise<Response> {
  // Validate session
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  const { name, distance_mode, leave_distance_behavior } = body || {};

  // Validate name: required, string, max 50 chars
  if (!name || typeof name !== 'string') {
    return createErrorResponse('Missing required field: name', 400);
  }
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return createErrorResponse('Missing required field: name', 400);
  }
  if (trimmedName.length > 50) {
    return createErrorResponse('Name must be 50 characters or less', 400);
  }

  // Validate distance_mode (optional, defaults to 'incremental')
  const validDistanceModes = ['cumulative', 'incremental'];
  const resolvedDistanceMode = distance_mode ?? 'incremental';
  if (typeof resolvedDistanceMode !== 'string' || !validDistanceModes.includes(resolvedDistanceMode)) {
    return createErrorResponse("Invalid distance_mode. Must be 'cumulative' or 'incremental'", 400);
  }

  // Validate leave_distance_behavior (optional, defaults to 'keep')
  const validLeaveBehaviors = ['keep', 'remove'];
  const resolvedLeaveBehavior = leave_distance_behavior ?? 'keep';
  if (typeof resolvedLeaveBehavior !== 'string' || !validLeaveBehaviors.includes(resolvedLeaveBehavior)) {
    return createErrorResponse("Invalid leave_distance_behavior. Must be 'keep' or 'remove'", 400);
  }

  try {
    // Get user's current total distance for distance_at_join
    const totalDistance = await calculateTotalDistance(db, userId);

    const maxRetries = 5;

    // Retry party creation on invite_code UNIQUE constraint violations
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Generate invite code with retry for obvious (pre-insert) uniqueness conflicts
      let inviteCode = generateInviteCode();
      const maxCodeGenRetries = 5;
      for (let codeAttempt = 0; codeAttempt < maxCodeGenRetries; codeAttempt++) {
        const existing = await db.read.prepare(
          'SELECT id FROM parties WHERE invite_code = ?'
        ).bind(inviteCode).first();
        if (!existing) break;
        inviteCode = generateInviteCode();
        if (codeAttempt === maxCodeGenRetries - 1) {
          return createErrorResponse('Failed to generate unique invite code. Please try again.', 500);
        }
      }

      // Use D1 batch for atomic party + member creation
      const insertPartyStmt = db.write.prepare(
        'INSERT INTO parties (name, leader_id, invite_code, distance_mode, leave_distance_behavior) VALUES (?, ?, ?, ?, ?)'
      ).bind(trimmedName, userId, inviteCode, resolvedDistanceMode, resolvedLeaveBehavior);

      // Use subquery to reference the party by invite_code so both inserts are in one atomic batch
      const insertMemberStmt = db.write.prepare(
        'INSERT INTO party_members (party_id, user_id, role, distance_at_join, last_viewed_distance, status) VALUES ((SELECT id FROM parties WHERE invite_code = ?), ?, ?, ?, 0, ?)'
      ).bind(inviteCode, userId, 'leader', totalDistance, 'active');

      try {
        const batchResults = await db.write.batch([insertPartyStmt, insertMemberStmt]);

        // Get the newly created party ID from the first batch result
        const partyId = batchResults[0].meta.last_row_id;

        // Fetch the created party to return full details
        const party = await db.read.prepare(
          'SELECT id, name, leader_id, created_at, invite_code, distance_mode, leave_distance_behavior FROM parties WHERE id = ?'
        ).bind(partyId).first<PartyRow>();

        if (!party) {
          return createErrorResponse('Failed to retrieve created party', 500);
        }

        return createSuccessResponse({
          id: party.id,
          name: party.name,
          leader_id: party.leader_id,
          created_at: party.created_at,
          invite_code: party.invite_code,
          distance_mode: party.distance_mode,
          leave_distance_behavior: party.leave_distance_behavior,
        }, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isInviteCodeUniqueViolation =
          message.includes('UNIQUE constraint failed') &&
          message.includes('parties.invite_code');

        if (isInviteCodeUniqueViolation) {
          if (attempt === maxRetries - 1) {
            console.error('Failed to create party due to repeated invite_code uniqueness violations:', error);
            return createErrorResponse('Could not generate a unique invite code. Please try again.', 409);
          }
          continue;
        }

        // Non-UNIQUE errors fall through to the outer catch
        throw error;
      }
    }

    // Should not reach here, but treat as server error if it does
    return createErrorResponse('Internal server error while creating party', 500);
  } catch (error: unknown) {
    console.error('Database error during party creation:', error);
    return createErrorResponse('Internal server error while creating party', 500);
  }
}

/** Validate invite code format: must be exactly 8 alphanumeric characters */
const INVITE_CODE_PATTERN = /^[A-Za-z0-9]{8}$/;

/**
 * GET /api/party/join/:inviteCode — Preview a party before joining.
 *
 * Public endpoint (no auth required) to support deep-link invite flow.
 * Returns party name, member count, distance_mode, leave_distance_behavior.
 * Returns 404 for invalid invite codes, 400 if party is dissolved.
 */
export async function handlePreviewParty(request: Request, db: DbClient, inviteCode: string): Promise<Response> {
  if (!INVITE_CODE_PATTERN.test(inviteCode)) {
    return createErrorResponse('Invalid invite code', 404);
  }

  try {
    const party = await db.read.prepare(
      'SELECT id, name, distance_mode, leave_distance_behavior, dissolved_at FROM parties WHERE invite_code = ?'
    ).bind(inviteCode).first<Pick<PartyRow, 'id' | 'name' | 'distance_mode' | 'leave_distance_behavior' | 'dissolved_at'>>();

    if (!party) {
      return createErrorResponse('Invalid invite code', 404);
    }

    if (party.dissolved_at !== null) {
      return createErrorResponse('This party has been dissolved', 400);
    }

    const memberCount = await db.read.prepare(
      'SELECT COUNT(*) as count FROM party_members WHERE party_id = ? AND status = ?'
    ).bind(party.id, 'active').first<{ count: number }>();

    return createSuccessResponse({
      name: party.name,
      member_count: memberCount?.count ?? 0,
      distance_mode: party.distance_mode,
      leave_distance_behavior: party.leave_distance_behavior,
    });
  } catch (error: unknown) {
    console.error('Database error during party preview:', error);
    return createErrorResponse('Internal server error while previewing party', 500);
  }
}

/**
 * POST /api/party/join/:inviteCode — Join a party via invite code.
 *
 * Requires authentication. Handles fresh joins and re-joins.
 * On join: records distance_at_join, last_viewed_distance = 0, departed_at = NULL.
 * Re-join: reactivates existing record with refreshed join fields.
 * Returns 404 for invalid codes, 400 for dissolved parties or duplicate active membership.
 */
export async function handleJoinParty(request: Request, db: DbClient, inviteCode: string, allowTestAuth?: string): Promise<Response> {
  if (!INVITE_CODE_PATTERN.test(inviteCode)) {
    return createErrorResponse('Invalid invite code', 404);
  }

  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    // Look up party by invite code
    const party = await db.read.prepare(
      'SELECT id, name, dissolved_at FROM parties WHERE invite_code = ?'
    ).bind(inviteCode).first<Pick<PartyRow, 'id' | 'name' | 'dissolved_at'>>();

    if (!party) {
      return createErrorResponse('Invalid invite code', 404);
    }

    if (party.dissolved_at !== null) {
      return createErrorResponse('This party has been dissolved', 400);
    }

    // Check for existing membership (any status)
    const existingMember = await db.read.prepare(
      'SELECT id, status FROM party_members WHERE party_id = ? AND user_id = ?'
    ).bind(party.id, userId).first<Pick<PartyMemberRow, 'id' | 'status'>>();

    if (existingMember) {
      if (existingMember.status === 'active') {
        return createErrorResponse('You are already an active member of this party', 400);
      }

      // Re-join: reactivate existing record (role resets to 'member' — leadership is not preserved across re-joins)
      const totalDistance = await calculateTotalDistance(db, userId);
      await db.write.prepare(
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
      ).bind(totalDistance, existingMember.id).run();

      return createSuccessResponse({
        party_id: party.id,
        party_name: party.name,
        rejoined: true,
      });
    }

    // Fresh join: insert new membership
    const totalDistance = await calculateTotalDistance(db, userId);
    try {
      await db.write.prepare(
        'INSERT INTO party_members (party_id, user_id, role, distance_at_join, last_viewed_distance, status) VALUES (?, ?, ?, ?, 0, ?)'
      ).bind(party.id, userId, 'member', totalDistance, 'active').run();
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
  } catch (error: unknown) {
    console.error('Database error during party join:', error);
    return createErrorResponse('Internal server error while joining party', 500);
  }
}

/**
 * POST /api/party/:id/invite — Regenerate invite code (leader only).
 *
 * Generates a new cryptographically secure invite code, invalidating the previous one.
 * Returns both the new inviteCode and the full inviteUrl.
 */
export async function handleRegenerateInvite(request: Request, db: DbClient, partyId: number, allowTestAuth?: string): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    // Verify user is the leader
    const party = await db.read.prepare(
      'SELECT id, leader_id, dissolved_at FROM parties WHERE id = ?'
    ).bind(partyId).first<Pick<PartyRow, 'id' | 'leader_id' | 'dissolved_at'>>();

    if (!party) {
      return createErrorResponse('Party not found', 404);
    }

    if (party.dissolved_at !== null) {
      return createErrorResponse('This party has been dissolved', 400);
    }

    if (party.leader_id !== userId) {
      return createErrorResponse('Only the party leader can regenerate the invite code', 403);
    }

    // Generate new invite code with retry logic
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const newCode = generateInviteCode();

      // Pre-check uniqueness
      const existing = await db.read.prepare(
        'SELECT id FROM parties WHERE invite_code = ?'
      ).bind(newCode).first();
      if (existing) continue;

      try {
        await db.write.prepare(
          'UPDATE parties SET invite_code = ? WHERE id = ?'
        ).bind(newCode, partyId).run();

        const origin = new URL(request.url).origin;
        return createSuccessResponse({
          inviteCode: newCode,
          inviteUrl: `${origin}/party/join/${newCode}`,
        });
      } catch (updateError) {
        const message = updateError instanceof Error ? updateError.message : String(updateError);
        if (message.includes('UNIQUE constraint failed') && message.includes('parties.invite_code')) {
          if (attempt === maxRetries - 1) {
            return createErrorResponse('Could not generate a unique invite code. Please try again.', 409);
          }
          continue;
        }
        throw updateError;
      }
    }

    return createErrorResponse('Could not generate a unique invite code. Please try again.', 409);
  } catch (error: unknown) {
    console.error('Database error during invite regeneration:', error);
    return createErrorResponse('Internal server error while regenerating invite code', 500);
  }
}

/**
 * GET /api/user/parties — List all party memberships for the current user.
 *
 * Returns active memberships by default (non-dissolved parties).
 * With ?include_dissolved=true, also returns dissolved parties.
 * Each result includes id, name, role, distance_mode, leave_distance_behavior, invite_code, leader_id, active_member_count, dissolved_at.
 */
export async function handleGetUserParties(request: Request, db: DbClient, allowTestAuth?: string): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  const url = new URL(request.url);
  const includeDissolved = url.searchParams.get('include_dissolved') === 'true';

  try {
    let query: string;
    if (includeDissolved) {
      query = `
        SELECT p.id, p.name, pm.role, p.distance_mode, p.leave_distance_behavior, p.dissolved_at,
               p.invite_code, p.leader_id, p.avatar_id,
               (SELECT COUNT(*) FROM party_members pm2 WHERE pm2.party_id = p.id AND pm2.status = 'active') as active_member_count
        FROM party_members pm
        JOIN parties p ON pm.party_id = p.id
        WHERE pm.user_id = ? AND pm.status = 'active'
      `;
    } else {
      query = `
        SELECT p.id, p.name, pm.role, p.distance_mode, p.leave_distance_behavior, p.dissolved_at,
               p.invite_code, p.leader_id, p.avatar_id,
               (SELECT COUNT(*) FROM party_members pm2 WHERE pm2.party_id = p.id AND pm2.status = 'active') as active_member_count
        FROM party_members pm
        JOIN parties p ON pm.party_id = p.id
        WHERE pm.user_id = ? AND pm.status = 'active' AND p.dissolved_at IS NULL
      `;
    }

    const { results } = await db.read.prepare(query).bind(userId).all();

    return createSuccessResponse({ parties: results });
  } catch (error: unknown) {
    console.error('Database error during user parties retrieval:', error);
    return createErrorResponse('Internal server error while retrieving parties', 500);
  }
}

/** Row shape for active member with joined distance data */
interface ActiveMemberDistanceRow {
  user_id: number;
  display_name: string;
  distance_at_join: number;
  total_distance: number;
  joined_at: string;
  avatar_id: string | null;
}

/** Row shape for departed member with kept contributions */
interface DepartedMemberRow {
  user_id: number;
  display_name: string;
  status: string;
  contribution_at_departure: number | null;
  joined_at: string;
  avatar_id: string | null;
}

/** Unified activity feed item with type discriminator */
interface UnifiedActivityRow {
  type: 'walk' | 'message';
  user_id: number;
  display_name: string;
  avatar_id: string | null;
  created_at: string;
  distance: number | null;
  date: string | null;
  content: string | null;
  message_id: number | null;
}

/**
 * GET /api/party/:id/progress — Get combined party progress.
 *
 * Returns total distance, member count, calculated position (latest milestone ≤ total),
 * per-member breakdown, and newly passed milestones since last view.
 * Updates last_viewed_distance for the requesting user.
 * Security: 401 if unauthenticated, 403 if not an active member, 404 if party not found/dissolved.
 */
export async function handlePartyProgress(request: Request, db: DbClient, partyId: number, allowTestAuth?: string): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    // Check party exists and is not dissolved
    const party = await db.read.prepare(
      'SELECT id, distance_mode, leave_distance_behavior, dissolved_at FROM parties WHERE id = ?'
    ).bind(partyId).first<Pick<PartyRow, 'id' | 'distance_mode' | 'leave_distance_behavior' | 'dissolved_at'>>();

    if (!party || party.dissolved_at !== null) {
      return createErrorResponse('Party not found', 404);
    }

    // Verify requesting user is an active member (IDOR prevention)
    const membership = await db.read.prepare(
      'SELECT id, last_viewed_distance FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?'
    ).bind(partyId, userId, 'active').first<Pick<PartyMemberRow, 'id' | 'last_viewed_distance'>>();

    if (!membership) {
      return createErrorResponse('You are not an active member of this party', 403);
    }

    const previousViewedDistance = membership.last_viewed_distance;

    // Get active members with their total distances
    const { results: activeMembers } = await db.read.prepare(
      `SELECT pm.user_id, u.username as display_name, pm.distance_at_join, pm.joined_at,
              u.avatar_id,
              COALESCE((SELECT SUM(p.distance) FROM progress p WHERE p.user_id = pm.user_id), 0) as total_distance
       FROM party_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.party_id = ? AND pm.status = ?
       ORDER BY pm.joined_at ASC, pm.user_id ASC`
    ).bind(partyId, 'active').all<ActiveMemberDistanceRow>();

    // Calculate active member contributions
    const members: Array<{
      user_id: number;
      display_name: string;
      contribution: number;
      joined_at: string;
      status: string;
      color: number;
      avatar_id: string | null;
    }> = [];

    let totalDistance = 0;

    for (const member of activeMembers) {
      let contribution: number;
      if (party.distance_mode === 'incremental') {
        contribution = Math.max(0, member.total_distance - member.distance_at_join);
      } else {
        contribution = member.total_distance;
      }
      totalDistance += contribution;
      members.push({
        user_id: member.user_id,
        display_name: member.display_name,
        contribution,
        joined_at: member.joined_at,
        status: 'active',
        color: member.user_id % COLOR_PALETTE_SIZE,
        avatar_id: member.avatar_id ?? null,
      });
    }

    // Handle departed members with kept contributions
    const { results: departedMembers } = await db.read.prepare(
      `SELECT pm.user_id, u.username as display_name, pm.status, pm.contribution_at_departure, pm.joined_at,
              u.avatar_id
       FROM party_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.party_id = ? AND pm.status IN ('left', 'kicked') AND pm.distance_kept = 1
       ORDER BY pm.joined_at ASC, pm.user_id ASC`
    ).bind(partyId).all<DepartedMemberRow>();

    for (const departed of departedMembers) {
      const contribution = departed.contribution_at_departure ?? 0;
      totalDistance += contribution;
      members.push({
        user_id: departed.user_id,
        display_name: departed.display_name,
        contribution,
        joined_at: departed.joined_at,
        status: departed.status,
        color: departed.user_id % COLOR_PALETTE_SIZE,
        avatar_id: departed.avatar_id ?? null,
      });
    }

    // Round to 2 decimal places to avoid floating point drift
    totalDistance = Number(totalDistance.toFixed(2));

    // Calculate milestone position (latest milestone ≤ total_distance)
    const calculatedPosition = await db.read.prepare(
      'SELECT id, title, distance, description, image_id, special FROM goals WHERE distance <= ? ORDER BY distance DESC LIMIT 1'
    ).bind(totalDistance).first<GoalRow>();

    // Calculate next milestone (first goal > total_distance)
    const nextPosition = await db.read.prepare(
      'SELECT id, title, distance, description, image_id, special FROM goals WHERE distance > ? ORDER BY distance ASC LIMIT 1'
    ).bind(totalDistance).first<GoalRow>();

    // Get newly passed milestones (between previous last_viewed_distance and current total)
    const { results: newlyPassedMilestones } = await db.read.prepare(
      'SELECT id, title, distance, description, image_id, special FROM goals WHERE distance > ? AND distance <= ? ORDER BY distance ASC'
    ).bind(previousViewedDistance, totalDistance).all<GoalRow>();

    // Update last_viewed_distance for the requesting user
    await db.write.prepare(
      'UPDATE party_members SET last_viewed_distance = ? WHERE party_id = ? AND user_id = ?'
    ).bind(totalDistance, partyId, userId).run();

    // Extract requesting user's personal total distance from activeMembers (avoids extra DB call)
    const requestingMember = activeMembers.find((m) => m.user_id === userId);
    const userTotalDistance = requestingMember ? Number(requestingMember.total_distance) : 0;

    return createSuccessResponse({
      current_user_id: userId,
      total_distance: totalDistance,
      user_total_distance: userTotalDistance,
      member_count: activeMembers.length,
      calculated_position: calculatedPosition
        ? { id: calculatedPosition.id, title: calculatedPosition.title, distance: calculatedPosition.distance, description: calculatedPosition.description ?? null, image_id: calculatedPosition.image_id ?? null, special: calculatedPosition.special ?? null }
        : null,
      next_position: nextPosition
        ? { id: nextPosition.id, title: nextPosition.title, distance: nextPosition.distance, description: nextPosition.description ?? null, image_id: nextPosition.image_id ?? null, special: nextPosition.special ?? null }
        : null,
      distance_mode: party.distance_mode,
      leave_distance_behavior: party.leave_distance_behavior,
      members,
      newly_passed_milestones: newlyPassedMilestones.map((m) => ({
        id: m.id,
        title: m.title,
        distance: m.distance,
        description: m.description ?? null,
        image_id: m.image_id ?? null,
        special: m.special ?? null,
      })),
    });
  } catch (error: unknown) {
    console.error('Database error during party progress calculation:', error);
    return createErrorResponse('Internal server error while calculating party progress', 500);
  }
}

/**
 * Compute a member's contribution_at_departure based on the party's distance_mode.
 * For 'incremental': contribution = max(0, total_distance - distance_at_join)
 * For 'cumulative': contribution = total_distance
 */
async function computeContribution(
  db: DbClient,
  userId: number,
  distanceAtJoin: number,
  distanceMode: string,
): Promise<number> {
  const totalDistance = await calculateTotalDistance(db, userId);
  if (distanceMode === 'incremental') {
    return Math.max(0, Number((totalDistance - distanceAtJoin).toFixed(2)));
  }
  return totalDistance;
}

/**
 * POST /api/party/:id/leave — Leave a party.
 *
 * Sets member status to 'left', records departed_at, distance_kept (based on party setting),
 * and contribution_at_departure. If the leader leaves, transfers leadership to the oldest active
 * member or dissolves the party if none remain. Uses D1 batch for consistency.
 */
export async function handleLeaveParty(request: Request, db: DbClient, partyId: number, allowTestAuth?: string): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    // Fetch party
    const party = await db.read.prepare(
      'SELECT id, leader_id, distance_mode, leave_distance_behavior, dissolved_at FROM parties WHERE id = ?'
    ).bind(partyId).first<Pick<PartyRow, 'id' | 'leader_id' | 'distance_mode' | 'leave_distance_behavior' | 'dissolved_at'>>();

    if (!party) {
      return createErrorResponse('Party not found', 404);
    }
    if (party.dissolved_at !== null) {
      return createErrorResponse('This party has been dissolved', 400);
    }

    // Verify active membership
    const membership = await db.read.prepare(
      'SELECT id, distance_at_join, role FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?'
    ).bind(partyId, userId, 'active').first<Pick<PartyMemberRow, 'id' | 'distance_at_join' | 'role'>>();

    if (!membership) {
      return createErrorResponse('You are not an active member of this party', 403);
    }

    // Compute contribution before departure
    const contribution = await computeContribution(db, userId, membership.distance_at_join, party.distance_mode);
    const distanceKept = party.leave_distance_behavior === 'keep' ? 1 : 0;

    // Build batch statements
    const stmts: D1PreparedStatement[] = [];

    // 1. Update member status
    stmts.push(
      db.write.prepare(
        `UPDATE party_members SET status = 'left', departed_at = CURRENT_TIMESTAMP, distance_kept = ?, contribution_at_departure = ? WHERE id = ?`
      ).bind(distanceKept, contribution, membership.id)
    );

    // Handle leader departure
    if (membership.role === 'leader') {
      // Find oldest active member (excluding current user)
      const nextLeader = await db.read.prepare(
        'SELECT id, user_id FROM party_members WHERE party_id = ? AND user_id != ? AND status = ? ORDER BY joined_at ASC LIMIT 1'
      ).bind(partyId, userId, 'active').first<Pick<PartyMemberRow, 'id' | 'user_id'>>();

      if (nextLeader) {
        // Transfer leadership
        stmts.push(
          db.write.prepare('UPDATE party_members SET role = ? WHERE id = ?').bind('leader', nextLeader.id)
        );
        stmts.push(
          db.write.prepare('UPDATE parties SET leader_id = ? WHERE id = ?').bind(nextLeader.user_id, partyId)
        );
      } else {
        // No active members remain — dissolve
        stmts.push(
          db.write.prepare('UPDATE parties SET dissolved_at = CURRENT_TIMESTAMP WHERE id = ?').bind(partyId)
        );
        // Invalidate pending fellowship invites for the dissolved party
        stmts.push(
          db.write.prepare("UPDATE fellowship_invites SET status = 'rejected' WHERE party_id = ? AND status = 'pending'").bind(partyId)
        );
      }
    } else {
      // Non-leader leaving: check if any active members remain after this departure
      const remainingCount = await db.read.prepare(
        'SELECT COUNT(*) as count FROM party_members WHERE party_id = ? AND user_id != ? AND status = ?'
      ).bind(partyId, userId, 'active').first<{ count: number }>();

      if (!remainingCount || remainingCount.count === 0) {
        stmts.push(
          db.write.prepare('UPDATE parties SET dissolved_at = CURRENT_TIMESTAMP WHERE id = ?').bind(partyId)
        );
        // Invalidate pending fellowship invites for the dissolved party
        stmts.push(
          db.write.prepare("UPDATE fellowship_invites SET status = 'rejected' WHERE party_id = ? AND status = 'pending'").bind(partyId)
        );
      }
    }

    await db.write.batch(stmts);

    return createSuccessResponse({ message: 'You have left the party' });
  } catch (error: unknown) {
    console.error('Database error during party leave:', error);
    return createErrorResponse('Internal server error while leaving party', 500);
  }
}

/**
 * POST /api/party/:id/kick/:userId — Kick a member (leader only).
 *
 * Sets the kicked member's status to 'kicked', records departed_at, distance_kept,
 * and contribution_at_departure. Accepts optional removeDistance boolean to override
 * the party's leave_distance_behavior. Auto-dissolves if no active members remain.
 */
export async function handleKickMember(
  request: Request,
  db: DbClient,
  partyId: number,
  targetUserId: number,
  body: Record<string, unknown>,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    // Fetch party
    const party = await db.read.prepare(
      'SELECT id, leader_id, distance_mode, leave_distance_behavior, dissolved_at FROM parties WHERE id = ?'
    ).bind(partyId).first<Pick<PartyRow, 'id' | 'leader_id' | 'distance_mode' | 'leave_distance_behavior' | 'dissolved_at'>>();

    if (!party) {
      return createErrorResponse('Party not found', 404);
    }
    if (party.dissolved_at !== null) {
      return createErrorResponse('This party has been dissolved', 400);
    }

    // Verify requester is the leader
    if (party.leader_id !== userId) {
      return createErrorResponse('Only the party leader can kick members', 403);
    }

    // Cannot kick yourself
    if (targetUserId === userId) {
      return createErrorResponse('Cannot kick yourself. Use the leave endpoint instead.', 400);
    }

    // Verify target is an active member
    const targetMembership = await db.read.prepare(
      'SELECT id, distance_at_join FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?'
    ).bind(partyId, targetUserId, 'active').first<Pick<PartyMemberRow, 'id' | 'distance_at_join'>>();

    if (!targetMembership) {
      return createErrorResponse('Target user is not an active member of this party', 404);
    }

    // Compute contribution before applying disposition
    const contribution = await computeContribution(db, targetUserId, targetMembership.distance_at_join, party.distance_mode);

    // Determine distance_kept: removeDistance overrides party default
    const { removeDistance } = body || {};
    let distanceKept: number;
    if (typeof removeDistance === 'boolean') {
      distanceKept = removeDistance ? 0 : 1;
    } else {
      distanceKept = party.leave_distance_behavior === 'keep' ? 1 : 0;
    }

    // Build batch statements
    const stmts: D1PreparedStatement[] = [];

    stmts.push(
      db.write.prepare(
        `UPDATE party_members SET status = 'kicked', departed_at = CURRENT_TIMESTAMP, distance_kept = ?, contribution_at_departure = ? WHERE id = ?`
      ).bind(distanceKept, contribution, targetMembership.id)
    );

    // Check if any active members remain after kick (excluding the kicked user)
    const remainingCount = await db.read.prepare(
      'SELECT COUNT(*) as count FROM party_members WHERE party_id = ? AND user_id != ? AND status = ?'
    ).bind(partyId, targetUserId, 'active').first<{ count: number }>();

    if (!remainingCount || remainingCount.count === 0) {
      stmts.push(
        db.write.prepare('UPDATE parties SET dissolved_at = CURRENT_TIMESTAMP WHERE id = ?').bind(partyId)
      );
      // Invalidate pending fellowship invites for the dissolved party
      stmts.push(
        db.write.prepare("UPDATE fellowship_invites SET status = 'rejected' WHERE party_id = ? AND status = 'pending'").bind(partyId)
      );
    }

    await db.write.batch(stmts);

    return createSuccessResponse({ message: 'Member has been kicked from the party' });
  } catch (error: unknown) {
    console.error('Database error during member kick:', error);
    return createErrorResponse('Internal server error while kicking member', 500);
  }
}

/**
 * PUT /api/party/:id/settings — Update party settings (leader only).
 *
 * Accepts optional name and leave_distance_behavior.
 * distance_mode is immutable and rejected if provided.
 */
export async function handleUpdatePartySettings(
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

  try {
    // Fetch party
    const party = await db.read.prepare(
      'SELECT id, leader_id, dissolved_at FROM parties WHERE id = ?'
    ).bind(partyId).first<Pick<PartyRow, 'id' | 'leader_id' | 'dissolved_at'>>();

    if (!party) {
      return createErrorResponse('Party not found', 404);
    }
    if (party.dissolved_at !== null) {
      return createErrorResponse('This party has been dissolved', 400);
    }
    if (party.leader_id !== userId) {
      return createErrorResponse('Only the party leader can update settings', 403);
    }

    const { name, leave_distance_behavior, distance_mode, avatar_id } = body || {};

    // Reject distance_mode changes
    if (distance_mode !== undefined) {
      return createErrorResponse('distance_mode is immutable and cannot be changed', 400);
    }

    // Validate at least one field to update
    if (name === undefined && leave_distance_behavior === undefined && avatar_id === undefined) {
      return createErrorResponse('No valid fields to update. Provide name, leave_distance_behavior, or avatar_id.', 400);
    }

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string') {
        return createErrorResponse('Name must be a string', 400);
      }
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        return createErrorResponse('Name cannot be empty', 400);
      }
      if (trimmedName.length > 50) {
        return createErrorResponse('Name must be 50 characters or less', 400);
      }
    }

    // Validate leave_distance_behavior if provided
    if (leave_distance_behavior !== undefined) {
      const validBehaviors = ['keep', 'remove'];
      if (typeof leave_distance_behavior !== 'string' || !validBehaviors.includes(leave_distance_behavior)) {
        return createErrorResponse("Invalid leave_distance_behavior. Must be 'keep' or 'remove'", 400);
      }
    }

    // Validate avatar_id if provided (must be a valid avatar slug or null to clear)
    if (avatar_id !== undefined && avatar_id !== null) {
      if (typeof avatar_id !== 'string' || !isValidAvatarSlug(avatar_id)) {
        return createErrorResponse('Invalid avatar_id', 400);
      }
    }

    // Build dynamic update
    const setClauses: string[] = [];
    const bindValues: unknown[] = [];

    if (name !== undefined) {
      setClauses.push('name = ?');
      bindValues.push((name as string).trim());
    }
    if (leave_distance_behavior !== undefined) {
      setClauses.push('leave_distance_behavior = ?');
      bindValues.push(leave_distance_behavior);
    }
    if (avatar_id !== undefined) {
      setClauses.push('avatar_id = ?');
      bindValues.push(avatar_id === null ? null : (avatar_id as string).trim());
    }

    bindValues.push(partyId);

    await db.write.prepare(
      `UPDATE parties SET ${setClauses.join(', ')} WHERE id = ?`
    ).bind(...bindValues).run();

    // Fetch updated party
    const updated = await db.read.prepare(
      'SELECT id, name, leader_id, distance_mode, leave_distance_behavior, avatar_id FROM parties WHERE id = ?'
    ).bind(partyId).first<Pick<PartyRow, 'id' | 'name' | 'leader_id' | 'distance_mode' | 'leave_distance_behavior' | 'avatar_id'>>();

    return createSuccessResponse(updated);
  } catch (error: unknown) {
    console.error('Database error during party settings update:', error);
    return createErrorResponse('Internal server error while updating party settings', 500);
  }
}

/**
 * POST /api/party/:id/transfer-leadership — Transfer leadership to another active member (leader only).
 *
 * Accepts { new_leader_id: number }. Uses D1 batch for atomic update.
 */
export async function handleTransferLeadership(
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

  try {
    // Fetch party
    const party = await db.read.prepare(
      'SELECT id, leader_id, dissolved_at FROM parties WHERE id = ?'
    ).bind(partyId).first<Pick<PartyRow, 'id' | 'leader_id' | 'dissolved_at'>>();

    if (!party) {
      return createErrorResponse('Party not found', 404);
    }
    if (party.dissolved_at !== null) {
      return createErrorResponse('This party has been dissolved', 400);
    }
    if (party.leader_id !== userId) {
      return createErrorResponse('Only the party leader can transfer leadership', 403);
    }

    const { new_leader_id } = body || {};

    if (new_leader_id === undefined || typeof new_leader_id !== 'number' || !Number.isInteger(new_leader_id) || new_leader_id <= 0) {
      return createErrorResponse('Valid new_leader_id is required', 400);
    }

    if (new_leader_id === userId) {
      return createErrorResponse('You are already the leader', 400);
    }

    // Verify new leader is an active member
    const newLeaderMembership = await db.read.prepare(
      'SELECT id FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?'
    ).bind(partyId, new_leader_id, 'active').first<Pick<PartyMemberRow, 'id'>>();

    if (!newLeaderMembership) {
      return createErrorResponse('Target user is not an active member of this party', 404);
    }

    // Get current leader's membership row
    const currentLeaderMembership = await db.read.prepare(
      'SELECT id FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?'
    ).bind(partyId, userId, 'active').first<Pick<PartyMemberRow, 'id'>>();

    if (!currentLeaderMembership) {
      return createErrorResponse('Current leader membership record not found', 500);
    }

    // Atomic batch: update roles + parties.leader_id
    await db.write.batch([
      db.write.prepare('UPDATE party_members SET role = ? WHERE id = ?').bind('member', currentLeaderMembership.id),
      db.write.prepare('UPDATE party_members SET role = ? WHERE id = ?').bind('leader', newLeaderMembership.id),
      db.write.prepare('UPDATE parties SET leader_id = ? WHERE id = ?').bind(new_leader_id, partyId),
    ]);

    return createSuccessResponse({ message: 'Leadership transferred successfully', new_leader_id });
  } catch (error: unknown) {
    console.error('Database error during leadership transfer:', error);
    return createErrorResponse('Internal server error while transferring leadership', 500);
  }
}

/**
 * GET /api/party/:id/activity — Get recent party activity feed.
 *
 * Returns the last 20 entries from a unified feed of walk logs and messages.
 * Query parameter: ?type=all|walk|message (default: all)
 * Security: 401 if unauthenticated, 403 if not an active member, 404 if party not found/dissolved.
 */
export async function handlePartyActivity(request: Request, db: DbClient, partyId: number, allowTestAuth?: string): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    // Check party exists and is not dissolved
    const party = await db.read.prepare(
      'SELECT id, dissolved_at FROM parties WHERE id = ?'
    ).bind(partyId).first<Pick<PartyRow, 'id' | 'dissolved_at'>>();

    if (!party || party.dissolved_at !== null) {
      return createErrorResponse('Party not found', 404);
    }

    // Verify requesting user is an active member
    const membership = await db.read.prepare(
      'SELECT id FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?'
    ).bind(partyId, userId, 'active').first<Pick<PartyMemberRow, 'id'>>();

    if (!membership) {
      return createErrorResponse('You are not an active member of this party', 403);
    }

    // Parse filter type
    const url = new URL(request.url);
    const filterType = url.searchParams.get('type') ?? 'all';
    if (!['all', 'walk', 'message'].includes(filterType)) {
      return createErrorResponse('Invalid type filter. Must be all, walk, or message', 400);
    }

    let activities: UnifiedActivityRow[];

    if (filterType === 'walk') {
      const { results } = await db.read.prepare(
        `SELECT 'walk' as type, ppl.logged_by_user_id as user_id, u.username as display_name,
                u.avatar_id, strftime('%Y-%m-%dT%H:%M:%SZ', ppl.logged_at) as created_at,
                ppl.distance, ppl.date, NULL as content, NULL as message_id
         FROM party_progress_log ppl
         JOIN users u ON ppl.logged_by_user_id = u.id
         JOIN party_members pm ON pm.party_id = ppl.party_id AND pm.user_id = ppl.logged_by_user_id
         WHERE ppl.party_id = ? AND pm.status = 'active'
         ORDER BY ppl.logged_at DESC
         LIMIT 20`
      ).bind(partyId).all<UnifiedActivityRow>();
      activities = results;
    } else if (filterType === 'message') {
      const { results } = await db.read.prepare(
        `SELECT 'message' as type, pmsg.user_id, u.username as display_name,
                u.avatar_id, strftime('%Y-%m-%dT%H:%M:%SZ', pmsg.created_at) as created_at,
                NULL as distance, NULL as date, pmsg.content, pmsg.id as message_id
         FROM party_messages pmsg
         JOIN users u ON pmsg.user_id = u.id
         JOIN party_members pm ON pm.party_id = pmsg.party_id AND pm.user_id = pmsg.user_id
         WHERE pmsg.party_id = ? AND pm.status = 'active'
         ORDER BY pmsg.created_at DESC
         LIMIT 20`
      ).bind(partyId).all<UnifiedActivityRow>();
      activities = results;
    } else {
      // 'all' — union both types, each pre-limited for efficiency
      const { results } = await db.read.prepare(
        `SELECT * FROM (
           SELECT * FROM (
             SELECT 'walk' as type, ppl.logged_by_user_id as user_id, u.username as display_name,
                    u.avatar_id, strftime('%Y-%m-%dT%H:%M:%SZ', ppl.logged_at) as created_at,
                    ppl.distance, ppl.date, NULL as content, NULL as message_id
             FROM party_progress_log ppl
             JOIN users u ON ppl.logged_by_user_id = u.id
             JOIN party_members pm ON pm.party_id = ppl.party_id AND pm.user_id = ppl.logged_by_user_id
             WHERE ppl.party_id = ? AND pm.status = 'active'
             ORDER BY ppl.logged_at DESC LIMIT 20
           )
           UNION ALL
           SELECT * FROM (
             SELECT 'message' as type, pmsg.user_id, u.username as display_name,
                    u.avatar_id, strftime('%Y-%m-%dT%H:%M:%SZ', pmsg.created_at) as created_at,
                    NULL as distance, NULL as date, pmsg.content, pmsg.id as message_id
             FROM party_messages pmsg
             JOIN users u ON pmsg.user_id = u.id
             JOIN party_members pm ON pm.party_id = pmsg.party_id AND pm.user_id = pmsg.user_id
             WHERE pmsg.party_id = ? AND pm.status = 'active'
             ORDER BY pmsg.created_at DESC LIMIT 20
           )
         ) combined
         ORDER BY created_at DESC
         LIMIT 20`
      ).bind(partyId, partyId).all<UnifiedActivityRow>();
      activities = results;
    }

    return createSuccessResponse({ activities });
  } catch (error: unknown) {
    console.error('Database error during party activity retrieval:', error);
    return createErrorResponse('Internal server error while retrieving party activity', 500);
  }
}

/** Maximum message length */
const MAX_MESSAGE_LENGTH = 200;

/**
 * POST /api/party/:id/messages — Send a message to the party activity feed.
 *
 * Request body: { content: string }
 * Content must be 1–200 characters after trimming.
 * Security: 401 if unauthenticated, 403 if not an active member, 404 if party not found/dissolved.
 */
export async function handleSendPartyMessage(request: Request, db: DbClient, partyId: number, body?: Record<string, unknown>, allowTestAuth?: string): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    // Use pre-parsed body if available, otherwise parse from request
    let parsedBody: Record<string, unknown>;
    if (body) {
      parsedBody = body;
    } else {
      try {
        parsedBody = await request.json() as Record<string, unknown>;
      } catch {
        return createErrorResponse('Invalid JSON body', 400);
      }
    }

    // Validate content
    if (typeof parsedBody.content !== 'string') {
      return createErrorResponse('Message content is required', 400);
    }
    const content = parsedBody.content.trim();
    if (content.length === 0) {
      return createErrorResponse('Message content cannot be empty', 400);
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return createErrorResponse(`Message content must be ${MAX_MESSAGE_LENGTH} characters or less`, 400);
    }

    // Check party exists and is not dissolved
    const party = await db.read.prepare(
      'SELECT id, dissolved_at FROM parties WHERE id = ?'
    ).bind(partyId).first<Pick<PartyRow, 'id' | 'dissolved_at'>>();

    if (!party || party.dissolved_at !== null) {
      return createErrorResponse('Party not found', 404);
    }

    // Verify requesting user is an active member
    const membership = await db.read.prepare(
      'SELECT id FROM party_members WHERE party_id = ? AND user_id = ? AND status = ?'
    ).bind(partyId, userId, 'active').first<Pick<PartyMemberRow, 'id'>>();

    if (!membership) {
      return createErrorResponse('You are not an active member of this party', 403);
    }

    // Insert message
    const result = await db.write.prepare(
      'INSERT INTO party_messages (party_id, user_id, content) VALUES (?, ?, ?)'
    ).bind(partyId, userId, content).run();

    // Fetch the created message to return it
    const messageId = result.meta.last_row_id;
    if (!messageId) {
      return createErrorResponse('Failed to create message', 500);
    }
    const message = await db.read.prepare(
      `SELECT pm.id, pm.party_id, pm.user_id, pm.content, pm.created_at, u.username as display_name, u.avatar_id
       FROM party_messages pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.id = ?`
    ).bind(messageId).first<{
      id: number;
      party_id: number;
      user_id: number;
      content: string;
      created_at: string;
      display_name: string;
      avatar_id: string | null;
    }>();

    if (!message) {
      return createErrorResponse('Failed to retrieve created message', 500);
    }

    return createSuccessResponse({
      message: {
        id: message.id,
        type: 'message',
        user_id: message.user_id,
        display_name: message.display_name,
        avatar_id: message.avatar_id,
        content: message.content,
        created_at: message.created_at,
      },
    }, 201);
  } catch (error: unknown) {
    console.error('Database error during party message creation:', error);
    return createErrorResponse('Internal server error while sending message', 500);
  }
}

/** D1 result row for party positions query */
interface PartyPositionRow {
  party_id: number;
  name: string;
  distance_mode: string;
  avatar_id: string | null;
}

/** D1 result row for party member distance (for position calculation) */
interface PartyMemberDistRow {
  user_id: number;
  distance_at_join: number;
  total_distance: number;
  status: string;
  contribution_at_departure: number | null;
  distance_kept: number | null;
}

/**
 * GET /api/user/parties/positions — Get positions of all user's active fellowships for map display.
 *
 * Returns { fellowships: [{ party_id, name, total_distance, avatar_id }] }
 * where total_distance is in km (sum of member contributions based on distance_mode),
 * and avatar_id is the fellowship's avatar identifier (may be null).
 * Only returns active (non-dissolved) parties where user is an active member.
 */
export async function handlePartyPositions(request: Request, db: DbClient, allowTestAuth?: string): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;

  try {
    // Get all active parties the user belongs to
    const { results: parties } = await db.read.prepare(`
      SELECT p.id as party_id, p.name, p.distance_mode, p.avatar_id
      FROM party_members pm
      JOIN parties p ON pm.party_id = p.id
      WHERE pm.user_id = ? AND pm.status = 'active' AND p.dissolved_at IS NULL
    `).bind(userId).all<PartyPositionRow>();

    if (parties.length === 0) {
      return createSuccessResponse({ fellowships: [] });
    }

    const fellowships: Array<{ party_id: number; name: string; total_distance: number; avatar_id: string | null }> = [];

    for (const party of parties) {
      // Get all members (active + departed with kept contributions)
      const { results: members } = await db.read.prepare(`
        SELECT pm.user_id, pm.distance_at_join, pm.status, pm.contribution_at_departure, pm.distance_kept,
               COALESCE((SELECT SUM(p.distance) FROM progress p WHERE p.user_id = pm.user_id), 0) as total_distance
        FROM party_members pm
        WHERE pm.party_id = ?
          AND (pm.status = 'active' OR (pm.status IN ('left', 'kicked') AND pm.distance_kept = 1))
      `).bind(party.party_id).all<PartyMemberDistRow>();

      let totalDistance = 0;
      for (const member of members) {
        if (member.status !== 'active') {
          // Departed member with kept contribution
          totalDistance += member.contribution_at_departure ?? 0;
        } else if (party.distance_mode === 'incremental') {
          totalDistance += Math.max(0, member.total_distance - member.distance_at_join);
        } else {
          totalDistance += member.total_distance;
        }
      }

      totalDistance = Number(totalDistance.toFixed(2));

      fellowships.push({
        party_id: party.party_id,
        name: party.name,
        total_distance: totalDistance,
        avatar_id: party.avatar_id ?? null,
      });
    }

    return createSuccessResponse({ fellowships });
  } catch (error: unknown) {
    console.error('Database error during party positions retrieval:', error);
    return createErrorResponse('Internal server error while retrieving party positions', 500);
  }
}
