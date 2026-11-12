import type { DbClient } from './db';
import {
  SLUG_REGEX,
  auditIp,
  isUniqueViolation,
  jsonResponse,
  logAdminAction,
} from './admin-shared';
import {
  getAchievementDefinitionBySlug,
  type AchievementDefinition,
} from './achievement-utils';

/** Linked achievement definition returned alongside an encounter definition. */
export interface AdminEncounterBadge {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: boolean;
  metadata: string | null;
}

/** Admin-facing personal encounter definition. */
export interface AdminEncounterDefinition {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string | null;
  badge_slug: string | null;
  duration_days: number;
  target_stretch_multiplier: number;
  target_min_distance: number;
  target_max_distance: number;
  is_repeatable: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  badge: AdminEncounterBadge | null;
  badge_name: string | null;
}

interface AdminEncounterRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string | null;
  badge_slug: string | null;
  duration_days: number;
  target_stretch_multiplier: number;
  target_min_distance: number;
  target_max_distance: number;
  is_repeatable: number;
  enabled: number;
  created_at: string;
  updated_at: string;
  badge_id: number | null;
  badge_name_value: string | null;
  badge_description_value: string | null;
  badge_image_slug_value: string | null;
  badge_type_value: string | null;
  badge_is_repeatable_value: number | null;
  badge_metadata_value: string | null;
}

interface ParsedEncounterFields {
  slug: string;
  name: string;
  description: string;
  imageSlug: string;
  badgeSlug: string;
  durationDays: number;
  targetStretchMultiplier: number;
  targetMinDistance: number;
  targetMaxDistance: number;
  isRepeatable: boolean;
}

interface InlineBadgeFields {
  name: string;
  description: string;
  imageSlug: string;
}

const ENCOUNTER_SELECT = `
  SELECT d.id, d.slug, d.name, d.description, d.image_slug, d.badge_slug,
         d.duration_days, d.target_stretch_multiplier, d.target_min_distance,
         d.target_max_distance, d.is_repeatable, d.enabled, d.created_at, d.updated_at,
         b.id AS badge_id, b.name AS badge_name_value,
         b.description AS badge_description_value, b.image_slug AS badge_image_slug_value,
         b.badge_type AS badge_type_value, b.is_repeatable AS badge_is_repeatable_value,
         b.metadata AS badge_metadata_value
  FROM personal_encounter_definitions d
  LEFT JOIN achievement_definitions b ON b.slug = d.badge_slug
`;

function validationResponse(fields: Record<string, string>): Response {
  return jsonResponse({ error: 'validation', fields }, 400);
}

function toAdminEncounter(row: AdminEncounterRow): AdminEncounterDefinition {
  const badge: AdminEncounterBadge | null = row.badge_id === null
    ? null
    : {
      id: row.badge_id,
      slug: row.badge_slug ?? '',
      name: row.badge_name_value ?? '',
      description: row.badge_description_value,
      image_slug: row.badge_image_slug_value,
      badge_type: row.badge_type_value ?? '',
      is_repeatable: row.badge_is_repeatable_value === 1,
      metadata: row.badge_metadata_value,
    };

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    image_slug: row.image_slug,
    badge_slug: row.badge_slug,
    duration_days: row.duration_days,
    target_stretch_multiplier: row.target_stretch_multiplier,
    target_min_distance: row.target_min_distance,
    target_max_distance: row.target_max_distance,
    is_repeatable: row.is_repeatable === 1,
    enabled: row.enabled === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    badge,
    badge_name: badge?.name ?? null,
  };
}

function parseEncounterFields(body: unknown):
  | { fields: Record<string, string>; error: true }
  | { fields: Record<string, string>; error: false; data: ParsedEncounterFields } {
  if (!body || typeof body !== 'object') {
    return { fields: { body: 'Request body must be a JSON object' }, error: true };
  }

  const data = body as Record<string, unknown>;
  const fields: Record<string, string> = {};

  const slug = typeof data.slug === 'string' ? data.slug.trim() : '';
  if (!slug) {
    fields.slug = 'Slug is required';
  } else if (slug.length > 80) {
    fields.slug = 'Slug must be 80 characters or fewer';
  } else if (!SLUG_REGEX.test(slug)) {
    fields.slug = 'Slug must be lowercase words separated by hyphens';
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) {
    fields.name = 'Name is required';
  } else if (name.length > 120) {
    fields.name = 'Name must be 120 characters or fewer';
  }

  const description = typeof data.description === 'string' ? data.description.trim() : '';
  if (!description) {
    fields.description = 'Description is required';
  } else if (description.length > 2000) {
    fields.description = 'Description must be 2000 characters or fewer';
  }

  const imageSlug = typeof data.image_slug === 'string' ? data.image_slug.trim() : '';
  if (!imageSlug) {
    fields.image_slug = 'Image slug is required';
  } else if (imageSlug.length > 120) {
    fields.image_slug = 'Image slug must be 120 characters or fewer';
  }

  const badgeSlug = typeof data.badge_slug === 'string' ? data.badge_slug.trim() : '';
  if (!badgeSlug) {
    fields.badge_slug = 'Badge slug is required';
  } else if (badgeSlug.length > 120) {
    fields.badge_slug = 'Badge slug must be 120 characters or fewer';
  } else if (!SLUG_REGEX.test(badgeSlug)) {
    fields.badge_slug = 'Badge slug must be lowercase words separated by hyphens';
  }

  const rawDuration = data.duration_days;
  let durationDays = NaN;
  if (rawDuration === undefined || rawDuration === null) {
    fields.duration_days = 'Duration is required';
  } else if (typeof rawDuration !== 'number' || !Number.isInteger(rawDuration)) {
    fields.duration_days = 'Duration must be an integer';
  } else if (rawDuration < 1 || rawDuration > 30) {
    fields.duration_days = 'Duration must be between 1 and 30 days';
  } else {
    durationDays = rawDuration;
  }

  const rawStretch = data.target_stretch_multiplier;
  let targetStretchMultiplier = NaN;
  if (rawStretch === undefined || rawStretch === null) {
    fields.target_stretch_multiplier = 'Target stretch multiplier is required';
  } else if (typeof rawStretch !== 'number' || !Number.isFinite(rawStretch)) {
    fields.target_stretch_multiplier = 'Target stretch multiplier must be a number';
  } else if (rawStretch < 1.0 || rawStretch > 5.0) {
    fields.target_stretch_multiplier = 'Target stretch multiplier must be between 1.0 and 5.0';
  } else {
    targetStretchMultiplier = rawStretch;
  }

  const rawMin = data.target_min_distance;
  let targetMinDistance = NaN;
  if (rawMin === undefined || rawMin === null) {
    fields.target_min_distance = 'Target minimum distance is required';
  } else if (typeof rawMin !== 'number' || !Number.isFinite(rawMin)) {
    fields.target_min_distance = 'Target minimum distance must be a number';
  } else if (rawMin <= 0) {
    fields.target_min_distance = 'Target minimum distance must be greater than 0';
  } else {
    targetMinDistance = rawMin;
  }

  const rawMax = data.target_max_distance;
  let targetMaxDistance = NaN;
  if (rawMax === undefined || rawMax === null) {
    fields.target_max_distance = 'Target maximum distance is required';
  } else if (typeof rawMax !== 'number' || !Number.isFinite(rawMax)) {
    fields.target_max_distance = 'Target maximum distance must be a number';
  } else {
    targetMaxDistance = rawMax;
  }

  if (
    Number.isFinite(targetMinDistance)
    && Number.isFinite(targetMaxDistance)
    && targetMinDistance > targetMaxDistance
  ) {
    fields.target_min_distance = 'Target minimum distance must be less than or equal to the maximum';
    fields.target_max_distance = 'Target maximum distance must be greater than or equal to the minimum';
  }

  let isRepeatable = true;
  if (data.is_repeatable !== undefined) {
    if (typeof data.is_repeatable !== 'boolean') {
      fields.is_repeatable = 'Repeatable must be a boolean';
    } else {
      isRepeatable = data.is_repeatable;
    }
  }

  if (Object.keys(fields).length > 0) {
    return { fields, error: true };
  }

  return {
    fields,
    error: false,
    data: {
      slug,
      name,
      description,
      imageSlug,
      badgeSlug,
      durationDays,
      targetStretchMultiplier,
      targetMinDistance,
      targetMaxDistance,
      isRepeatable,
    },
  };
}

function parseInlineBadgeFields(body: unknown): InlineBadgeFields {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    name: typeof data.badge_name === 'string' ? data.badge_name.trim() : '',
    description: typeof data.badge_description === 'string' ? data.badge_description.trim() : '',
    imageSlug: typeof data.badge_image_slug === 'string' ? data.badge_image_slug.trim() : '',
  };
}

function inlineBadgeValidationErrors(badge: InlineBadgeFields): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!badge.name) fields.badge_name = 'Badge name is required for a new badge';
  if (!badge.description) fields.badge_description = 'Badge description is required for a new badge';
  if (!badge.imageSlug) fields.badge_image_slug = 'Badge image slug is required for a new badge';
  return fields;
}

function hasInlineBadgeFields(badge: InlineBadgeFields): boolean {
  return badge.name !== '' || badge.description !== '' || badge.imageSlug !== '';
}

/**
 * Badge metadata is shared with other consumers (storyline books, the Field
 * Guide, display code). Updating a personal-challenge badge may refresh
 * `rank_thresholds`, but every other key belongs to the badge's existing
 * definition and must survive the edit.
 */
function challengeBadgeMetadata(isRepeatable: boolean, existingMetadata?: string | null): string {
  const rankThresholds = isRepeatable ? [1, 3, 7, 15] : [1];
  let base: Record<string, unknown> = {
    storyline: null,
    unit: 'completions',
    criteria: 'personal_encounter_completed',
  };

  if (existingMetadata) {
    try {
      const parsed: unknown = JSON.parse(existingMetadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>;
      }
    } catch {
      // Unreadable metadata cannot be validated as owned, so this fallback is
      // only reachable for newly created challenge badges.
    }
  }

  return JSON.stringify({ ...base, rank_thresholds: rankThresholds });
}

/** A badge definition owned by the personal-challenge feature. */
function isPersonalChallengeBadge(badge: AchievementDefinition): boolean {
  if (!badge.metadata) return false;
  try {
    const metadata: unknown = JSON.parse(badge.metadata);
    return metadata !== null
      && typeof metadata === 'object'
      && !Array.isArray(metadata)
      && (metadata as Record<string, unknown>).criteria === 'personal_encounter_completed';
  } catch {
    return false;
  }
}

async function getEncounterById(db: DbClient, encounterId: number): Promise<AdminEncounterDefinition | null> {
  const row = await db.read.prepare(`${ENCOUNTER_SELECT} WHERE d.id = ?`)
    .bind(encounterId)
    .first<AdminEncounterRow>();
  return row ? toAdminEncounter(row) : null;
}

function createAchievementStatement(
  db: DbClient,
  slug: string,
  badge: InlineBadgeFields,
  isRepeatable: boolean,
): D1PreparedStatement {
  return db.write.prepare(
    `INSERT INTO achievement_definitions
       (slug, name, description, image_slug, badge_type, is_repeatable, metadata)
     VALUES (?, ?, ?, ?, 'challenge', ?, ?)`,
  ).bind(
    slug,
    badge.name,
    badge.description,
    badge.imageSlug,
    isRepeatable ? 1 : 0,
    challengeBadgeMetadata(isRepeatable),
  );
}

function updateAchievementStatement(
  db: DbClient,
  slug: string,
  existing: AchievementDefinition,
  badge: InlineBadgeFields,
  isRepeatable: boolean,
): D1PreparedStatement {
  // Display-only edits must not churn shared metadata. Rank thresholds are
  // derived from repeatability, so only recompute them when that changes.
  const metadata = existing.is_repeatable === isRepeatable
    ? existing.metadata
    : challengeBadgeMetadata(isRepeatable, existing.metadata);

  return db.write.prepare(
    `UPDATE achievement_definitions
     SET name = ?, description = ?, image_slug = ?, is_repeatable = ?, metadata = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE slug = ?`,
  ).bind(
    badge.name || existing.name,
    badge.description || existing.description,
    badge.imageSlug || existing.image_slug,
    isRepeatable ? 1 : 0,
    metadata,
    slug,
  );
}

async function slugInUse(db: DbClient, slug: string, excludeId?: number): Promise<boolean> {
  const row = excludeId === undefined
    ? await db.read.prepare('SELECT id FROM personal_encounter_definitions WHERE slug = ?')
      .bind(slug).first<{ id: number }>()
    : await db.read.prepare('SELECT id FROM personal_encounter_definitions WHERE slug = ? AND id <> ?')
      .bind(slug, excludeId).first<{ id: number }>();
  return row != null;
}

/**
 * GET /api/admin/encounters — list every personal encounter definition with its
 * current enabled state and linked badge metadata.
 */
export async function handleAdminEncountersList(_request: Request, db: DbClient): Promise<Response> {
  try {
    const { results } = await db.read.prepare(
      `${ENCOUNTER_SELECT} ORDER BY d.id ASC`,
    ).all<AdminEncounterRow>();

    return jsonResponse({
      encounters: (results ?? []).map(toAdminEncounter),
    });
  } catch (error: unknown) {
    console.error('Error fetching admin encounter definitions:', error);
    return jsonResponse({ error: 'Internal server error while fetching encounters' }, 500);
  }
}

/**
 * GET /api/admin/encounters/:id — return one definition, including the full
 * metadata of its linked achievement definition.
 */
export async function handleAdminEncounterGet(
  _request: Request,
  db: DbClient,
  encounterId: number,
): Promise<Response> {
  try {
    const encounter = await getEncounterById(db, encounterId);
    if (!encounter) {
      return jsonResponse({ error: 'Encounter definition not found' }, 404);
    }
    return jsonResponse({ encounter });
  } catch (error: unknown) {
    console.error('Error fetching admin encounter definition:', error);
    return jsonResponse({ error: 'Internal server error while fetching encounter' }, 500);
  }
}

/**
 * POST /api/admin/encounters — create a definition. New definitions are always
 * stored disabled, regardless of an `enabled` value in the request body. When
 * the badge slug is absent from achievement_definitions, the inline badge
 * fields are used to create a complete challenge badge definition.
 */
export async function handleAdminEncounterCreate(
  request: Request,
  db: DbClient,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  const parsed = parseEncounterFields(body);
  if (parsed.error) return validationResponse(parsed.fields);

  const data = parsed.data;
  const inlineBadge = parseInlineBadgeFields(body);

  try {
    if (await slugInUse(db, data.slug)) {
      return validationResponse({ slug: 'Slug is already in use' });
    }

    const existingBadge = await getAchievementDefinitionBySlug(db, data.badgeSlug);
    if (!existingBadge) {
      const badgeErrors = inlineBadgeValidationErrors(inlineBadge);
      if (Object.keys(badgeErrors).length > 0) {
        return validationResponse(badgeErrors);
      }
    }

    const insertDefinition = db.write.prepare(
      `INSERT INTO personal_encounter_definitions
         (slug, name, description, image_slug, badge_slug, duration_days,
          target_stretch_multiplier, target_min_distance, target_max_distance,
          is_repeatable, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ).bind(
      data.slug,
      data.name,
      data.description,
      data.imageSlug,
      data.badgeSlug,
      data.durationDays,
      data.targetStretchMultiplier,
      data.targetMinDistance,
      data.targetMaxDistance,
      data.isRepeatable ? 1 : 0,
    );

    const badgeCreated = !existingBadge;
    const statements = [insertDefinition];
    if (badgeCreated) {
      statements.push(createAchievementStatement(db, data.badgeSlug, inlineBadge, data.isRepeatable));
    }

    // Definition and badge are one D1 batch, so a failed badge write cannot
    // leave an encounter definition without its badge (and vice versa).
    const results = await db.write.batch(statements);
    const newId = (results[0]?.meta as Record<string, unknown> | undefined)?.last_row_id;
    if (typeof newId !== 'number' || !Number.isFinite(newId)) {
      console.error('Failed to retrieve new encounter definition ID from INSERT result');
      return jsonResponse({ error: 'Internal server error while creating encounter' }, 500);
    }

    await logAdminAction(db, {
      adminUserId,
      action: 'create_encounter',
      targetType: 'personal_encounter',
      targetId: newId,
      details: JSON.stringify({
        slug: data.slug,
        name: data.name,
        description: data.description,
        image_slug: data.imageSlug,
        badge_slug: data.badgeSlug,
        duration_days: data.durationDays,
        target_stretch_multiplier: data.targetStretchMultiplier,
        target_min_distance: data.targetMinDistance,
        target_max_distance: data.targetMaxDistance,
        is_repeatable: data.isRepeatable,
        enabled: false,
        badge_created: badgeCreated,
      }),
      ipAddress: auditIp(request),
      success: true,
    });

    const encounter = await getEncounterById(db, newId);
    if (!encounter) {
      console.error('Failed to fetch newly created encounter definition with ID:', newId);
      return jsonResponse({ error: 'Internal server error while creating encounter' }, 500);
    }

    return jsonResponse({ encounter }, 201);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return validationResponse({ slug: 'Slug is already in use' });
    }
    console.error('Error creating admin encounter definition:', error);
    return jsonResponse({ error: 'Internal server error while creating encounter' }, 500);
  }
}

/**
 * PUT /api/admin/encounters/:id — update definition fields and manage the linked
 * badge. The previous badge definition is never deleted, so earned achievement
 * history stays readable after a badge slug change. The enabled flag is managed
 * exclusively by the enable/disable endpoints.
 */
export async function handleAdminEncounterUpdate(
  request: Request,
  db: DbClient,
  encounterId: number,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  const parsed = parseEncounterFields(body);
  if (parsed.error) return validationResponse(parsed.fields);

  const data = parsed.data;
  const inlineBadge = parseInlineBadgeFields(body);

  try {
    const existing = await getEncounterById(db, encounterId);
    if (!existing) {
      return jsonResponse({ error: 'Encounter definition not found' }, 404);
    }

    if (await slugInUse(db, data.slug, encounterId)) {
      return validationResponse({ slug: 'Slug is already in use' });
    }

    const existingBadge = await getAchievementDefinitionBySlug(db, data.badgeSlug);
    if (!existingBadge) {
      const badgeErrors = inlineBadgeValidationErrors(inlineBadge);
      if (Object.keys(badgeErrors).length > 0) {
        return validationResponse(badgeErrors);
      }
    }

    const updateDefinition = db.write.prepare(
      `UPDATE personal_encounter_definitions
       SET slug = ?, name = ?, description = ?, image_slug = ?, badge_slug = ?,
           duration_days = ?, target_stretch_multiplier = ?, target_min_distance = ?,
           target_max_distance = ?, is_repeatable = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).bind(
      data.slug,
      data.name,
      data.description,
      data.imageSlug,
      data.badgeSlug,
      data.durationDays,
      data.targetStretchMultiplier,
      data.targetMinDistance,
      data.targetMaxDistance,
      data.isRepeatable ? 1 : 0,
      encounterId,
    );

    let badgeCreated = false;
    let badgeUpdated = false;
    const statements = [updateDefinition];

    if (!existingBadge) {
      statements.push(createAchievementStatement(db, data.badgeSlug, inlineBadge, data.isRepeatable));
      badgeCreated = true;
    } else if (
      isPersonalChallengeBadge(existingBadge)
      && (
        hasInlineBadgeFields(inlineBadge)
        || existing.is_repeatable !== data.isRepeatable
      )
    ) {
      statements.push(
        updateAchievementStatement(
          db,
          data.badgeSlug,
          existingBadge,
          inlineBadge,
          data.isRepeatable,
        ),
      );
      badgeUpdated = true;
    }

    // Definition and badge are one D1 batch, so a failed badge write cannot
    // leave the definition updated against a stale badge (and vice versa).
    await db.write.batch(statements);

    const changes: Record<string, { old: unknown; new: unknown }> = {};
    if (existing.slug !== data.slug) changes.slug = { old: existing.slug, new: data.slug };
    if (existing.name !== data.name) changes.name = { old: existing.name, new: data.name };
    if (existing.description !== data.description) {
      changes.description = { old: '(truncated)', new: '(truncated)' };
    }
    if (existing.image_slug !== data.imageSlug) {
      changes.image_slug = { old: existing.image_slug, new: data.imageSlug };
    }
    if (existing.badge_slug !== data.badgeSlug) {
      changes.badge_slug = { old: existing.badge_slug, new: data.badgeSlug };
    }
    if (existing.duration_days !== data.durationDays) {
      changes.duration_days = { old: existing.duration_days, new: data.durationDays };
    }
    if (existing.target_stretch_multiplier !== data.targetStretchMultiplier) {
      changes.target_stretch_multiplier = {
        old: existing.target_stretch_multiplier,
        new: data.targetStretchMultiplier,
      };
    }
    if (existing.target_min_distance !== data.targetMinDistance) {
      changes.target_min_distance = { old: existing.target_min_distance, new: data.targetMinDistance };
    }
    if (existing.target_max_distance !== data.targetMaxDistance) {
      changes.target_max_distance = { old: existing.target_max_distance, new: data.targetMaxDistance };
    }
    if (existing.is_repeatable !== data.isRepeatable) {
      changes.is_repeatable = { old: existing.is_repeatable, new: data.isRepeatable };
    }

    await logAdminAction(db, {
      adminUserId,
      action: 'update_encounter',
      targetType: 'personal_encounter',
      targetId: encounterId,
      details: JSON.stringify({
        changes,
        badge: {
          slug: data.badgeSlug,
          created: badgeCreated,
          updated: badgeUpdated,
        },
      }),
      ipAddress: auditIp(request),
      success: true,
    });

    const encounter = await getEncounterById(db, encounterId);
    if (!encounter) {
      return jsonResponse({ error: 'Encounter definition not found' }, 404);
    }

    return jsonResponse({ encounter });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return validationResponse({ slug: 'Slug is already in use' });
    }
    console.error('Error updating admin encounter definition:', error);
    return jsonResponse({ error: 'Internal server error while updating encounter' }, 500);
  }
}

/**
 * PUT /api/admin/encounters/:id/enable — allow the definition to be rolled.
 */
export async function handleAdminEncounterEnable(
  request: Request,
  db: DbClient,
  encounterId: number,
  adminUserId: number,
): Promise<Response> {
  try {
    const existing = await getEncounterById(db, encounterId);
    if (!existing) {
      return jsonResponse({ error: 'Encounter definition not found' }, 404);
    }

    await db.write.prepare(
      'UPDATE personal_encounter_definitions SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).bind(encounterId).run();

    await logAdminAction(db, {
      adminUserId,
      action: 'enable_encounter',
      targetType: 'personal_encounter',
      targetId: encounterId,
      details: JSON.stringify({ enabled: true }),
      ipAddress: auditIp(request),
      success: true,
    });

    const encounter = await getEncounterById(db, encounterId);
    return jsonResponse({ encounter });
  } catch (error: unknown) {
    console.error('Error enabling admin encounter definition:', error);
    return jsonResponse({ error: 'Internal server error while enabling encounter' }, 500);
  }
}

/**
 * PUT /api/admin/encounters/:id/disable — disable future rolls. When active
 * occurrences exist and no `cancelActive` decision is supplied, returns a
 * confirmation payload instead of mutating anything. Sending
 * `cancelActive: true` marks active occurrences failed without awarding badges
 * or running settlement.
 */
export async function handleAdminEncounterDisable(
  request: Request,
  db: DbClient,
  encounterId: number,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  const rawCancelActive = body && typeof body === 'object'
    ? (body as Record<string, unknown>).cancelActive
    : undefined;
  const cancelActive = typeof rawCancelActive === 'boolean' ? rawCancelActive : null;

  try {
    const existing = await getEncounterById(db, encounterId);
    if (!existing) {
      return jsonResponse({ error: 'Encounter definition not found' }, 404);
    }

    const activeRow = await db.read.prepare(
      `SELECT COUNT(*) AS count FROM encounter_occurrences
       WHERE definition_id = ? AND status = 'active'`,
    ).bind(encounterId).first<{ count: number }>();
    const activeOccurrences = Number(activeRow?.count ?? 0);

    if (activeOccurrences > 0 && cancelActive === null) {
      return jsonResponse({ activeOccurrences, requiresConfirmation: true }, 400);
    }

    let cancelledOccurrences = 0;
    if (activeOccurrences > 0 && cancelActive === true) {
      const cancelResult = await db.write.prepare(
        `UPDATE encounter_occurrences
         SET status = 'failed', updated_at = CURRENT_TIMESTAMP
         WHERE definition_id = ? AND status = 'active'`,
      ).bind(encounterId).run();
      const changed = (cancelResult.meta as Record<string, unknown>).changes;
      cancelledOccurrences = typeof changed === 'number' ? changed : activeOccurrences;
    }

    await db.write.prepare(
      'UPDATE personal_encounter_definitions SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).bind(encounterId).run();

    await logAdminAction(db, {
      adminUserId,
      action: 'disable_encounter',
      targetType: 'personal_encounter',
      targetId: encounterId,
      details: JSON.stringify({
        enabled: false,
        activeOccurrences,
        cancelActive: cancelActive === true,
        cancelledOccurrences,
      }),
      ipAddress: auditIp(request),
      success: true,
    });

    if (cancelledOccurrences > 0) {
      await logAdminAction(db, {
        adminUserId,
        action: 'cancel_active_occurrences',
        targetType: 'personal_encounter',
        targetId: encounterId,
        details: JSON.stringify({ cancelledOccurrences }),
        ipAddress: auditIp(request),
        success: true,
      });
    }

    const encounter = await getEncounterById(db, encounterId);
    return jsonResponse({ encounter });
  } catch (error: unknown) {
    console.error('Error disabling admin encounter definition:', error);
    return jsonResponse({ error: 'Internal server error while disabling encounter' }, 500);
  }
}
