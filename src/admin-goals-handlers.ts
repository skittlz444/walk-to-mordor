import type { DbClient } from './db';
import {
  SLUG_REGEX,
  escapeLikeSearch,
  logAdminAction,
} from './admin-shared';

/**
 * A single goal row returned by the admin goals list API.
 */
export interface AdminGoalRow {
  id: number;
  title: string;
  distance: number;
  description: string | null;
  special: string | null;
  image_id: string | null;
  has_image: boolean;
}

/**
 * Paginated response returned by GET /api/admin/goals.
 */
export interface AdminGoalsListResponse {
  goals: AdminGoalRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * A single goal's full data for the admin goal edit API.
 */
export interface AdminGoalDetail {
  id: number;
  title: string;
  distance: number;
  description: string | null;
  special: string | null;
  image_id: string | null;
}

/**
 * Shape of the build-time image manifest (public/img/image-manifest.json).
 */
export interface ImageManifest {
  generated: string;
  images: string[];
  count: number;
}

/**
 * Response shape for GET /api/admin/images.
 */
export interface ImageInventoryResponse {
  images: Array<{ image_id: string; has_highres: boolean; has_thumb: boolean }>;
  total: number;
  orphaned: string[];
  missing: Array<{ goal_id: number; title: string; image_id: string }>;
}

/**
 * Handle GET /api/admin/goals — returns a paginated, searchable, sortable list of goals.
 * Requires admin authentication (enforced by the route guard in index.ts).
 *
 * Query parameters:
 *   - page (default 1)
 *   - pageSize (default 25, max 100)
 *   - search (optional, performs a text search over goal fields)
 *   - imageFilter ('missing' optional, limits goals to rows without image_id)
 *   - order ('asc' | 'desc', default 'asc' — by distance)
 */
export async function handleAdminGoalsList(request: Request, db: DbClient): Promise<Response> {
  try {
    const url = new URL(request.url);
    const rawPage = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25));
    const search = url.searchParams.get('search')?.trim() ?? '';
    const imageFilter = url.searchParams.get('imageFilter') === 'missing' ? 'missing' : '';
    const order = url.searchParams.get('order') === 'desc' ? 'DESC' : 'ASC';

    // Build queries with parameterized bindings
    let countSql = 'SELECT COUNT(*) as total FROM goals';
    let dataSql = 'SELECT id, title, distance, description, special, image_id FROM goals';
    const countBindings: (string | number)[] = [];
    const dataBindings: (string | number)[] = [];
    const whereClauses: string[] = [];

    if (search) {
      // Search across all goal fields: title, description, special, image_id, id, distance
      const searchFields = [
        'title', 'description', 'special', 'image_id', 'CAST(id AS TEXT)', 'CAST(distance AS TEXT)',
      ];
      whereClauses.push(`(${searchFields.map((f) => `${f} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
      // Escape LIKE wildcards in user input to prevent unintended pattern matching
      const escapedSearch = escapeLikeSearch(search);
      const searchParam = `%${escapedSearch}%`;
      for (let i = 0; i < searchFields.length; i++) {
        countBindings.push(searchParam);
        dataBindings.push(searchParam);
      }
    }

    if (imageFilter === 'missing') {
      whereClauses.push("(image_id IS NULL OR image_id = '')");
    }

    if (whereClauses.length > 0) {
      const whereClause = ` WHERE ${whereClauses.join(' AND ')}`;
      countSql += whereClause;
      dataSql += whereClause;
    }

    dataSql += ` ORDER BY distance ${order} LIMIT ? OFFSET ?`;
    dataBindings.push(pageSize);

    // Get total count first to clamp page
    const countResult = countBindings.length > 0
      ? await db.read.prepare(countSql).bind(...countBindings).first<{ total: number }>()
      : await db.read.prepare(countSql).first<{ total: number }>();

    const total = countResult?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // Clamp page to valid range so clients never see "Page 999 of 8"
    const page = Math.min(rawPage, totalPages);
    const offset = (page - 1) * pageSize;
    dataBindings.push(offset);

    const dataResult = await db.read.prepare(dataSql).bind(...dataBindings).all();

    // Map results with computed has_image field
    const goals: AdminGoalRow[] = (dataResult.results as Array<{
      id: number;
      title: string;
      distance: number;
      description: string | null;
      special: string | null;
      image_id: string | null;
    }>).map((row) => ({
      id: row.id,
      title: row.title,
      distance: row.distance,
      description: row.description,
      special: row.special,
      image_id: row.image_id,
      has_image: row.image_id !== null && row.image_id !== '',
    }));

    const response: AdminGoalsListResponse = {
      goals,
      total,
      page,
      pageSize,
      totalPages,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Database error fetching admin goals list:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while fetching goals' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle GET /api/admin/goals/:id — returns a single goal's full details.
 * Requires admin authentication (enforced by the route guard in index.ts).
 */
export async function handleAdminGoalGet(_request: Request, db: DbClient, goalId: number): Promise<Response> {
  try {
    const goal = await db.read.prepare(
      'SELECT id, title, distance, description, special, image_id FROM goals WHERE id = ?'
    ).bind(goalId).first<AdminGoalDetail>();

    if (!goal) {
      return new Response(JSON.stringify({ error: 'Goal not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(goal), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching goal:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle PUT /api/admin/goals/:id — update a goal's editable fields.
 * Requires admin authentication (enforced by the route guard in index.ts).
 * The adminUserId is needed for audit logging.
 */
export async function handleAdminGoalUpdate(
  request: Request,
  db: DbClient,
  goalId: number,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  try {
    // 1. Validate body shape and fields
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const data = body as Record<string, unknown>;
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const distance = typeof data.distance === 'number' ? data.distance : NaN;
    const description = typeof data.description === 'string' ? data.description.trim() : '';
    const special = typeof data.special === 'string' && data.special.trim() !== '' ? data.special.trim() : null;
    const imageId = typeof data.image_id === 'string' && data.image_id.trim() !== '' ? data.image_id.trim() : null;

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (isNaN(distance) || !isFinite(distance) || distance <= 0) {
      return new Response(JSON.stringify({ error: 'Distance must be a positive number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!description) {
      return new Response(JSON.stringify({ error: 'Description is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (imageId && !SLUG_REGEX.test(imageId)) {
      return new Response(JSON.stringify({ error: 'Image ID must be a valid slug format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch existing goal for 404 check and audit diff
    const existing = await db.read.prepare(
      'SELECT id, title, distance, description, special, image_id FROM goals WHERE id = ?'
    ).bind(goalId).first<AdminGoalDetail>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Goal not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Update
    await db.write.prepare(
      'UPDATE goals SET title=?, distance=?, description=?, special=?, image_id=? WHERE id = ?'
    ).bind(title, distance, description, special, imageId, goalId).run();

    // 4. Audit log — compute changed fields
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    if (existing.title !== title) changes.title = { old: existing.title, new: title };
    if (existing.distance !== distance) changes.distance = { old: existing.distance, new: distance };
    if (existing.description !== description) changes.description = { old: '(truncated)', new: '(truncated)' };
    if (existing.special !== special) changes.special = { old: existing.special, new: special };
    if (existing.image_id !== imageId) changes.image_id = { old: existing.image_id, new: imageId };

    await logAdminAction(db, {
      adminUserId,
      action: 'update_goal',
      targetType: 'goal',
      targetId: goalId,
      details: JSON.stringify(changes),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    // 5. Return updated goal
    const updated = await db.read.prepare(
      'SELECT id, title, distance, description, special, image_id FROM goals WHERE id = ?'
    ).bind(goalId).first<AdminGoalDetail>();

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error updating goal:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle POST /api/admin/goals — create a new goal.
 * Requires admin authentication (enforced by the route guard in index.ts).
 * The adminUserId is needed for audit logging.
 */
export async function handleAdminGoalCreate(
  request: Request,
  db: DbClient,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  try {
    // 1. Validate body shape and fields
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const data = body as Record<string, unknown>;
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const rawDistance = data.distance_miles;
    const distanceMiles = typeof rawDistance === 'number' ? rawDistance : NaN;
    const description = typeof data.description === 'string' ? data.description.trim() : '';
    const special = typeof data.special === 'string' && data.special.trim() !== '' ? data.special.trim() : null;
    const imageId = typeof data.image_id === 'string' && data.image_id.trim() !== '' ? data.image_id.trim() : null;

    if (!title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (rawDistance === undefined || rawDistance === null) {
      return new Response(JSON.stringify({ error: 'Distance must be a positive number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (typeof rawDistance !== 'number' || isNaN(distanceMiles)) {
      return new Response(JSON.stringify({ error: 'Invalid distance value' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!isFinite(distanceMiles) || distanceMiles <= 0) {
      return new Response(JSON.stringify({ error: 'Distance must be a positive number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (imageId && !SLUG_REGEX.test(imageId)) {
      return new Response(JSON.stringify({ error: 'Image ID must be a valid slug format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Convert distance: miles → km
    const distanceKm = distanceMiles * 1.60934;

    // 3. Parameterized INSERT
    const insertResult = await db.write.prepare(
      'INSERT INTO goals (distance, title, description, special, image_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(distanceKm, title, description || null, special, imageId).run();

    // D1 returns last_row_id in meta
    const newGoalId = (insertResult.meta as Record<string, unknown>).last_row_id;
    if (typeof newGoalId !== 'number' || !Number.isFinite(newGoalId)) {
      console.error('Failed to retrieve new goal ID from INSERT result');
      return new Response(JSON.stringify({ error: 'Internal server error while creating goal' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Fetch created record
    const createdGoal = await db.read.prepare(
      'SELECT id, title, distance, description, special, image_id FROM goals WHERE id = ?'
    ).bind(newGoalId).first<AdminGoalDetail>();

    if (!createdGoal) {
      console.error('Failed to fetch newly created goal with ID:', newGoalId);
      return new Response(JSON.stringify({ error: 'Internal server error while creating goal' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Audit log
    await logAdminAction(db, {
      adminUserId,
      action: 'create_goal',
      targetType: 'goal',
      targetId: newGoalId,
      details: JSON.stringify({ title, distance_miles: distanceMiles, distance_km: distanceKm }),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      success: true,
    });

    // 6. Return 201 with created record
    return new Response(JSON.stringify(createdGoal), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error creating goal:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle GET /api/admin/images — returns image asset inventory.
 * Cross-references the build-time image manifest against goal image_id assignments.
 * Requires admin authentication (enforced by the route guard in index.ts).
 */
export async function handleAdminImageInventory(request: Request, db: DbClient, assets: Fetcher): Promise<Response> {
  try {
    // 1. Fetch the image manifest via Workers Assets binding
    const manifestUrl = new URL('/img/image-manifest.json', request.url);
    let manifestResponse: Response;
    try {
      manifestResponse = await assets.fetch(new Request(manifestUrl.toString()));
    } catch {
      return new Response(JSON.stringify({ error: 'Image manifest not available — run npm run build:manifest' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!manifestResponse.ok) {
      return new Response(JSON.stringify({ error: 'Image manifest not available — run npm run build:manifest' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let manifest: ImageManifest;
    try {
      manifest = await manifestResponse.json() as ImageManifest;
    } catch {
      return new Response(JSON.stringify({ error: 'Image manifest is malformed — run npm run build:manifest to regenerate' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const manifestSlugs = new Set(manifest.images);

    // 2. Query all goals with non-null image_id
    const goalsResult = await db.read.prepare(
      'SELECT id, title, image_id FROM goals WHERE image_id IS NOT NULL AND image_id != \'\''
    ).all();

    const goalRows = (goalsResult.results ?? []) as Array<{ id: number; title: string; image_id: string | null }>;

    // 3. Cross-reference: build sets for assigned slugs
    const assignedSlugs = new Set<string>();
    for (const row of goalRows) {
      if (row.image_id) {
        assignedSlugs.add(row.image_id);
      }
    }

    // images: goal image_ids that exist in the manifest
    const images: Array<{ image_id: string; has_highres: boolean; has_thumb: boolean }> = [];
    for (const slug of assignedSlugs) {
      if (manifestSlugs.has(slug)) {
        images.push({ image_id: slug, has_highres: true, has_thumb: true });
      }
    }
    images.sort((a, b) => a.image_id.localeCompare(b.image_id));

    // orphaned: manifest slugs not referenced by any goal
    const orphaned = manifest.images.filter(slug => !assignedSlugs.has(slug)).sort();

    // missing: goals whose image_id is not in the manifest
    const missing: Array<{ goal_id: number; title: string; image_id: string }> = [];
    for (const row of goalRows) {
      if (row.image_id && !manifestSlugs.has(row.image_id)) {
        missing.push({ goal_id: row.id, title: row.title, image_id: row.image_id });
      }
    }
    missing.sort((a, b) => a.goal_id - b.goal_id);

    const response: ImageInventoryResponse = {
      images,
      total: manifest.count,
      orphaned,
      missing,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching image inventory:', error);
    return new Response(JSON.stringify({ error: 'Internal server error while fetching image inventory' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
