import type { DbClient } from './db';
import type {
  AdminStorylineSummary,
  AdminStorylineGoalRow,
} from './admin-shared';
import {
  SLUG_REGEX,
  logAdminAction,
} from './admin-shared';

interface AdminStorylineDbRow {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  path_key: string;
  sort_order: number;
  is_active: number;
  admin_only: number;
  goal_count: number;
  min_distance: number | null;
  max_distance: number | null;
}

function toAdminStorylineSummary(row: AdminStorylineDbRow): AdminStorylineSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    path_key: row.path_key,
    sort_order: row.sort_order,
    is_active: row.is_active === 1,
    admin_only: row.admin_only === 1,
    goal_count: row.goal_count,
    min_distance: row.min_distance,
    max_distance: row.max_distance,
  };
}

function parseStorylineMetadata(body: unknown):
  | {
      slug: string;
      title: string;
      description: string | null;
      pathKey: string;
      sortOrder: number;
      isActive: boolean;
      adminOnly: boolean;
      copyFromStorylineId: number | null | undefined;
    }
  | { error: Response } {
  if (!body || typeof body !== 'object') {
    return { error: new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) };
  }

  const data = body as Record<string, unknown>;
  const slug = typeof data.slug === 'string' ? data.slug.trim() : '';
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const description = typeof data.description === 'string' && data.description.trim() !== '' ? data.description.trim() : null;
  const pathKey = typeof data.pathKey === 'string' && data.pathKey.trim() !== '' ? data.pathKey.trim() : 'fellowship';
  const sortOrder = typeof data.sortOrder === 'number' && Number.isInteger(data.sortOrder) ? data.sortOrder : 0;
  const isActive = typeof data.isActive === 'boolean' ? data.isActive : true;
  const adminOnly = typeof data.adminOnly === 'boolean' ? data.adminOnly : false;
  const rawCopyFromStorylineId = data.copyFromStorylineId;
  const copyFromStorylineId = rawCopyFromStorylineId === null
    ? null
    : typeof rawCopyFromStorylineId === 'number' && Number.isInteger(rawCopyFromStorylineId) && rawCopyFromStorylineId > 0
      ? rawCopyFromStorylineId
      : undefined;

  if (!slug || !SLUG_REGEX.test(slug)) {
    return { error: new Response(JSON.stringify({ error: 'Slug must use lowercase words separated by hyphens' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) };
  }
  if (!title) {
    return { error: new Response(JSON.stringify({ error: 'Title is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) };
  }
  if (!SLUG_REGEX.test(pathKey)) {
    return { error: new Response(JSON.stringify({ error: 'Path key must use lowercase words separated by hyphens' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) };
  }

  return { slug, title, description, pathKey, sortOrder, isActive, adminOnly, copyFromStorylineId };
}

async function getAdminStorylineSummary(db: DbClient, storylineId: number): Promise<AdminStorylineSummary | null> {
  const row = await db.read.prepare(
    `SELECT s.id, s.slug, s.title, s.description, s.path_key, s.sort_order, s.is_active, s.admin_only,
            COUNT(sg.id) as goal_count,
            MIN(sg.distance) as min_distance,
            MAX(sg.distance) as max_distance
     FROM storylines s
     LEFT JOIN storyline_goals sg ON sg.storyline_id = s.id
     WHERE s.id = ?
     GROUP BY s.id`,
  ).bind(storylineId).first<AdminStorylineDbRow>();

  return row ? toAdminStorylineSummary(row) : null;
}

export async function handleAdminStorylinesList(_request: Request, db: DbClient): Promise<Response> {
  try {
    const { results } = await db.read.prepare(
      `SELECT s.id, s.slug, s.title, s.description, s.path_key, s.sort_order, s.is_active, s.admin_only,
              COUNT(sg.id) as goal_count,
              MIN(sg.distance) as min_distance,
              MAX(sg.distance) as max_distance
       FROM storylines s
       LEFT JOIN storyline_goals sg ON sg.storyline_id = s.id
       GROUP BY s.id
       ORDER BY s.sort_order ASC, s.title COLLATE NOCASE ASC, s.id ASC`,
    ).all<AdminStorylineDbRow>();

    return new Response(JSON.stringify({ storylines: results.map(toAdminStorylineSummary) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching admin storylines:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while fetching storylines' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function buildStorylineDetailResponse(db: DbClient, storylineId: number): Promise<Response> {
  const storyline = await getAdminStorylineSummary(db, storylineId);
  if (!storyline) {
    return new Response(JSON.stringify({ error: 'Storyline not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { results: goals } = await db.read.prepare(
    `SELECT sg.id as storyline_goal_id,
            g.id as goal_id,
            g.title,
            sg.distance,
            sg.sort_order
     FROM storyline_goals sg
     JOIN goals g ON g.id = sg.goal_id
     WHERE sg.storyline_id = ?
     ORDER BY sg.distance ASC, sg.sort_order ASC, g.id ASC`,
  ).bind(storylineId).all<AdminStorylineGoalRow>();

  return new Response(JSON.stringify({ storyline, goals }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleAdminStorylineGet(_request: Request, db: DbClient, storylineId: number): Promise<Response> {
  try {
    return await buildStorylineDetailResponse(db, storylineId);
  } catch (error: unknown) {
    console.error('Error fetching admin storyline:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while fetching storyline' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function handleAdminStorylineCreate(
  request: Request,
  db: DbClient,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  const parsed = parseStorylineMetadata(body);
  if ('error' in parsed) return parsed.error;

  try {
    const copyFromStorylineId = parsed.copyFromStorylineId === undefined
      ? (await db.read.prepare('SELECT id FROM storylines ORDER BY sort_order ASC, id ASC LIMIT 1').first<{ id: number }>())?.id ?? null
      : parsed.copyFromStorylineId;

    const insertResult = await db.write.prepare(
      `INSERT INTO storylines (slug, title, description, path_key, sort_order, is_active, admin_only)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
     ).bind(parsed.slug, parsed.title, parsed.description, parsed.pathKey, parsed.sortOrder, parsed.isActive ? 1 : 0, parsed.adminOnly ? 1 : 0).run();

    const newStorylineId = (insertResult.meta as Record<string, unknown>).last_row_id;
    if (typeof newStorylineId !== 'number' || !Number.isFinite(newStorylineId)) {
      return new Response(JSON.stringify({ error: 'Internal server error while creating storyline' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (copyFromStorylineId !== null) {
      await db.write.prepare(
        `INSERT INTO storyline_goals (storyline_id, goal_id, distance, sort_order)
         SELECT ?, goal_id, distance, sort_order
         FROM storyline_goals
         WHERE storyline_id = ?`,
      ).bind(newStorylineId, copyFromStorylineId).run();
    }

    await logAdminAction(db, {
      adminUserId,
      action: 'create_storyline',
      targetType: 'storyline',
      targetId: newStorylineId,
      details: JSON.stringify({ slug: parsed.slug, copyFromStorylineId, adminOnly: parsed.adminOnly }),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    const storyline = await getAdminStorylineSummary(db, newStorylineId);
    return new Response(JSON.stringify({ storyline }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return new Response(JSON.stringify({ error: 'A storyline with that slug already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('Error creating storyline:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while creating storyline' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function handleAdminStorylineUpdate(
  request: Request,
  db: DbClient,
  storylineId: number,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  const parsed = parseStorylineMetadata(body);
  if ('error' in parsed) return parsed.error;

  try {
    const existing = await getAdminStorylineSummary(db, storylineId);
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Storyline not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await db.write.prepare(
      `UPDATE storylines
       SET slug = ?, title = ?, description = ?, path_key = ?, sort_order = ?, is_active = ?, admin_only = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
     ).bind(parsed.slug, parsed.title, parsed.description, parsed.pathKey, parsed.sortOrder, parsed.isActive ? 1 : 0, parsed.adminOnly ? 1 : 0, storylineId).run();

    await logAdminAction(db, {
      adminUserId,
      action: 'update_storyline',
      targetType: 'storyline',
      targetId: storylineId,
      details: JSON.stringify({ slug: parsed.slug, title: parsed.title, adminOnly: parsed.adminOnly }),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    const storyline = await getAdminStorylineSummary(db, storylineId);
    return new Response(JSON.stringify({ storyline }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return new Response(JSON.stringify({ error: 'A storyline with that slug already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('Error updating storyline:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while updating storyline' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function handleAdminStorylineGoalsUpdate(
  request: Request,
  db: DbClient,
  storylineId: number,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).goals)) {
    return new Response(JSON.stringify({ error: 'goals array is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const goals = (body as { goals: unknown[] }).goals;
  const parsedGoals: Array<{ goalId: number; distance: number; sortOrder: number }> = [];

  for (const goal of goals) {
    if (!goal || typeof goal !== 'object') {
      return new Response(JSON.stringify({ error: 'Each goal must be an object' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const row = goal as Record<string, unknown>;
    const goalId = typeof row.goalId === 'number' && Number.isInteger(row.goalId) ? row.goalId : NaN;
    const distance = typeof row.distance === 'number' ? row.distance : NaN;
    const sortOrder = typeof row.sortOrder === 'number' && Number.isInteger(row.sortOrder) ? row.sortOrder : goalId;

    if (!Number.isInteger(goalId) || goalId <= 0 || !Number.isFinite(distance) || distance < 0) {
      return new Response(JSON.stringify({ error: 'Each goal requires a positive goalId and non-negative distance' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    parsedGoals.push({ goalId, distance, sortOrder });
  }

  try {
    const existing = await getAdminStorylineSummary(db, storylineId);
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Storyline not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Full replacement: delete all existing entries, then insert the submitted set.
    const deleteStmt = db.write.prepare(
      'DELETE FROM storyline_goals WHERE storyline_id = ?',
    ).bind(storylineId);

    const insertStatements = parsedGoals.map((goal) => db.write.prepare(
      `INSERT INTO storyline_goals (storyline_id, goal_id, distance, sort_order)
       VALUES (?, ?, ?, ?)`,
    ).bind(storylineId, goal.goalId, goal.distance, goal.sortOrder));

    await db.write.batch([deleteStmt, ...insertStatements]);

    await logAdminAction(db, {
      adminUserId,
      action: 'update_storyline_goals',
      targetType: 'storyline',
      targetId: storylineId,
      details: JSON.stringify({ goalCount: parsedGoals.length }),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    return buildStorylineDetailResponse(db, storylineId);
  } catch (error: unknown) {
    console.error('Error updating storyline goals:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while updating storyline goals' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Row shape for goals queried for image cross-referencing.
 */
