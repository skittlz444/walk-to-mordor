// Admin layer for community campaigns: definition CRUD, inline badge
// management, metric suggestions, enable/disable with participant
// confirmation, and the append-only retrigger action.
//
// Handlers rely on the `adminGuard` middleware (no per-handler session
// validation) and read the acting admin from the route layer via
// `adminUserId`. All mutations are audit-logged; retrigger writes its run and
// audit row in one D1 batch so a partial action is impossible.
import type { DbClient } from './db';
import { SLUG_REGEX, logAdminAction } from './admin-shared';
import {
  getAchievementDefinitionBySlug,
  type AchievementDefinition,
} from './achievement-utils';
import {
  backfillParticipantWalks,
  getActiveCampaignRun,
  listCampaignRuns,
  type CampaignParticipant,
  type CampaignRun,
} from './campaign-utils';
import {
  buildCommunityCampaignCreatedPayload,
  dispatchPushInBackground,
  listCommunityCampaignAudienceUserIds,
  sendPushToUserIds,
  type PushDispatchContext,
} from './push-utils';
import { addDays, utcToday } from './event-utils';

// ── Constants ──────────────────────────────────────────────────────────────

/** Documented opt-in assumption for the suggestion formula. */
const OPT_IN_RATE = 0.25;
const SUGGESTION_WINDOW_DAYS = 30;
const DEFAULT_DURATION_DAYS = 14;
const MIN_DURATION_DAYS = 7;
const MAX_DURATION_DAYS = 30;
const DEFAULT_RUN_LENGTH_DAYS = 14;
const DEFAULT_RANK_THRESHOLDS = [1, 3, 7, 15];

// ── Public payload types ───────────────────────────────────────────────────

/** Linked achievement definition returned alongside a campaign. */
export interface AdminCampaignBadge {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: boolean;
  metadata: string | null;
}

/** Admin-facing campaign definition with its current and latest run. */
export interface AdminCampaignDefinition {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string | null;
  badge_slug: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  badge: AdminCampaignBadge | null;
  badge_name: string | null;
  /** The upcoming/active run, if any. */
  activeRun: CampaignRun | null;
  /** Highest-numbered run regardless of status. */
  latestRun: CampaignRun | null;
  activeParticipantCount: number;
  /** Every run, oldest first. Present on detail reads only. */
  runs?: CampaignRun[];
}

/** Community metric suggestions derived from the past 30 days of walks. */
export interface CampaignSuggestions {
  suggestedTargetDistance: number;
  suggestedDurationDays: number;
  suggestedParticipantCount: number;
  thirtyDayTotalDistance: number;
  thirtyDayActiveUsers: number;
}

// ── Row + parse shapes ─────────────────────────────────────────────────────

interface AdminCampaignRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string | null;
  badge_slug: string | null;
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

interface ParsedCampaignFields {
  slug: string;
  name: string;
  description: string;
  imageSlug: string;
  badgeSlug: string;
  targetDistance: number;
  startDate: string;
  endDate: string;
}

interface InlineBadgeFields {
  name: string;
  description: string;
  imageSlug: string;
  repeatable: boolean | null;
  rankThresholds: number[] | null;
}

interface ParticipantRow {
  id: number;
  campaign_id: number;
  run_id: number;
  user_id: number;
  progress_distance: number;
  joined_at: string;
  status: 'active' | 'removed';
  removed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CountRow {
  count: number;
  run_id?: number;
}

interface ProgressTotalsRow {
  total_distance: number;
  active_users: number;
}

// ── SQL fragments ──────────────────────────────────────────────────────────

const CAMPAIGN_SELECT = `
  SELECT d.id, d.slug, d.name, d.description, d.image_slug, d.badge_slug,
         d.enabled, d.created_at, d.updated_at,
         b.id AS badge_id, b.name AS badge_name_value,
         b.description AS badge_description_value, b.image_slug AS badge_image_slug_value,
         b.badge_type AS badge_type_value, b.is_repeatable AS badge_is_repeatable_value,
         b.metadata AS badge_metadata_value
  FROM campaign_definitions d
  LEFT JOIN achievement_definitions b ON b.slug = d.badge_slug
`;

// ── Shared helpers ─────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validationResponse(fields: Record<string, string>): Response {
  return jsonResponse({ error: 'validation', fields }, 400);
}

function auditIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

/** Best-effort UNIQUE detection; native driver errors may cross vm realms. */
function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('UNIQUE');
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function toAdminCampaignBase(row: AdminCampaignRow): AdminCampaignDefinition {
  const badge: AdminCampaignBadge | null = row.badge_id === null
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
    enabled: row.enabled === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    badge,
    badge_name: badge?.name ?? null,
    activeRun: null,
    latestRun: null,
    activeParticipantCount: 0,
  };
}

function splitRuns(runs: CampaignRun[]): { activeRun: CampaignRun | null; latestRun: CampaignRun | null } {
  const activeRun = [...runs].reverse().find(
    (run) => run.status === 'upcoming' || run.status === 'active',
  ) ?? null;
  const latestRun = runs.length > 0 ? runs[runs.length - 1] : null;
  return { activeRun, latestRun };
}

async function countActiveParticipants(db: DbClient, campaignId: number): Promise<number> {
  const row = await db.read.prepare(
    `SELECT COUNT(*) AS count FROM campaign_participants
     WHERE campaign_id = ? AND status = 'active'`,
  ).bind(campaignId).first<CountRow>();
  return Number(row?.count ?? 0);
}

async function getAdminCampaign(db: DbClient, campaignId: number): Promise<AdminCampaignDefinition | null> {
  const row = await db.read.prepare(`${CAMPAIGN_SELECT} WHERE d.id = ?`)
    .bind(campaignId)
    .first<AdminCampaignRow>();
  if (!row) return null;

  const runs = await listCampaignRuns(db, campaignId);
  const { activeRun, latestRun } = splitRuns(runs);
  const participantRow = activeRun
    ? await db.read.prepare(
      `SELECT COUNT(*) AS count FROM campaign_participants
       WHERE run_id = ? AND status = 'active'`,
    ).bind(activeRun.id).first<CountRow>()
    : null;

  return {
    ...toAdminCampaignBase(row),
    activeRun,
    latestRun,
    activeParticipantCount: Number(participantRow?.count ?? 0),
    runs,
  };
}

async function slugInUse(db: DbClient, slug: string, excludeId?: number): Promise<boolean> {
  const row = excludeId === undefined
    ? await db.read.prepare('SELECT id FROM campaign_definitions WHERE slug = ?')
      .bind(slug).first<{ id: number }>()
    : await db.read.prepare('SELECT id FROM campaign_definitions WHERE slug = ? AND id <> ?')
      .bind(slug, excludeId).first<{ id: number }>();
  return row != null;
}

/**
 * Announce a run exactly once. The guarded stamp is the dispatch decision: only
 * the caller that flips `announced_at` from NULL schedules delivery, so a
 * seeded run stays silent until enabling and a disable→enable maintenance cycle
 * re-announces nothing. Delivery is best-effort and never affects the response.
 */
async function announceCampaignRunOnce(
  db: DbClient,
  runId: number,
  campaign: { name: string; slug: string },
  runNumber: number,
  pushContext: PushDispatchContext | undefined,
): Promise<void> {
  if (!pushContext) return;
  const context = pushContext;
  const payload = buildCommunityCampaignCreatedPayload(campaign.name, campaign.slug, runNumber);

  try {
    const announcement = await db.write.prepare(
      `UPDATE campaign_runs
       SET announced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND announced_at IS NULL`,
    ).bind(runId).run();
    if (announcement.meta.changes === 0) return;
  } catch (error: unknown) {
    // Announcement bookkeeping is best-effort: the campaign operation that
    // brought the run into existence must still succeed.
    console.error('Error stamping community campaign run announcement:', error);
    return;
  }

  dispatchPushInBackground(context, async () => {
    const userIds = await listCommunityCampaignAudienceUserIds(db);
    await sendPushToUserIds(db, userIds, payload, context.env);
  });
}

// ── Field validation ───────────────────────────────────────────────────────

function parseCampaignFields(
  body: unknown,
  mode: 'create' | 'update',
): { fields: Record<string, string>; error: true } | {
  fields: Record<string, string>;
  error: false;
  data: ParsedCampaignFields;
} {
  if (!body || typeof body !== 'object') {
    return { fields: { body: 'Request body must be a JSON object' }, error: true };
  }

  const data = body as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const today = utcToday();

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
  }

  const rawTarget = data.target_distance;
  let targetDistance = NaN;
  if (rawTarget === undefined || rawTarget === null) {
    fields.target_distance = 'Target distance is required';
  } else if (typeof rawTarget !== 'number' || !Number.isFinite(rawTarget)) {
    fields.target_distance = 'Target distance must be a number';
  } else if (rawTarget <= 0) {
    fields.target_distance = 'Target distance must be greater than 0';
  } else {
    targetDistance = rawTarget;
  }

  const startDate = typeof data.start_date === 'string' ? data.start_date.trim() : '';
  if (!startDate) {
    fields.start_date = 'Start date is required';
  } else if (!isIsoDate(startDate)) {
    fields.start_date = 'Start date must be an ISO date (YYYY-MM-DD)';
  } else if (mode === 'create' && startDate < today) {
    fields.start_date = 'Start date must be today or later';
  }

  const endDate = typeof data.end_date === 'string' ? data.end_date.trim() : '';
  if (!endDate) {
    fields.end_date = 'End date is required';
  } else if (!isIsoDate(endDate)) {
    fields.end_date = 'End date must be an ISO date (YYYY-MM-DD)';
  } else if (isIsoDate(startDate) && endDate <= startDate) {
    fields.end_date = 'End date must be after the start date';
  }

  if (Object.keys(fields).length > 0) {
    return { fields, error: true };
  }

  return {
    fields,
    error: false,
    data: { slug, name, description, imageSlug, badgeSlug, targetDistance, startDate, endDate },
  };
}

function parseInlineBadgeFields(
  body: unknown,
): { fields: Record<string, string>; error: true } | {
  fields: Record<string, string>;
  error: false;
  data: InlineBadgeFields;
} {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const fields: Record<string, string> = {};

  let repeatable: boolean | null = null;
  if (data.repeatable !== undefined && data.repeatable !== null) {
    if (typeof data.repeatable !== 'boolean') {
      fields.repeatable = 'Repeatable must be a boolean';
    } else {
      repeatable = data.repeatable;
    }
  }

  let rankThresholds: number[] | null = null;
  if (data.rank_thresholds !== undefined && data.rank_thresholds !== null) {
    const raw = data.rank_thresholds;
    if (
      !Array.isArray(raw)
      || raw.length === 0
      || raw.some((value) => typeof value !== 'number' || !Number.isInteger(value) || value < 1)
    ) {
      fields.rank_thresholds = 'Rank thresholds must be a non-empty list of positive integers';
    } else {
      const values = raw as number[];
      const ascending = values.every((value, index) => index === 0 || value > values[index - 1]);
      if (!ascending) {
        fields.rank_thresholds = 'Rank thresholds must be unique and ascending';
      } else {
        rankThresholds = values;
      }
    }
  }

  if (Object.keys(fields).length > 0) return { fields, error: true };

  return {
    fields,
    error: false,
    data: {
      name: typeof data.badge_name === 'string' ? data.badge_name.trim() : '',
      description: typeof data.badge_description === 'string'
        ? data.badge_description.trim()
        : '',
      imageSlug: typeof data.badge_image_slug === 'string' ? data.badge_image_slug.trim() : '',
      repeatable,
      rankThresholds,
    },
  };
}

function inlineBadgeValidationErrors(badge: InlineBadgeFields): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!badge.name) fields.badge_name = 'Badge name is required for a new badge';
  if (!badge.description) fields.badge_description = 'Badge description is required for a new badge';
  if (!badge.imageSlug) fields.badge_image_slug = 'Badge image slug is required for a new badge';
  return fields;
}

// ── Badge management ───────────────────────────────────────────────────────

function readRankThresholds(metadata: string | null | undefined): number[] | null {
  if (!metadata) return null;
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const value = (parsed as Record<string, unknown>).rank_thresholds;
    if (!Array.isArray(value)) return null;
    if (!value.every((entry) => typeof entry === 'number' && Number.isInteger(entry))) return null;
    return value as number[];
  } catch {
    return null;
  }
}

/**
 * Community badge metadata shares the catalog with other features, so every
 * unrelated key is preserved. `rank_thresholds` is the only key this surface
 * owns, and `rank` is always removed because it would override the thresholds.
 */
function communityBadgeMetadata(
  isRepeatable: boolean,
  thresholds: number[] | null,
  existingMetadata?: string | null,
): string {
  let base: Record<string, unknown> = {
    storyline: null,
    unit: 'campaigns',
    criteria: 'community_campaign_completed',
  };

  if (existingMetadata) {
    try {
      const parsed: unknown = JSON.parse(existingMetadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>;
      }
    } catch {
      // Unreadable metadata cannot be validated as owned; fall back to the
      // community defaults for a badge this handler is allowed to create.
    }
  }

  const rankThresholds = isRepeatable
    ? (thresholds ?? readRankThresholds(existingMetadata) ?? DEFAULT_RANK_THRESHOLDS)
    : [1];

  const next: Record<string, unknown> = { ...base, rank_thresholds: rankThresholds };
  delete next.rank;
  return JSON.stringify(next);
}

function badgeEditRequested(existing: AchievementDefinition, inline: InlineBadgeFields): boolean {
  if (inline.name !== '' && inline.name !== existing.name) return true;
  if (inline.description !== '' && inline.description !== (existing.description ?? '')) return true;
  if (inline.imageSlug !== '' && inline.imageSlug !== (existing.image_slug ?? '')) return true;
  if (inline.repeatable !== null && inline.repeatable !== existing.is_repeatable) return true;
  if (inline.rankThresholds !== null) {
    const current = readRankThresholds(existing.metadata);
    if (
      !current
      || current.length !== inline.rankThresholds.length
      || current.some((value, index) => value !== inline.rankThresholds?.[index])
    ) {
      return true;
    }
  }
  return false;
}

function createAchievementStatement(
  db: DbClient,
  slug: string,
  badge: InlineBadgeFields,
): D1PreparedStatement {
  const isRepeatable = badge.repeatable ?? true;
  return db.write.prepare(
    `INSERT INTO achievement_definitions
       (slug, name, description, image_slug, badge_type, is_repeatable, metadata)
     VALUES (?, ?, ?, ?, 'community', ?, ?)`,
  ).bind(
    slug,
    badge.name,
    badge.description,
    badge.imageSlug,
    isRepeatable ? 1 : 0,
    communityBadgeMetadata(isRepeatable, badge.rankThresholds),
  );
}

function updateAchievementStatement(
  db: DbClient,
  slug: string,
  existing: AchievementDefinition,
  badge: InlineBadgeFields,
): D1PreparedStatement {
  const isRepeatable = badge.repeatable ?? existing.is_repeatable;
  return db.write.prepare(
    `UPDATE achievement_definitions
     SET name = ?, description = ?, image_slug = ?, is_repeatable = ?, metadata = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE slug = ? AND badge_type = 'community'`,
  ).bind(
    badge.name || existing.name,
    badge.description || existing.description,
    badge.imageSlug || existing.image_slug,
    isRepeatable ? 1 : 0,
    communityBadgeMetadata(isRepeatable, badge.rankThresholds, existing.metadata),
    slug,
  );
}

// ── Suggestions ────────────────────────────────────────────────────────────

function clampDurationDays(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DURATION_DAYS;
  return Math.min(MAX_DURATION_DAYS, Math.max(MIN_DURATION_DAYS, Math.round(value)));
}

/**
 * Suggestion formula from the design: recent community distance divided by
 * active walkers, scaled by the run length and the documented 0.25 opt-in
 * rate, rounded to the nearest kilometer.
 */
async function computeCampaignSuggestions(
  db: DbClient,
  requestedDurationDays: number,
): Promise<CampaignSuggestions> {
  const durationDays = clampDurationDays(requestedDurationDays);
  const row = await db.read.prepare(
    `SELECT COALESCE(SUM(distance), 0) AS total_distance,
            COUNT(DISTINCT user_id) AS active_users
     FROM progress
     WHERE date >= date('now', '-${SUGGESTION_WINDOW_DAYS} day')`,
  ).first<ProgressTotalsRow>();

  const totalDistance = Number(row?.total_distance ?? 0);
  const activeUsers = Number(row?.active_users ?? 0);
  const suggestedTargetDistance = Math.round(
    (totalDistance / Math.max(activeUsers, 1)) * durationDays * OPT_IN_RATE,
  );

  return {
    suggestedTargetDistance,
    suggestedDurationDays: durationDays,
    suggestedParticipantCount: activeUsers,
    thirtyDayTotalDistance: totalDistance,
    thirtyDayActiveUsers: activeUsers,
  };
}

// ── Handlers ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/campaigns — every definition with its current and latest run,
 * linked badge, and active participant count.
 */
export async function handleAdminCampaignsList(
  _request: Request,
  db: DbClient,
): Promise<Response> {
  try {
    const { results: rows } = await db.read.prepare(
      `${CAMPAIGN_SELECT} ORDER BY d.id ASC`,
    ).all<AdminCampaignRow>();

    const { results: runRows } = await db.read.prepare(
      `SELECT id, campaign_id, run_number, target_distance, start_date, end_date,
              status, completed_at, announced_at, participant_count, contributor_count,
              total_distance, created_at, updated_at
       FROM campaign_runs
       ORDER BY campaign_id ASC, run_number ASC`,
    ).all<CampaignRun>();

    const { results: countRows } = await db.read.prepare(
      `SELECT run_id, COUNT(*) AS count
       FROM campaign_participants
       WHERE status = 'active'
       GROUP BY run_id`,
    ).all<CountRow>();

    const runsByCampaign = new Map<number, CampaignRun[]>();
    for (const run of runRows) {
      const existing = runsByCampaign.get(run.campaign_id);
      if (existing) {
        existing.push(run);
      } else {
        runsByCampaign.set(run.campaign_id, [run]);
      }
    }

    const countsByRun = new Map<number, number>();
    for (const row of countRows) {
      if (row.run_id !== undefined) {
        countsByRun.set(row.run_id, Number(row.count));
      }
    }

    const campaigns = rows.map((row) => {
      const runs = runsByCampaign.get(row.id) ?? [];
      const { activeRun, latestRun } = splitRuns(runs);
      return {
        ...toAdminCampaignBase(row),
        activeRun,
        latestRun,
        activeParticipantCount: activeRun ? (countsByRun.get(activeRun.id) ?? 0) : 0,
      };
    });

    return jsonResponse({ campaigns });
  } catch (error: unknown) {
    console.error('Error fetching admin campaign definitions:', error);
    return jsonResponse({ error: 'Internal server error while fetching campaigns' }, 500);
  }
}

/**
 * GET /api/admin/campaigns/suggestions — recent-walk metric suggestions.
 * `durationDays` is optional; it defaults to 14 and is clamped to 7–30.
 */
export async function handleAdminCampaignSuggestions(
  request: Request,
  db: DbClient,
): Promise<Response> {
  try {
    const raw = new URL(request.url).searchParams.get('durationDays');
    const requested = raw === null ? DEFAULT_DURATION_DAYS : Number(raw);
    return jsonResponse(await computeCampaignSuggestions(db, requested));
  } catch (error: unknown) {
    console.error('Error calculating campaign suggestions:', error);
    return jsonResponse({ error: 'Internal server error while calculating suggestions' }, 500);
  }
}

/**
 * GET /api/admin/campaigns/:id — one definition plus every run it has had.
 */
export async function handleAdminCampaignGet(
  _request: Request,
  db: DbClient,
  campaignId: number,
): Promise<Response> {
  try {
    const campaign = await getAdminCampaign(db, campaignId);
    if (!campaign) {
      return jsonResponse({ error: 'Campaign definition not found' }, 404);
    }
    return jsonResponse({ campaign });
  } catch (error: unknown) {
    console.error('Error fetching admin campaign definition:', error);
    return jsonResponse({ error: 'Internal server error while fetching campaign' }, 500);
  }
}

/**
 * POST /api/admin/campaigns — create the definition, its first run, and (when
 * the badge slug is new) the community achievement definition in one batch.
 * New campaigns are always disabled; the admin enables them explicitly.
 */
export async function handleAdminCampaignCreate(
  request: Request,
  db: DbClient,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  const parsed = parseCampaignFields(body, 'create');
  if (parsed.error) return validationResponse(parsed.fields);

  const badgeParsed = parseInlineBadgeFields(body);
  if (badgeParsed.error) return validationResponse(badgeParsed.fields);

  const data = parsed.data;
  const inlineBadge = badgeParsed.data;

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
    } else if (existingBadge.badge_type !== 'community' && badgeEditRequested(existingBadge, inlineBadge)) {
      return validationResponse({
        badge_slug: 'This badge belongs to another feature and cannot be edited',
      });
    }

    const insertDefinition = db.write.prepare(
      `INSERT INTO campaign_definitions
         (slug, name, description, image_slug, badge_slug, enabled)
       VALUES (?, ?, ?, ?, ?, 0)`,
    ).bind(
      data.slug,
      data.name,
      data.description,
      data.imageSlug,
      data.badgeSlug,
    );

    // The first run is part of the campaign's creation: it carries the window
    // and target the create form collected (and the suggestions endpoint
    // pre-filled). It starts unannounced so the enable path can announce it.
    const insertFirstRun = db.write.prepare(
      `INSERT INTO campaign_runs
         (campaign_id, run_number, target_distance, start_date, end_date, status)
       SELECT id, 1, ?, ?, ?, 'upcoming'
       FROM campaign_definitions
       WHERE slug = ?`,
    ).bind(data.targetDistance, data.startDate, data.endDate, data.slug);

    const badgeCreated = !existingBadge;
    const statements = [insertDefinition, insertFirstRun];
    if (badgeCreated) {
      statements.push(createAchievementStatement(db, data.badgeSlug, inlineBadge));
    }

    const results = await db.write.batch(statements);
    const newId = (results[0]?.meta as Record<string, unknown> | undefined)?.last_row_id;
    if (typeof newId !== 'number' || !Number.isFinite(newId)) {
      console.error('Failed to retrieve new campaign definition ID from INSERT result');
      return jsonResponse({ error: 'Internal server error while creating campaign' }, 500);
    }

    await logAdminAction(db, {
      adminUserId,
      action: 'create_campaign',
      targetType: 'community_campaign',
      targetId: newId,
      details: JSON.stringify({
        slug: data.slug,
        name: data.name,
        description: data.description,
        image_slug: data.imageSlug,
        badge_slug: data.badgeSlug,
        target_distance: data.targetDistance,
        start_date: data.startDate,
        end_date: data.endDate,
        enabled: false,
        run_number: 1,
        badge_created: badgeCreated,
      }),
      ipAddress: auditIp(request),
      success: true,
    });

    const campaign = await getAdminCampaign(db, newId);
    if (!campaign) {
      console.error('Failed to fetch newly created campaign definition with ID:', newId);
      return jsonResponse({ error: 'Internal server error while creating campaign' }, 500);
    }

    return jsonResponse({ campaign }, 201);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return validationResponse({ slug: 'Slug is already in use' });
    }
    console.error('Error creating admin campaign definition:', error);
    return jsonResponse({ error: 'Internal server error while creating campaign' }, 500);
  }
}

/**
 * PUT /api/admin/campaigns/:id — update copy fields and the linked badge, plus
 * the run-scoped fields while the current run is still `upcoming`. Once a run
 * leaves upcoming, its target/start and the campaign's badge slug are frozen;
 * an active run's end date may only be extended. The enabled flag is managed
 * exclusively by the enable/disable endpoints.
 */
export async function handleAdminCampaignUpdate(
  request: Request,
  db: DbClient,
  campaignId: number,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  const parsed = parseCampaignFields(body, 'update');
  if (parsed.error) return validationResponse(parsed.fields);

  const badgeParsed = parseInlineBadgeFields(body);
  if (badgeParsed.error) return validationResponse(badgeParsed.fields);

  const data = parsed.data;
  const inlineBadge = badgeParsed.data;

  try {
    const existing = await getAdminCampaign(db, campaignId);
    if (!existing) {
      return jsonResponse({ error: 'Campaign definition not found' }, 404);
    }

    if (await slugInUse(db, data.slug, campaignId)) {
      return validationResponse({ slug: 'Slug is already in use' });
    }

    const fields: Record<string, string> = {};
    const activeRun = existing.activeRun;
    const referenceRun = activeRun ?? existing.latestRun;
    const runIsUpcoming = activeRun?.status === 'upcoming';

    if (referenceRun && !runIsUpcoming) {
      if (data.targetDistance !== referenceRun.target_distance) {
        fields.target_distance = 'Target distance is frozen once the run has started';
      }
      if (data.startDate !== referenceRun.start_date) {
        fields.start_date = 'Start date is frozen once the run has started';
      }
      if (activeRun) {
        if (data.endDate < referenceRun.end_date) {
          fields.end_date = 'The end date can only be extended';
        }
      } else if (data.endDate !== referenceRun.end_date) {
        fields.end_date = 'End date is frozen once the run has ended';
      }
    }

    const badgeFrozen = referenceRun !== null && !runIsUpcoming;
    if (badgeFrozen && data.badgeSlug !== (existing.badge_slug ?? '')) {
      fields.badge_slug = 'Badge slug is frozen once the run has started';
    }

    if (Object.keys(fields).length > 0) return validationResponse(fields);

    const existingBadge = await getAchievementDefinitionBySlug(db, data.badgeSlug);
    if (!existingBadge) {
      const badgeErrors = inlineBadgeValidationErrors(inlineBadge);
      if (Object.keys(badgeErrors).length > 0) {
        return validationResponse(badgeErrors);
      }
    }

    let badgeCreated = false;
    let badgeUpdated = false;
    const statements: D1PreparedStatement[] = [
      db.write.prepare(
        `UPDATE campaign_definitions
         SET slug = ?, name = ?, description = ?, image_slug = ?, badge_slug = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      ).bind(
        data.slug,
        data.name,
        data.description,
        data.imageSlug,
        data.badgeSlug,
        campaignId,
      ),
    ];

    if (activeRun && runIsUpcoming) {
      statements.push(
        db.write.prepare(
          `UPDATE campaign_runs
           SET target_distance = ?, start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        ).bind(data.targetDistance, data.startDate, data.endDate, activeRun.id),
      );
    } else if (activeRun && data.endDate !== activeRun.end_date) {
      statements.push(
        db.write.prepare(
          `UPDATE campaign_runs
           SET end_date = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        ).bind(data.endDate, activeRun.id),
      );
    } else if (!referenceRun) {
      // Recovery path for a definition inserted without a run (the seed and
      // create paths always insert run 1): the update supplies its first run.
      statements.push(
        db.write.prepare(
          `INSERT INTO campaign_runs
             (campaign_id, run_number, target_distance, start_date, end_date, status)
           VALUES (?, 1, ?, ?, ?, 'upcoming')`,
        ).bind(campaignId, data.targetDistance, data.startDate, data.endDate),
      );
    }

    if (!existingBadge) {
      statements.push(createAchievementStatement(db, data.badgeSlug, inlineBadge));
      badgeCreated = true;
    } else if (existingBadge.badge_type !== 'community' && badgeEditRequested(existingBadge, inlineBadge)) {
      return validationResponse({
        badge_slug: 'This badge belongs to another feature and cannot be edited',
      });
    } else if (existingBadge.badge_type === 'community' && badgeEditRequested(existingBadge, inlineBadge)) {
      statements.push(updateAchievementStatement(db, data.badgeSlug, existingBadge, inlineBadge));
      badgeUpdated = true;
    }

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
    if ((existing.badge_slug ?? '') !== data.badgeSlug) {
      changes.badge_slug = { old: existing.badge_slug, new: data.badgeSlug };
    }
    if (activeRun && activeRun.target_distance !== data.targetDistance) {
      changes.target_distance = { old: activeRun.target_distance, new: data.targetDistance };
    }
    if (activeRun && activeRun.start_date !== data.startDate) {
      changes.start_date = { old: activeRun.start_date, new: data.startDate };
    }
    if (activeRun && activeRun.end_date !== data.endDate) {
      changes.end_date = { old: activeRun.end_date, new: data.endDate };
    }

    await logAdminAction(db, {
      adminUserId,
      action: 'update_campaign',
      targetType: 'community_campaign',
      targetId: campaignId,
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

    const campaign = await getAdminCampaign(db, campaignId);
    if (!campaign) {
      return jsonResponse({ error: 'Campaign definition not found' }, 404);
    }

    return jsonResponse({ campaign });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return validationResponse({ slug: 'Slug is already in use' });
    }
    console.error('Error updating admin campaign definition:', error);
    return jsonResponse({ error: 'Internal server error while updating campaign' }, 500);
  }
}

/**
 * PUT /api/admin/campaigns/:id/enable — make the campaign publicly visible and
 * backfill every active participant's in-window walks without a re-save.
 */
export async function handleAdminCampaignEnable(
  request: Request,
  db: DbClient,
  campaignId: number,
  adminUserId: number,
  pushContext?: PushDispatchContext,
): Promise<Response> {
  try {
    const existing = await getAdminCampaign(db, campaignId);
    if (!existing) {
      return jsonResponse({ error: 'Campaign definition not found' }, 404);
    }

    await db.write.prepare(
      `UPDATE campaign_definitions
       SET enabled = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).bind(campaignId).run();

    const run = await getActiveCampaignRun(db, campaignId);
    let backfilledParticipants = 0;
    if (run) {
      const { results: participants } = await db.read.prepare(
        `SELECT id, campaign_id, run_id, user_id, progress_distance, joined_at,
                status, removed_at, created_at, updated_at
         FROM campaign_participants
         WHERE run_id = ? AND status = 'active'
         ORDER BY id ASC`,
      ).bind(run.id).all<ParticipantRow>();

      for (const participant of participants) {
        await backfillParticipantWalks(db, toCampaignParticipant(participant), run);
        backfilledParticipants += 1;
      }
    }

    await logAdminAction(db, {
      adminUserId,
      action: 'enable_campaign',
      targetType: 'community_campaign',
      targetId: campaignId,
      details: JSON.stringify({
        enabled: true,
        backfilledParticipants,
        runId: run?.id ?? null,
      }),
      ipAddress: auditIp(request),
      success: true,
    });

    // Notification dispatch point (community-campaign-notifications change):
    // announce the campaign's unannounced upcoming/active run, if any.
    if (run) {
      await announceCampaignRunOnce(
        db,
        run.id,
        { name: existing.name, slug: existing.slug },
        run.run_number,
        pushContext,
      );
    }

    const campaign = await getAdminCampaign(db, campaignId);
    if (!campaign) {
      return jsonResponse({ error: 'Campaign definition not found' }, 404);
    }
    return jsonResponse({ campaign });
  } catch (error: unknown) {
    console.error('Error enabling admin campaign definition:', error);
    return jsonResponse({ error: 'Internal server error while enabling campaign' }, 500);
  }
}

function toCampaignParticipant(row: ParticipantRow): CampaignParticipant {
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    run_id: row.run_id,
    user_id: row.user_id,
    progress_distance: row.progress_distance,
    joined_at: row.joined_at,
    status: row.status,
    removed_at: row.removed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * PUT /api/admin/campaigns/:id/disable — freeze the campaign. When active
 * participants exist and no `cancelActive` decision is supplied, returns a
 * confirmation payload instead of mutating anything. Cancelling marks those
 * participants `removed`; ledger rows and earned badges stay untouched.
 */
export async function handleAdminCampaignDisable(
  request: Request,
  db: DbClient,
  campaignId: number,
  body: unknown,
  adminUserId: number,
): Promise<Response> {
  const rawCancelActive = body && typeof body === 'object'
    ? (body as Record<string, unknown>).cancelActive
    : undefined;
  const cancelActive = typeof rawCancelActive === 'boolean' ? rawCancelActive : null;

  try {
    const existing = await getAdminCampaign(db, campaignId);
    if (!existing) {
      return jsonResponse({ error: 'Campaign definition not found' }, 404);
    }

    const activeParticipants = await countActiveParticipants(db, campaignId);

    if (activeParticipants > 0 && cancelActive === null) {
      return jsonResponse({ activeParticipants, requiresConfirmation: true }, 400);
    }

    let cancelledParticipants = 0;
    if (activeParticipants > 0 && cancelActive === true) {
      const cancelResult = await db.write.prepare(
        `UPDATE campaign_participants
         SET status = 'removed', removed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE campaign_id = ? AND status = 'active'`,
      ).bind(campaignId).run();
      const changed = (cancelResult.meta as Record<string, unknown>).changes;
      cancelledParticipants = typeof changed === 'number' ? changed : activeParticipants;
    }

    await db.write.prepare(
      `UPDATE campaign_definitions
       SET enabled = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).bind(campaignId).run();

    await logAdminAction(db, {
      adminUserId,
      action: 'disable_campaign',
      targetType: 'community_campaign',
      targetId: campaignId,
      details: JSON.stringify({
        enabled: false,
        activeParticipants,
        cancelActive: cancelActive === true,
        cancelledParticipants,
      }),
      ipAddress: auditIp(request),
      success: true,
    });

    if (cancelledParticipants > 0) {
      await logAdminAction(db, {
        adminUserId,
        action: 'cancel_campaign_participants',
        targetType: 'community_campaign',
        targetId: campaignId,
        details: JSON.stringify({ cancelledParticipants }),
        ipAddress: auditIp(request),
        success: true,
      });
    }

    const campaign = await getAdminCampaign(db, campaignId);
    if (!campaign) {
      return jsonResponse({ error: 'Campaign definition not found' }, 404);
    }
    return jsonResponse({ campaign });
  } catch (error: unknown) {
    console.error('Error disabling admin campaign definition:', error);
    return jsonResponse({ error: 'Internal server error while disabling campaign' }, 500);
  }
}

/**
 * POST /api/admin/campaigns/:id/retrigger — append the next run. Allowed only
 * for an enabled campaign whose latest run is completed or expired. Defaults
 * come from the suggestion formula (clamped to >= 1 km), tomorrow UTC, and a
 * 14-day inclusive window; every value may be overridden with creation-rule
 * validation. The insert and its audit entry share one D1 batch, and no
 * previous row is touched.
 */
export async function handleAdminCampaignRetrigger(
  request: Request,
  db: DbClient,
  campaignId: number,
  body: unknown,
  adminUserId: number,
  pushContext?: PushDispatchContext,
): Promise<Response> {
  try {
    const existing = await getAdminCampaign(db, campaignId);
    if (!existing) {
      return jsonResponse({ error: 'Campaign definition not found' }, 404);
    }

    if (!existing.enabled) {
      return jsonResponse({
        error: 'Enable this campaign before starting its next run',
      }, 400);
    }

    const latestRun = existing.latestRun;
    if (latestRun && latestRun.status !== 'completed' && latestRun.status !== 'expired') {
      return jsonResponse({
        error: `Run ${latestRun.run_number} is still ${latestRun.status}. `
          + 'Start the next run only after it completes or expires.',
      }, 400);
    }

    const data = body && typeof body === 'object'
      ? body as Record<string, unknown>
      : {};
    const fields: Record<string, string> = {};
    const today = utcToday();
    const tomorrow = addDays(today, 1);

    const suggestions = await computeCampaignSuggestions(db, DEFAULT_DURATION_DAYS);

    let targetDistance = Math.max(1, suggestions.suggestedTargetDistance);
    if (data.target_distance !== undefined && data.target_distance !== null) {
      if (typeof data.target_distance !== 'number' || !Number.isFinite(data.target_distance)) {
        fields.target_distance = 'Target distance must be a number';
      } else if (data.target_distance <= 0) {
        fields.target_distance = 'Target distance must be greater than 0';
      } else {
        targetDistance = data.target_distance;
      }
    }

    let startDate = tomorrow;
    if (data.start_date !== undefined && data.start_date !== null) {
      const value = typeof data.start_date === 'string' ? data.start_date.trim() : '';
      if (!value || !isIsoDate(value)) {
        fields.start_date = 'Start date must be an ISO date (YYYY-MM-DD)';
      } else if (value < today) {
        fields.start_date = 'Start date must be today or later';
      } else {
        startDate = value;
      }
    }

    let endDate = addDays(startDate, DEFAULT_RUN_LENGTH_DAYS - 1);
    if (data.end_date !== undefined && data.end_date !== null) {
      const value = typeof data.end_date === 'string' ? data.end_date.trim() : '';
      if (!value || !isIsoDate(value)) {
        fields.end_date = 'End date must be an ISO date (YYYY-MM-DD)';
      } else if (value <= startDate) {
        fields.end_date = 'End date must be after the start date';
      } else {
        endDate = value;
      }
    }

    if (Object.keys(fields).length > 0) return validationResponse(fields);

    const runNumber = (latestRun?.run_number ?? 0) + 1;
    const details = JSON.stringify({
      run_number: runNumber,
      target_distance: targetDistance,
      start_date: startDate,
      end_date: endDate,
      previous_run_number: latestRun?.run_number ?? null,
      suggested_target_distance: suggestions.suggestedTargetDistance,
    });

    const insertRun = db.write.prepare(
      `INSERT INTO campaign_runs
         (campaign_id, run_number, target_distance, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, 'upcoming')`,
    ).bind(campaignId, runNumber, targetDistance, startDate, endDate);

    const insertAudit = db.write.prepare(
      `INSERT INTO admin_audit_log
         (admin_user_id, action, target_type, target_id, details, ip_address, success)
       VALUES (?, 'retrigger_campaign', 'community_campaign', ?, ?, ?, 1)`,
    ).bind(adminUserId, campaignId, details, auditIp(request));

    const results = await db.write.batch([insertRun, insertAudit]);
    const newRunId = (results[0]?.meta as Record<string, unknown> | undefined)?.last_row_id;
    if (typeof newRunId !== 'number' || !Number.isFinite(newRunId)) {
      console.error('Failed to retrieve new campaign run ID from INSERT result');
      return jsonResponse({ error: 'Internal server error while retriggering campaign' }, 500);
    }

    // Notification dispatch point (community-campaign-notifications change):
    // announce the newly created, unannounced run from here.
    await announceCampaignRunOnce(
      db,
      newRunId,
      { name: existing.name, slug: existing.slug },
      runNumber,
      pushContext,
    );

    const campaign = await getAdminCampaign(db, campaignId);
    if (!campaign) {
      return jsonResponse({ error: 'Campaign definition not found' }, 404);
    }
    const run = campaign.runs?.find((entry) => entry.id === newRunId) ?? null;

    return jsonResponse({ campaign, run }, 201);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return jsonResponse({
        error: 'A current run already exists for this campaign',
      }, 400);
    }
    console.error('Error retriggering admin campaign:', error);
    return jsonResponse({ error: 'Internal server error while retriggering campaign' }, 500);
  }
}
