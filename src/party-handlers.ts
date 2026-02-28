// Party (Fellowship) API handlers
import { validateSession } from "./auth-handlers";
import { calculateTotalDistance } from "./goals-handlers";
import { createErrorResponse, createSuccessResponse } from "./validators";

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
}

/**
 * Generate a cryptographically secure 8-character alphanumeric invite code.
 * Uses crypto.getRandomValues() for non-enumerable codes.
 */
export function generateInviteCode(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = new Uint8Array(8);
  crypto.getRandomValues(values);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += charset[values[i] % charset.length];
  }
  return code;
}

/**
 * POST /api/party — Create a new Fellowship (party).
 *
 * Request body: { name: string, distance_mode?: 'cumulative' | 'incremental', leave_distance_behavior?: 'keep' | 'remove' }
 * Returns the created party details including invite code and configured settings.
 */
export async function handleCreateParty(request: Request, env: { DB: D1Database }, body: Record<string, unknown>): Promise<Response> {
  // Validate session
  const sessionValidation = await validateSession(request, env);
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
    const totalDistance = await calculateTotalDistance(env, userId);

    const maxRetries = 5;

    // Retry party creation on invite_code UNIQUE constraint violations
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Generate invite code with retry for obvious (pre-insert) uniqueness conflicts
      let inviteCode = generateInviteCode();
      const maxCodeGenRetries = 5;
      for (let codeAttempt = 0; codeAttempt < maxCodeGenRetries; codeAttempt++) {
        const existing = await env.DB.prepare(
          'SELECT id FROM parties WHERE invite_code = ?'
        ).bind(inviteCode).first();
        if (!existing) break;
        inviteCode = generateInviteCode();
        if (codeAttempt === maxCodeGenRetries - 1) {
          return createErrorResponse('Failed to generate unique invite code. Please try again.', 500);
        }
      }

      // Use D1 batch for atomic party + member creation
      const insertPartyStmt = env.DB.prepare(
        'INSERT INTO parties (name, leader_id, invite_code, distance_mode, leave_distance_behavior) VALUES (?, ?, ?, ?, ?)'
      ).bind(trimmedName, userId, inviteCode, resolvedDistanceMode, resolvedLeaveBehavior);

      // Use subquery to reference the party by invite_code so both inserts are in one atomic batch
      const insertMemberStmt = env.DB.prepare(
        'INSERT INTO party_members (party_id, user_id, role, distance_at_join, last_viewed_distance, status) VALUES ((SELECT id FROM parties WHERE invite_code = ?), ?, ?, ?, 0, ?)'
      ).bind(inviteCode, userId, 'leader', totalDistance, 'active');

      try {
        const batchResults = await env.DB.batch([insertPartyStmt, insertMemberStmt]);

        // Get the newly created party ID from the first batch result
        const partyId = batchResults[0].meta.last_row_id;

        // Fetch the created party to return full details
        const party = await env.DB.prepare(
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
