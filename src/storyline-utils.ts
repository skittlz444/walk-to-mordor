import type { DbClient } from './db';

export const DEFAULT_STORYLINE_SLUG = 'frodo-sam';

export interface Storyline {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  path_key: string;
  sort_order: number;
  is_active: boolean;
  admin_only: boolean;
}

export interface StorylineContext {
  storyline: Storyline;
  distanceOffset: number;
}

export interface StorylineGoal {
  storyline_goal_id: number;
  id: number;
  title: string;
  distance: number;
  description: string | null;
  image_id: string | null;
  special: string | null;
  sort_order: number;
  has_content: boolean;
}

interface StorylineRow {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  path_key: string;
  sort_order: number;
  is_active: number;
  admin_only: number;
}

interface StorylineContextRow extends StorylineRow {
  storyline_distance_offset: number | null;
}

function toStoryline(row: StorylineRow): Storyline {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    path_key: row.path_key,
    sort_order: row.sort_order,
    is_active: row.is_active === 1,
    admin_only: row.admin_only === 1,
  };
}

export function roundDistance(distance: number): number {
  return Number(distance.toFixed(2));
}

export function applyStorylineOffset(rawDistance: number, offset: number): number {
  return roundDistance(Math.max(0, rawDistance + offset));
}

export async function isUserAdmin(db: DbClient, userId: number): Promise<boolean> {
  const row = await db.read.prepare(
    'SELECT is_admin FROM users WHERE id = ?',
  ).bind(userId).first<{ is_admin: number | null }>();

  return row?.is_admin === 1;
}

export async function getDefaultStoryline(db: DbClient): Promise<Storyline> {
  // Try the canonical default storyline first
  const storyline = await db.read.prepare(
    `SELECT id, slug, title, description, path_key, sort_order, is_active, admin_only
     FROM storylines
     WHERE slug = ? AND is_active = 1 AND admin_only = 0
     LIMIT 1`,
  ).bind(DEFAULT_STORYLINE_SLUG).first<StorylineRow>();

  if (storyline) {
    return toStoryline(storyline);
  }

  // Fallback: use the first available active storyline
  const anyStoryline = await db.read.prepare(
    `SELECT id, slug, title, description, path_key, sort_order, is_active, admin_only
     FROM storylines
     WHERE is_active = 1 AND admin_only = 0
     ORDER BY sort_order ASC, id ASC
     LIMIT 1`,
  ).first<StorylineRow>();

  if (anyStoryline) {
    return toStoryline(anyStoryline);
  }

  throw new Error('No storylines are configured');
}

export async function listActiveStorylines(db: DbClient, options: { includeAdminOnly?: boolean } = {}): Promise<Storyline[]> {
  // Safe: derived from a boolean, never from user input.
  const visibilityFilter = options.includeAdminOnly ? '' : 'AND admin_only = 0';
  const { results } = await db.read.prepare(
    `SELECT id, slug, title, description, path_key, sort_order, is_active, admin_only
     FROM storylines
     WHERE is_active = 1 ${visibilityFilter}
     ORDER BY sort_order ASC, title COLLATE NOCASE ASC, id ASC`,
  ).all<StorylineRow>();

  return results.map(toStoryline);
}

export async function requireActiveStoryline(
  db: DbClient,
  storylineId: number,
  options: { includeAdminOnly?: boolean } = {},
): Promise<Storyline> {
  // Safe: derived from a boolean, never from user input.
  const visibilityFilter = options.includeAdminOnly ? '' : 'AND admin_only = 0';
  const storyline = await db.read.prepare(
    `SELECT id, slug, title, description, path_key, sort_order, is_active, admin_only
     FROM storylines
     WHERE id = ? AND is_active = 1 ${visibilityFilter}
     LIMIT 1`,
  ).bind(storylineId).first<StorylineRow>();

  if (!storyline) {
    throw new Error('Storyline not found');
  }

  return toStoryline(storyline);
}

export async function resolveUserStoryline(db: DbClient, userId: number): Promise<StorylineContext> {
  const row = await db.read.prepare(
    `SELECT s.id, s.slug, s.title, s.description, s.path_key, s.sort_order, s.is_active, s.admin_only,
            u.storyline_distance_offset
     FROM users u
     LEFT JOIN storylines s ON s.id = u.active_storyline_id
       AND s.is_active = 1
       AND (s.admin_only = 0 OR u.is_admin = 1)
     WHERE u.id = ?
     LIMIT 1`,
  ).bind(userId).first<StorylineContextRow>();

  if (row?.id) {
    return {
      storyline: toStoryline(row),
      distanceOffset: Number(row.storyline_distance_offset ?? 0),
    };
  }

  // Active storyline not set or was deactivated — fall back to default.
  // Reset offset to 0: the stored offset was relative to the previous storyline.
  return {
    storyline: await getDefaultStoryline(db),
    distanceOffset: 0,
  };
}

export async function resolvePartyStoryline(db: DbClient, partyId: number, viewerUserId?: number): Promise<StorylineContext> {
  // Safe: both strings are hardcoded literals derived from a boolean, never from user input.
  const viewerJoin = viewerUserId === undefined ? '' : 'LEFT JOIN users viewer ON viewer.id = ?';
  const visibilityFilter = viewerUserId === undefined
    ? 'AND s.admin_only = 0'
    : 'AND (s.admin_only = 0 OR viewer.is_admin = 1)';
  const row = await db.read.prepare(
    `SELECT s.id, s.slug, s.title, s.description, s.path_key, s.sort_order, s.is_active, s.admin_only,
            p.storyline_distance_offset
     FROM parties p
     ${viewerJoin}
     LEFT JOIN storylines s ON s.id = p.active_storyline_id
       AND s.is_active = 1
       ${visibilityFilter}
     WHERE p.id = ?
     LIMIT 1`,
  ).bind(...(viewerUserId === undefined ? [partyId] : [viewerUserId, partyId])).first<StorylineContextRow>();

  if (row?.id) {
    return {
      storyline: toStoryline(row),
      distanceOffset: Number(row.storyline_distance_offset ?? 0),
    };
  }

  // Active storyline not set or was deactivated — fall back to default.
  // Reset offset to 0: the stored offset was relative to the previous storyline.
  return {
    storyline: await getDefaultStoryline(db),
    distanceOffset: 0,
  };
}

export async function listStorylineGoals(db: DbClient, storylineId: number): Promise<StorylineGoal[]> {
  const { results } = await db.read.prepare(
    `SELECT sg.id as storyline_goal_id,
            g.id,
            g.title,
            sg.distance as distance,
            g.description,
            g.image_id,
            g.special,
            sg.sort_order,
            EXISTS(SELECT 1 FROM goal_content gc WHERE gc.goal_id = g.id) as has_content
     FROM storyline_goals sg
     JOIN goals g ON g.id = sg.goal_id
     WHERE sg.storyline_id = ?
     ORDER BY sg.distance ASC, sg.sort_order ASC, g.id ASC`,
  ).bind(storylineId).all<Omit<StorylineGoal, 'has_content'> & { has_content: number }>();

  return results.map((goal) => ({
    storyline_goal_id: goal.storyline_goal_id,
    id: goal.id,
    title: goal.title,
    distance: goal.distance,
    description: goal.description ?? null,
    image_id: goal.image_id ?? null,
    special: goal.special ?? null,
    sort_order: goal.sort_order,
    has_content: Number(goal.has_content) === 1,
  }));
}

export function toStorylineResponse(context: StorylineContext) {
  return {
    id: context.storyline.id,
    slug: context.storyline.slug,
    title: context.storyline.title,
    description: context.storyline.description,
    pathKey: context.storyline.path_key,
    adminOnly: context.storyline.admin_only,
    distanceOffset: context.distanceOffset,
  };
}

// ---------------------------------------------------------------------------
// Party distance utility (shared between party-handlers and storyline-handlers)
// ---------------------------------------------------------------------------

interface PartyDistanceRow {
  distance_at_join: number;
  total_distance: number;
  status: string;
  contribution_at_departure: number | null;
}

/**
 * Compute the raw (pre-offset) total distance for a party by summing
 * all active and retained-departed member contributions.
 */
export async function calculatePartyRawTotalDistance(
  db: DbClient,
  partyId: number,
  distanceMode: string,
): Promise<number> {
  const { results } = await db.read.prepare(
    `SELECT pm.distance_at_join,
            pm.status,
            pm.contribution_at_departure,
            COALESCE((SELECT SUM(p.distance) FROM progress p WHERE p.user_id = pm.user_id), 0) as total_distance
     FROM party_members pm
     WHERE pm.party_id = ?
       AND (pm.status = 'active' OR (pm.status IN ('left', 'kicked') AND pm.distance_kept = 1))`,
  ).bind(partyId).all<PartyDistanceRow>();

  let rawTotalDistance = 0;
  for (const row of results) {
    if (row.status !== 'active') {
      rawTotalDistance += row.contribution_at_departure ?? 0;
    } else if (distanceMode === 'incremental') {
      rawTotalDistance += Math.max(0, row.total_distance - row.distance_at_join);
    } else {
      rawTotalDistance += row.total_distance;
    }
  }

  return Number(rawTotalDistance.toFixed(2));
}
