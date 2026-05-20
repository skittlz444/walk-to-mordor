import { validateSession } from './auth-handlers';
import { calculateTotalDistance } from './goals-handlers';
import {
  applyStorylineOffset,
  calculatePartyRawTotalDistance,
  listActiveStorylines,
  requireActiveStoryline,
  resolvePartyStoryline,
  resolveUserStoryline,
  toStorylineResponse,
} from './storyline-utils';
import { createErrorResponse, createSuccessResponse } from './validators';
import type { DbClient } from './db';

type StorylineSwitchMode = 'carry' | 'reset';

interface PartyStorylineRow {
  id: number;
  leader_id: number;
  distance_mode: string;
  dissolved_at: string | null;
}

function parseStorylineSwitchBody(body: Record<string, unknown> | undefined):
  | { storylineId: number; mode: StorylineSwitchMode }
  | { error: Response } {
  const storylineId = body?.storylineId;
  const mode = body?.mode;

  if (typeof storylineId !== 'number' || !Number.isInteger(storylineId) || storylineId <= 0) {
    return { error: createErrorResponse('storylineId must be a positive integer', 400) };
  }

  if (mode !== 'carry' && mode !== 'reset') {
    return { error: createErrorResponse("mode must be 'carry' or 'reset'", 400) };
  }

  return { storylineId, mode };
}

function calculateNextOffset(rawDistance: number, currentOffset: number, mode: StorylineSwitchMode): number {
  if (mode === 'reset') {
    return -rawDistance;
  }

  const currentDisplayedDistance = applyStorylineOffset(rawDistance, currentOffset);
  return Number((currentDisplayedDistance - rawDistance).toFixed(2));
}

export async function handleStorylinesList(
  request: Request,
  db: DbClient,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }

  try {
    const storylines = await listActiveStorylines(db);
    return createSuccessResponse({
      storylines: storylines.map((storyline) => ({
        id: storyline.id,
        slug: storyline.slug,
        title: storyline.title,
        description: storyline.description,
        pathKey: storyline.path_key,
      })),
    });
  } catch (error: unknown) {
    console.error('Database error during storyline list retrieval:', error);
    return createErrorResponse('Internal server error while retrieving storylines', 500);
  }
}

export async function handleUpdateUserStoryline(
  request: Request,
  db: DbClient,
  body: Record<string, unknown> | undefined,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }

  const parsed = parseStorylineSwitchBody(body);
  if ('error' in parsed) {
    return parsed.error;
  }

  try {
    const userId = sessionValidation.userId;
    const nextStoryline = await requireActiveStoryline(db, parsed.storylineId);
    const rawTotalDistance = await calculateTotalDistance(db, userId);
    const currentContext = await resolveUserStoryline(db, userId);
    const nextOffset = calculateNextOffset(rawTotalDistance, currentContext.distanceOffset, parsed.mode);
    const totalDistance = applyStorylineOffset(rawTotalDistance, nextOffset);

    await db.write.prepare(
      `UPDATE users
       SET active_storyline_id = ?, storyline_distance_offset = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).bind(nextStoryline.id, nextOffset, userId).run();

    return createSuccessResponse({
      totalDistance,
      rawTotalDistance,
      activeStoryline: toStorylineResponse({ storyline: nextStoryline, distanceOffset: nextOffset }),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Storyline not found') {
      return createErrorResponse('Storyline not found', 404);
    }
    console.error('Database error during user storyline update:', error);
    return createErrorResponse('Internal server error while updating storyline', 500);
  }
}

export async function handleUpdatePartyStoryline(
  request: Request,
  db: DbClient,
  partyId: number,
  body: Record<string, unknown> | undefined,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }

  const parsed = parseStorylineSwitchBody(body);
  if ('error' in parsed) {
    return parsed.error;
  }

  try {
    const userId = sessionValidation.userId;
    const party = await db.read.prepare(
      'SELECT id, leader_id, distance_mode, dissolved_at FROM parties WHERE id = ?',
    ).bind(partyId).first<PartyStorylineRow>();

    if (!party || party.dissolved_at !== null) {
      return createErrorResponse('Party not found', 404);
    }
    if (party.leader_id !== userId) {
      return createErrorResponse('Only the party leader can update storyline', 403);
    }

    const nextStoryline = await requireActiveStoryline(db, parsed.storylineId);
    const rawTotalDistance = await calculatePartyRawTotalDistance(db, partyId, party.distance_mode);
    const currentContext = await resolvePartyStoryline(db, partyId);
    const nextOffset = calculateNextOffset(rawTotalDistance, currentContext.distanceOffset, parsed.mode);
    const totalDistance = applyStorylineOffset(rawTotalDistance, nextOffset);

    const updateParty = db.write.prepare(
      `UPDATE parties
       SET active_storyline_id = ?, storyline_distance_offset = ?
       WHERE id = ?`,
    ).bind(nextStoryline.id, nextOffset, partyId);

    const updateViewedDistance = db.write.prepare(
      `UPDATE party_members
       SET last_viewed_distance = ?
       WHERE party_id = ? AND status = 'active'`,
    ).bind(totalDistance, partyId);

    await db.write.batch([updateParty, updateViewedDistance]);

    return createSuccessResponse({
      partyId,
      totalDistance,
      rawTotalDistance,
      activeStoryline: toStorylineResponse({ storyline: nextStoryline, distanceOffset: nextOffset }),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Storyline not found') {
      return createErrorResponse('Storyline not found', 404);
    }
    console.error('Database error during party storyline update:', error);
    return createErrorResponse('Internal server error while updating party storyline', 500);
  }
}
