// Journal (Milestone Journal) API handlers
import { validateSession } from './auth-handlers';
import type { DbClient } from './db';
import {
  getOwnJournalEntry,
  getAcceptedFriendIds,
  getFriendJournalEntries,
  hasUserReachedGoal,
  hasFellowshipReachedGoal,
  hasAnyFellowshipReachedGoal,
  isActivePartyMember,
  getMilestonePreviewsEnabled,
  upsertJournalEntry,
  deleteJournalEntry,
  computeJournalPermissions,
  type GoalJournalState,
  type FriendJournalEntry,
} from './journal-helpers';

// ── Constants ─────────────────────────────────────────────────────────────

const MAX_BODY_LENGTH = 2000;

// ── Helpers ───────────────────────────────────────────────────────────────

function createErrorResponse(error: string, status: number = 400): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function createSuccessResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Parse and validate a goalId path parameter */
function parseIntParam(value: string, name: string): number | Response {
  const num = Number.parseInt(value, 10);
  if (!Number.isInteger(num) || num <= 0 || String(num) !== value) {
    return createErrorResponse(`Invalid ${name}`, 400);
  }
  return num;
}

// ── Handlers ──────────────────────────────────────────────────────────────

/**
 * GET /api/goals/:goalId/journals[?partyId=<id>]
 *
 * Returns the goal-scoped journal state for the authenticated viewer:
 * - ownEntry: the viewer's own journal entry for this goal (or null)
 * - friendEntries: visible friend journal entries (ordered newest first)
 * - permissions: what journal actions are available to the viewer
 *
 * Query param:
 * - partyId (optional): fellowship context for write and read access checks
 */
export async function handleJournalStateGet(
  request: Request,
  db: DbClient,
  goalId: number,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) return sessionValidation.error;

  const userId = sessionValidation.userId;

  try {
    const url = new URL(request.url);
    const partyIdParam = url.searchParams.get('partyId');
    let partyId: number | null = null;

    if (partyIdParam !== null) {
      const parsed = parseIntParam(partyIdParam, 'partyId');
      if (parsed instanceof Response) return parsed;
      partyId = parsed;

      // Validate the user is an active member of this fellowship
      const isMember = await isActivePartyMember(db, userId, partyId);
      if (!isMember) {
        return createErrorResponse('You are not an active member of this fellowship', 403);
      }
    }

    // Fetch own entry
    const ownEntry = await getOwnJournalEntry(db, userId, goalId);

    // Determine write access
    const personalReach = await hasUserReachedGoal(db, userId, goalId);
    let fellowshipReach = false;
    if (!personalReach) {
      if (partyId !== null) {
        fellowshipReach = await hasFellowshipReachedGoal(db, partyId, goalId);
      } else {
        // No specific party selected — check ALL active parties
        fellowshipReach = await hasAnyFellowshipReachedGoal(db, userId, goalId);
      }
    }

    // Fetch accepted friend IDs once, reuse for permissions and visibility
    const friendIds = await getAcceptedFriendIds(db, userId);
    const hasFriends = friendIds.length > 0;
    const permissions = computeJournalPermissions({
      hasPersonalReach: personalReach,
      hasFellowshipReach: fellowshipReach,
      hasOwnEntry: ownEntry !== null,
      hasFriends,
    });

    // Fetch visible friend entries
    let friendEntries: FriendJournalEntry[] = [];
    if (permissions.canReadFriends) {
      // Filter friends by milestone preview rules
      const previewsEnabled = await getMilestonePreviewsEnabled(db, userId);
      let visibleFriendIds = friendIds;

      if (!previewsEnabled) {
        // Milestone previews locked: for each friend, check if viewer has reached the goal
        // in the current reading context
        const viewerReached = personalReach || fellowshipReach;
        if (!viewerReached) {
          visibleFriendIds = []; // No friends visible if viewer hasn't reached the goal
        }
      }

      friendEntries = await getFriendJournalEntries(db, visibleFriendIds, goalId);
    }

    const state: GoalJournalState = {
      ownEntry,
      friendEntries,
      permissions,
    };

    return createSuccessResponse(state);
  } catch (error) {
    console.error('Database error during journal state read:', error);
    return createErrorResponse('Internal server error while retrieving journal state', 500);
  }
}

/**
 * PUT /api/goals/:goalId/journal
 *
 * Creates or updates the current user's journal entry for a goal.
 *
 * Request body: { body: string, partyId?: number }
 * - body: plain text, trimmed, non-empty, max 2000 characters
 * - partyId (optional): fellowship context for write validation
 *
 * Write access rules:
 * - User must have personally reached the goal, OR
 * - User must be an active member of a fellowship that has reached the goal (via partyId)
 */
export async function handleJournalUpsert(
  request: Request,
  db: DbClient,
  goalId: number,
  body: Record<string, unknown>,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) return sessionValidation.error;

  const userId = sessionValidation.userId;

  try {
    const { body: journalBody, partyId } = body || {};

    // Validate body text
    if (typeof journalBody !== 'string') {
      return createErrorResponse('Missing required field: body (string)', 400);
    }

    const trimmed = journalBody.trim();
    if (trimmed.length === 0) {
      return createErrorResponse('Journal body cannot be empty', 400);
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      return createErrorResponse(`Journal body must be ${MAX_BODY_LENGTH} characters or less`, 400);
    }

    // Determine write access
    const personalReach = await hasUserReachedGoal(db, userId, goalId);
    let fellowshipReach = false;

    if (!personalReach) {
      if (typeof partyId === 'number' && partyId > 0) {
        // Validate fellowship context
        const isMember = await isActivePartyMember(db, userId, partyId);
        if (!isMember) {
          return createErrorResponse('You are not an active member of this fellowship', 403);
        }
        fellowshipReach = await hasFellowshipReachedGoal(db, partyId, goalId);
      } else {
        // No specific party selected — check ALL active parties
        fellowshipReach = await hasAnyFellowshipReachedGoal(db, userId, goalId);
      }
    }

    if (!personalReach && !fellowshipReach) {
      return createErrorResponse(
        'You must reach this goal personally or through a fellowship before writing a journal entry',
        403,
      );
    }

    // Perform upsert
    const entry = await upsertJournalEntry(db, userId, goalId, trimmed);
    return createSuccessResponse({
      message: 'Journal entry saved',
      entry: {
        id: entry.id,
        body: entry.body,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      },
    }, entry.created_at === entry.updated_at ? 201 : 200);
  } catch (error) {
    console.error('Database error during journal upsert:', error);
    return createErrorResponse('Internal server error while saving journal entry', 500);
  }
}

/**
 * DELETE /api/goals/:goalId/journal
 *
 * Deletes the current user's journal entry for a goal.
 * Only the entry author can delete their own entry.
 */
export async function handleJournalDelete(
  request: Request,
  db: DbClient,
  goalId: number,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) return sessionValidation.error;

  const userId = sessionValidation.userId;

  try {
    const deleted = await deleteJournalEntry(db, userId, goalId);

    if (!deleted) {
      return createErrorResponse('No journal entry found for this goal', 404);
    }

    return createSuccessResponse({ message: 'Journal entry deleted' });
  } catch (error) {
    console.error('Database error during journal delete:', error);
    return createErrorResponse('Internal server error while deleting journal entry', 500);
  }
}
