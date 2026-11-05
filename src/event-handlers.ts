// Personal challenge API handlers: daily roll, accept, and decline.
import type { DbClient } from './db';
import {
  EncounterConflictError,
  EncounterNotFoundError,
  EncounterValidationError,
  acceptEncounter,
  declineEncounter,
  rollDailyEncounter,
} from './event-utils';
import { createErrorResponse, createSuccessResponse } from './validators';

/** Result of safely parsing a request body. */
type ParsedBody =
  | { ok: true; body: unknown }
  | { ok: false };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

async function parseJsonBody(request: Request): Promise<ParsedBody> {
  try {
    const text = await request.text();
    if (text.trim() === '') {
      return { ok: true, body: {} };
    }
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function isEncounterError(
  error: unknown,
): error is EncounterValidationError | EncounterNotFoundError | EncounterConflictError {
  return error instanceof EncounterValidationError
    || error instanceof EncounterNotFoundError
    || error instanceof EncounterConflictError;
}

function toErrorResponse(error: unknown, logMessage: string): Response {
  if (isEncounterError(error)) {
    return createErrorResponse(error.message, error.status);
  }
  console.error(logMessage, error);
  return createErrorResponse('Internal server error', 500);
}

/**
 * POST /api/events/daily-roll — return today's stored offer, rolling it first
 * if this is the user's first request of the UTC day.
 *
 * `forceOffer` is a test-only seam supplied by the route; the body is never
 * parsed here so a client cannot force an offer by sending a flag.
 */
export async function handleDailyRoll(
  _request: Request,
  db: DbClient,
  userId: number,
  options: { forceOffer?: boolean } = {},
): Promise<Response> {
  try {
    const { offer } = await rollDailyEncounter(db, userId, {
      forceOffer: options.forceOffer,
    });
    return createSuccessResponse({ offer });
  } catch (error: unknown) {
    console.error('Error rolling daily encounter:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * POST /api/events/daily-roll/accept — accept today's offered encounter.
 * Idempotent: repeating the call returns the existing occurrence.
 */
export async function handleAcceptEncounter(
  request: Request,
  db: DbClient,
  userId: number,
): Promise<Response> {
  const parsed = await parseJsonBody(request);
  if (!parsed.ok || !isPlainObject(parsed.body)) {
    return createErrorResponse('Invalid request body', 400);
  }

  const definitionId = parsed.body.encounter_definition_id;
  if (!isPositiveSafeInteger(definitionId)) {
    return createErrorResponse(
      'encounter_definition_id must be a positive integer',
      400,
    );
  }

  try {
    const result = await acceptEncounter(db, userId, definitionId);
    return createSuccessResponse({
      occurrence: result.occurrence,
      definition: result.definition,
      alreadyAccepted: result.alreadyAccepted,
      completed: result.completed,
    });
  } catch (error: unknown) {
    return toErrorResponse(error, 'Error accepting daily encounter:');
  }
}

/**
 * POST /api/events/daily-roll/decline — decline today's offered encounter.
 * The body may be empty; when a definition id is sent it must match the offer.
 */
export async function handleDeclineEncounter(
  request: Request,
  db: DbClient,
  userId: number,
): Promise<Response> {
  const parsed = await parseJsonBody(request);
  if (!parsed.ok || !isPlainObject(parsed.body)) {
    return createErrorResponse('Invalid request body', 400);
  }

  let definitionId: number | undefined;
  if (parsed.body.encounter_definition_id !== undefined) {
    const candidate = parsed.body.encounter_definition_id;
    if (!isPositiveSafeInteger(candidate)) {
      return createErrorResponse(
        'encounter_definition_id must be a positive integer',
        400,
      );
    }
    definitionId = candidate;
  }

  try {
    const result = await declineEncounter(db, userId, definitionId);
    return createSuccessResponse(result);
  } catch (error: unknown) {
    return toErrorResponse(error, 'Error declining daily encounter:');
  }
}
