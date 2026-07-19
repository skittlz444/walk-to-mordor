// Goal content data-access helpers, row types, and validation for authored goal content.
import type { DbClient } from './db';

// ── Types ──────────────────────────────────────────────────────────────────

export type GoalContentType = 'story' | 'poetry' | 'appendix';

export const GOAL_CONTENT_TYPES: readonly GoalContentType[] = ['story', 'poetry', 'appendix'];

/** Row shape from the goal_content table. */
export interface GoalContentRow {
  id: number;
  goal_id: number;
  type: GoalContentType;
  title: string;
  body: string;
  author_attribution: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Client-facing goal content entry (matches DB columns for simplicity). */
export interface GoalContentEntry {
  id: number;
  goal_id: number;
  type: GoalContentType;
  title: string;
  body: string;
  author_attribution: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Validated input for creating/updating a goal content entry. */
export interface GoalContentInput {
  type: GoalContentType;
  title: string;
  body: string;
  author_attribution: string | null;
  sort_order: number;
}

/** Discovery event types and context. */
export type DiscoveryEventType = 'teaser_impression' | 'content_open';
export type DiscoveryContextType = 'personal' | 'fellowship';

export interface DiscoveryEventInput {
  userId: number | null;
  partyId: number | null;
  goalId: number;
  contentId: number | null;
  eventType: DiscoveryEventType;
  contextType: DiscoveryContextType;
}

// ── Validation ─────────────────────────────────────────────────────────────

export const GOAL_CONTENT_LIMITS = {
  TITLE_MAX: 120,
  ATTRIBUTION_MAX: 255,
  BODY_MAX: 20000,
  SORT_ORDER_MIN: 0,
  SORT_ORDER_MAX: 999,
} as const;

export type ValidationResult =
  | { ok: true; value: GoalContentInput }
  | { ok: false; error: string };

/**
 * Validate an admin-supplied goal content payload.
 * Enforces type, title, attribution, shared body limit, and sort order range.
 */
export function validateGoalContentInput(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }
  const data = body as Record<string, unknown>;

  const type = data.type;
  if (typeof type !== 'string' || !GOAL_CONTENT_TYPES.includes(type as GoalContentType)) {
    return { ok: false, error: 'Type must be one of: story, poetry, appendix' };
  }

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!title) {
    return { ok: false, error: 'Title is required' };
  }
  if (title.length > GOAL_CONTENT_LIMITS.TITLE_MAX) {
    return { ok: false, error: `Title must be ${GOAL_CONTENT_LIMITS.TITLE_MAX} characters or less` };
  }

  const body_ = typeof data.body === 'string' ? data.body : '';
  if (!body_.trim()) {
    return { ok: false, error: 'Body is required' };
  }
  if (body_.length > GOAL_CONTENT_LIMITS.BODY_MAX) {
    return { ok: false, error: `Body must be ${GOAL_CONTENT_LIMITS.BODY_MAX} characters or less` };
  }

  let attribution: string | null = null;
  if (data.author_attribution !== undefined && data.author_attribution !== null) {
    if (typeof data.author_attribution !== 'string') {
      return { ok: false, error: 'Attribution must be a string' };
    }
    const trimmed = data.author_attribution.trim();
    if (trimmed.length > GOAL_CONTENT_LIMITS.ATTRIBUTION_MAX) {
      return { ok: false, error: `Attribution must be ${GOAL_CONTENT_LIMITS.ATTRIBUTION_MAX} characters or less` };
    }
    attribution = trimmed.length > 0 ? trimmed : null;
  }

  const rawSort = data.sort_order;
  if (typeof rawSort !== 'number' || !Number.isInteger(rawSort)) {
    return { ok: false, error: 'Sort order must be an integer' };
  }
  if (rawSort < GOAL_CONTENT_LIMITS.SORT_ORDER_MIN || rawSort > GOAL_CONTENT_LIMITS.SORT_ORDER_MAX) {
    return {
      ok: false,
      error: `Sort order must be between ${GOAL_CONTENT_LIMITS.SORT_ORDER_MIN} and ${GOAL_CONTENT_LIMITS.SORT_ORDER_MAX}`,
    };
  }

  return {
    ok: true,
    value: {
      type: type as GoalContentType,
      title,
      body: body_,
      author_attribution: attribution,
      sort_order: rawSort,
    },
  };
}

// ── Data Access ────────────────────────────────────────────────────────────

function toEntry(row: GoalContentRow): GoalContentEntry {
  return {
    id: row.id,
    goal_id: row.goal_id,
    type: row.type,
    title: row.title,
    body: row.body,
    author_attribution: row.author_attribution ?? null,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** List a goal's content entries ordered by sort_order ascending. */
export async function listGoalContent(db: DbClient, goalId: number): Promise<GoalContentEntry[]> {
  const { results } = await db.read.prepare(
    `SELECT id, goal_id, type, title, body, author_attribution, sort_order, created_at, updated_at
     FROM goal_content
     WHERE goal_id = ?
     ORDER BY sort_order ASC, id ASC`,
  ).bind(goalId).all<GoalContentRow>();

  return (results || []).map(toEntry);
}

/** Fetch a single content entry by id. Returns null if not found. */
export async function getGoalContentById(db: DbClient, contentId: number): Promise<GoalContentEntry | null> {
  const row = await db.read.prepare(
    `SELECT id, goal_id, type, title, body, author_attribution, sort_order, created_at, updated_at
     FROM goal_content
     WHERE id = ?`,
  ).bind(contentId).first<GoalContentRow>();

  return row ? toEntry(row) : null;
}

/** Thrown when a create/update would collide with an existing (goal_id, sort_order). */
export class DuplicateSortOrderError extends Error {
  constructor() {
    super('A content entry with this sort order already exists for this goal');
    this.name = 'DuplicateSortOrderError';
  }
}

/** Check whether a goal already has an entry at a given sort order (optionally excluding one id). */
async function sortOrderTaken(
  db: DbClient,
  goalId: number,
  sortOrder: number,
  excludeContentId?: number,
): Promise<boolean> {
  const row = excludeContentId === undefined
    ? await db.read.prepare(
      `SELECT id FROM goal_content WHERE goal_id = ? AND sort_order = ? LIMIT 1`,
    ).bind(goalId, sortOrder).first<{ id: number }>()
    : await db.read.prepare(
      `SELECT id FROM goal_content WHERE goal_id = ? AND sort_order = ? AND id != ? LIMIT 1`,
    ).bind(goalId, sortOrder, excludeContentId).first<{ id: number }>();
  return row !== null;
}

/** Create a content entry for a goal. Throws DuplicateSortOrderError on sort_order collision. */
export async function createGoalContent(
  db: DbClient,
  goalId: number,
  input: GoalContentInput,
): Promise<GoalContentEntry> {
  if (await sortOrderTaken(db, goalId, input.sort_order)) {
    throw new DuplicateSortOrderError();
  }

  const result = await db.write.prepare(
    `INSERT INTO goal_content (goal_id, type, title, body, author_attribution, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    goalId,
    input.type,
    input.title,
    input.body,
    input.author_attribution,
    input.sort_order,
  ).run();

  const newId = result.meta.last_row_id as number;
  const created = await getGoalContentById(db, newId);
  if (!created) {
    throw new Error('Failed to fetch created goal content');
  }
  return created;
}

/** Update a content entry. Throws DuplicateSortOrderError on sort_order collision. */
export async function updateGoalContent(
  db: DbClient,
  contentId: number,
  input: GoalContentInput,
): Promise<GoalContentEntry | null> {
  const existing = await getGoalContentById(db, contentId);
  if (!existing) return null;

  if (await sortOrderTaken(db, existing.goal_id, input.sort_order, contentId)) {
    throw new DuplicateSortOrderError();
  }

  const now = new Date().toISOString();
  await db.write.prepare(
    `UPDATE goal_content
     SET type = ?, title = ?, body = ?, author_attribution = ?, sort_order = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(
    input.type,
    input.title,
    input.body,
    input.author_attribution,
    input.sort_order,
    now,
    contentId,
  ).run();

  return getGoalContentById(db, contentId);
}

/** Delete a content entry. Returns true if a row was deleted. */
export async function deleteGoalContent(db: DbClient, contentId: number): Promise<boolean> {
  const result = await db.write.prepare(
    `DELETE FROM goal_content WHERE id = ?`,
  ).bind(contentId).run();
  return result.meta.changes > 0;
}

/** Whether a goal has one or more content entries. */
export async function goalHasContent(db: DbClient, goalId: number): Promise<boolean> {
  const row = await db.read.prepare(
    `SELECT 1 as present FROM goal_content WHERE goal_id = ? LIMIT 1`,
  ).bind(goalId).first<{ present: number }>();
  return row !== null;
}

/**
 * Record a discovery event on a best-effort basis.
 * Errors are logged and swallowed so callers never fail user-facing flows.
 */
export async function recordDiscoveryEvent(db: DbClient, event: DiscoveryEventInput): Promise<void> {
  try {
    await db.write.prepare(
      `INSERT INTO content_discovery_events
        (user_id, party_id, goal_id, content_id, event_type, context_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      event.userId,
      event.partyId,
      event.goalId,
      event.contentId,
      event.eventType,
      event.contextType,
    ).run();
  } catch (error) {
    console.error('Failed to record content discovery event:', error);
  }
}
