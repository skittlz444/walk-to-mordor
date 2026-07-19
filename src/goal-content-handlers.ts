// Goal content API handlers: admin CRUD, public unlock-aware reads, and discovery analytics.
import { validateSession } from './auth-handlers';
import type { DbClient } from './db';
import { logAdminAction } from './admin-handlers';
import {
  hasUserReachedGoal,
  hasFellowshipReachedGoal,
  hasAnyFellowshipReachedGoal,
  isActivePartyMember,
} from './journal-helpers';
import {
  listGoalContent,
  getGoalContentById,
  createGoalContent,
  updateGoalContent,
  deleteGoalContent,
  recordDiscoveryEvent,
  validateGoalContentInput,
  DuplicateSortOrderError,
  GOAL_CONTENT_TYPES,
  type DiscoveryEventType,
  type DiscoveryContextType,
} from './goal-content-helpers';

// ── Response helpers ───────────────────────────────────────────────────────

function jsonError(error: string, status = 400): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

/** GET /api/admin/goals/:goalId/content */
export async function handleAdminGoalContentList(
  _request: Request,
  db: DbClient,
  goalId: number,
): Promise<Response> {
  try {
    const entries = await listGoalContent(db, goalId);
    return jsonOk({ entries });
  } catch (error) {
    console.error('Error listing goal content:', error);
    return jsonError('Internal server error while listing goal content', 500);
  }
}

/** POST /api/admin/goals/:goalId/content */
export async function handleAdminGoalContentCreate(
  request: Request,
  db: DbClient,
  goalId: number,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  try {
    // Ensure the goal exists before attaching content.
    const goal = await db.read.prepare('SELECT id FROM goals WHERE id = ?').bind(goalId).first<{ id: number }>();
    if (!goal) {
      return jsonError('Goal not found', 404);
    }

    const validation = validateGoalContentInput(body);
    if (!validation.ok) {
      return jsonError(validation.error, 400);
    }

    const created = await createGoalContent(db, goalId, validation.value);

    await logAdminAction(db, {
      adminUserId,
      action: 'create_goal_content',
      targetType: 'goal_content',
      targetId: created.id,
      details: JSON.stringify({ goalId, type: created.type, sort_order: created.sort_order }),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    return jsonOk(created, 201);
  } catch (error) {
    if (error instanceof DuplicateSortOrderError) {
      return jsonError(error.message, 409);
    }
    console.error('Error creating goal content:', error);
    return jsonError('Internal server error while creating goal content', 500);
  }
}

/** PUT /api/admin/goals/:goalId/content/:contentId */
export async function handleAdminGoalContentUpdate(
  request: Request,
  db: DbClient,
  goalId: number,
  contentId: number,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  try {
    const existing = await getGoalContentById(db, contentId);
    if (!existing || existing.goal_id !== goalId) {
      return jsonError('Goal content not found', 404);
    }

    const validation = validateGoalContentInput(body);
    if (!validation.ok) {
      return jsonError(validation.error, 400);
    }

    const updated = await updateGoalContent(db, contentId, validation.value);
    if (!updated) {
      return jsonError('Goal content not found', 404);
    }

    await logAdminAction(db, {
      adminUserId,
      action: 'update_goal_content',
      targetType: 'goal_content',
      targetId: contentId,
      details: JSON.stringify({ goalId, type: updated.type, sort_order: updated.sort_order }),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    return jsonOk(updated);
  } catch (error) {
    if (error instanceof DuplicateSortOrderError) {
      return jsonError(error.message, 409);
    }
    console.error('Error updating goal content:', error);
    return jsonError('Internal server error while updating goal content', 500);
  }
}

/** DELETE /api/admin/goals/:goalId/content/:contentId */
export async function handleAdminGoalContentDelete(
  request: Request,
  db: DbClient,
  goalId: number,
  contentId: number,
  adminUserId: number,
): Promise<Response> {
  try {
    const existing = await getGoalContentById(db, contentId);
    if (!existing || existing.goal_id !== goalId) {
      return jsonError('Goal content not found', 404);
    }

    await deleteGoalContent(db, contentId);

    await logAdminAction(db, {
      adminUserId,
      action: 'delete_goal_content',
      targetType: 'goal_content',
      targetId: contentId,
      details: JSON.stringify({ goalId }),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    return jsonOk({ message: 'Goal content deleted' });
  } catch (error) {
    console.error('Error deleting goal content:', error);
    return jsonError('Internal server error while deleting goal content', 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

/** Parse an integer query/path value or return an error Response. */
function parseIntParam(value: string, name: string): number | Response {
  const num = Number.parseInt(value, 10);
  if (!Number.isInteger(num) || num <= 0 || String(num) !== value) {
    return jsonError(`Invalid ${name}`, 400);
  }
  return num;
}

/**
 * GET /api/goals/:goalId/content[?partyId=<id>]
 *
 * Returns a goal's authored content entries, but only when the goal is unlocked
 * in the requested viewing context. Reuses the exact goal unlock semantics:
 * - Without partyId: personal storyline-aware progress.
 * - With partyId: fellowship progress for that party (requires active membership).
 *
 * Locked context -> 403. Unlocked context with no entries -> empty array.
 */
export async function handleGoalContentGet(
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

      const isMember = await isActivePartyMember(db, userId, partyId);
      if (!isMember) {
        return jsonError('You are not an active member of this fellowship', 403);
      }
    }

    // Reuse the same unlock semantics as the goal surface itself.
    const personalReach = await hasUserReachedGoal(db, userId, goalId);
    let unlocked = personalReach;
    if (!unlocked) {
      unlocked = partyId !== null
        ? await hasFellowshipReachedGoal(db, partyId, goalId)
        : await hasAnyFellowshipReachedGoal(db, userId, goalId);
    }

    if (!unlocked) {
      return jsonError('This goal content is locked', 403);
    }

    const entries = await listGoalContent(db, goalId);
    return jsonOk({ entries });
  } catch (error) {
    console.error('Error reading goal content:', error);
    return jsonError('Internal server error while reading goal content', 500);
  }
}

/**
 * POST /api/goals/:goalId/content/events
 *
 * Records a best-effort discovery event. The write is scheduled via
 * ctx.waitUntil so it never blocks the response, and failures are swallowed.
 * Always returns 202 for well-formed requests.
 */
export async function handleContentDiscoveryEvent(
  request: Request,
  db: DbClient,
  goalId: number,
  body: Record<string, unknown>,
  scheduleBackground: (promise: Promise<unknown>) => void,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) return sessionValidation.error;

  const userId = sessionValidation.userId;

  const eventType = body?.event_type;
  const contextType = body?.context_type;

  const validEventTypes: DiscoveryEventType[] = ['teaser_impression', 'content_open'];
  const validContextTypes: DiscoveryContextType[] = ['personal', 'fellowship'];

  if (typeof eventType !== 'string' || !validEventTypes.includes(eventType as DiscoveryEventType)) {
    return jsonError('Invalid event_type', 400);
  }
  if (typeof contextType !== 'string' || !validContextTypes.includes(contextType as DiscoveryContextType)) {
    return jsonError('Invalid context_type', 400);
  }

  let partyId: number | null = null;
  if (typeof body.partyId === 'number' && Number.isInteger(body.partyId) && body.partyId > 0) {
    partyId = body.partyId;
  }
  let contentId: number | null = null;
  if (typeof body.content_id === 'number' && Number.isInteger(body.content_id) && body.content_id > 0) {
    contentId = body.content_id;
  }

  // Best-effort: schedule the write and return immediately.
  scheduleBackground(
    recordDiscoveryEvent(db, {
      userId,
      partyId,
      goalId,
      contentId,
      eventType: eventType as DiscoveryEventType,
      contextType: contextType as DiscoveryContextType,
    }),
  );

  return jsonOk({ accepted: true }, 202);
}

export { GOAL_CONTENT_TYPES };
