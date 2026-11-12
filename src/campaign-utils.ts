// Community campaign domain service: campaign definitions, per-run
// participation with join-time backfill, community progress aggregation, and
// the shared idempotent ledger helpers. All writes go through DbClient so the
// same code runs against D1 and the in-memory test adapter.
//
// Campaigns are structured as runs: a definition carries identity/copy only,
// while each run carries its own window, target, lifecycle status, and final
// snapshot. At most one run per campaign is upcoming or active (enforced by a
// partial unique index); every read below scopes to that active run.
import type { DbClient } from './db';
import { utcToday } from './event-utils';

// ── Types ──────────────────────────────────────────────────────────────────

export type CampaignRunStatus = 'upcoming' | 'active' | 'completed' | 'expired';
export type CampaignParticipantStatus = 'active' | 'removed';

/** Campaign identity and copy. Window, target, and status live on runs. */
export interface CampaignDefinition {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string | null;
  badge_slug: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** One lifecycle cycle of a campaign. */
export interface CampaignRun {
  id: number;
  campaign_id: number;
  run_number: number;
  target_distance: number;
  start_date: string;
  end_date: string;
  status: CampaignRunStatus;
  completed_at: string | null;
  announced_at: string | null;
  participant_count: number | null;
  contributor_count: number | null;
  total_distance: number | null;
  created_at: string;
  updated_at: string;
}

/** Per-run opt-in. `progress_distance` is a cache derived from the ledger. */
export interface CampaignParticipant {
  id: number;
  campaign_id: number;
  run_id: number;
  user_id: number;
  progress_distance: number;
  joined_at: string;
  status: CampaignParticipantStatus;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** One credit row per participant per canonical walk. Never deleted by retriggering. */
export interface CampaignProgressLedger {
  id: number;
  participant_id: number;
  run_id: number;
  source_progress_id: number;
  distance: number;
  created_at: string;
  updated_at: string;
}

/** Live or snapshot-derived summary of one run. */
export interface CampaignRunSummary {
  id: number;
  runNumber: number;
  targetDistance: number;
  startDate: string;
  endDate: string;
  status: CampaignRunStatus;
  completedAt: string | null;
  announcedAt: string | null;
  participantCount: number;
  contributorCount: number;
  totalDistance: number;
  /** True when the numbers come from the run's terminal snapshot. */
  fromSnapshot: boolean;
}

/** The authenticated caller's participation in a run. */
export interface CampaignParticipation {
  participantId: number;
  status: CampaignParticipantStatus;
  joinedAt: string;
  contributionDistance: number;
}

/** Public campaign card payload (definition + active run + past outcomes). */
export interface CampaignSummary {
  id: number;
  slug: string;
  name: string;
  description: string;
  imageSlug: string | null;
  badgeSlug: string | null;
  enabled: boolean;
  activeRun: CampaignRunSummary | null;
  pastRuns: CampaignRunSummary[];
  participation: CampaignParticipation | null;
}

/** Full campaign detail, including every run the campaign has ever had. */
export interface CampaignDetail extends CampaignSummary {
  runs: CampaignRunSummary[];
}

/** One publicly ranked contributor. */
export interface ContributorRankEntry {
  rank: number;
  userId: number;
  username: string;
  distance: number;
}

/** The authenticated caller's own contribution and competition rank. */
export interface OwnContribution {
  distance: number;
  rank: number;
}

/** Public community progress payload for a campaign's active run. */
export interface CommunityProgressResponse {
  campaignId: number;
  campaignSlug: string;
  runId: number | null;
  runNumber: number | null;
  targetDistance: number | null;
  startDate: string | null;
  endDate: string | null;
  status: CampaignRunStatus | null;
  daysRemaining: number | null;
  totalDistance: number;
  participantCount: number;
  contributorCount: number;
  contributors: ContributorRankEntry[];
  you: OwnContribution | null;
}

export interface JoinCampaignResult {
  campaign: CampaignDefinition;
  run: CampaignRun;
  participant: CampaignParticipant;
}

export interface ListCampaignsOptions {
  /** When set, each summary carries that user's participation for the active run. */
  userId?: number;
}

export interface CommunityProgressOptions {
  userId?: number;
  /** Injected UTC date (YYYY-MM-DD) for deterministic tests. */
  today?: string;
}

export interface JoinCampaignOptions {
  /** Injected UTC date (YYYY-MM-DD) for deterministic tests. */
  today?: string;
}

// ── Errors ─────────────────────────────────────────────────────────────────

export class CampaignNotFoundError extends Error {
  readonly status: number = 404;

  constructor(message: string) {
    super(message);
    this.name = 'CampaignNotFoundError';
  }
}

export class CampaignValidationError extends Error {
  readonly status: number = 400;

  constructor(message: string) {
    super(message);
    this.name = 'CampaignValidationError';
  }
}

export class CampaignConflictError extends Error {
  readonly status: number = 409;

  constructor(message: string) {
    super(message);
    this.name = 'CampaignConflictError';
  }
}

// ── Row shapes ─────────────────────────────────────────────────────────────

interface CampaignDefinitionRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string | null;
  badge_slug: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface CampaignRunRow {
  id: number;
  campaign_id: number;
  run_number: number;
  target_distance: number;
  start_date: string;
  end_date: string;
  status: CampaignRunStatus;
  completed_at: string | null;
  announced_at: string | null;
  participant_count: number | null;
  contributor_count: number | null;
  total_distance: number | null;
  created_at: string;
  updated_at: string;
}

interface CampaignParticipantRow {
  id: number;
  campaign_id: number;
  run_id: number;
  user_id: number;
  progress_distance: number;
  joined_at: string;
  status: CampaignParticipantStatus;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WalkRow {
  id: number;
  distance: number;
}

interface RunAggregateRow {
  participant_count: number;
  contributor_count: number;
  total_distance: number;
}

interface ContributorRow {
  user_id: number;
  username: string;
  distance: number;
}

interface OwnContributionRow {
  distance: number;
  ahead_count: number;
}

// ── Mapping + helpers ──────────────────────────────────────────────────────

const CAMPAIGN_DEFINITION_COLUMNS = `id, slug, name, description, image_slug, badge_slug,
  enabled, created_at, updated_at`;

const CAMPAIGN_RUN_COLUMNS = `id, campaign_id, run_number, target_distance, start_date, end_date,
  status, completed_at, announced_at, participant_count, contributor_count,
  total_distance, created_at, updated_at`;

const CAMPAIGN_PARTICIPANT_COLUMNS = `id, campaign_id, run_id, user_id, progress_distance,
  joined_at, status, removed_at, created_at, updated_at`;

function toCampaignDefinition(row: CampaignDefinitionRow): CampaignDefinition {
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
  };
}

function toCampaignRun(row: CampaignRunRow): CampaignRun {
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    run_number: row.run_number,
    target_distance: row.target_distance,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    completed_at: row.completed_at,
    announced_at: row.announced_at,
    participant_count: row.participant_count,
    contributor_count: row.contributor_count,
    total_distance: row.total_distance,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toCampaignParticipant(row: CampaignParticipantRow): CampaignParticipant {
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

/** True if `error` (or its `.cause`) looks like a UNIQUE constraint violation. */
function isUniqueConstraintViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const causeMessage = error instanceof Error && error.cause instanceof Error ? error.cause.message : '';
  return message.includes('UNIQUE constraint') || causeMessage.includes('UNIQUE constraint');
}

/** Whole UTC days from `fromDate` to `toDate`, never negative. */
function daysBetween(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${toDate}T00:00:00.000Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function isTerminalStatus(status: CampaignRunStatus): boolean {
  return status === 'completed' || status === 'expired';
}

const ACTIVE_RUN_STATUS_ORDER: Record<CampaignRunStatus | 'none', number> = {
  active: 0,
  upcoming: 1,
  completed: 2,
  expired: 2,
  none: 3,
};

// ── Definitions and runs ───────────────────────────────────────────────────

/** Fetch a campaign definition by id, including disabled campaigns. */
export async function getCampaignDefinitionById(
  db: DbClient,
  id: number,
): Promise<CampaignDefinition | null> {
  const row = await db.read.prepare(
    `SELECT ${CAMPAIGN_DEFINITION_COLUMNS} FROM campaign_definitions WHERE id = ?`,
  ).bind(id).first<CampaignDefinitionRow>();

  return row ? toCampaignDefinition(row) : null;
}

/**
 * The campaign's active run: the one in `upcoming` or `active` status. A
 * partial unique index guarantees at most one, so `first()` is sufficient.
 */
export async function getActiveCampaignRun(
  db: DbClient,
  campaignId: number,
): Promise<CampaignRun | null> {
  const row = await db.read.prepare(
    `SELECT ${CAMPAIGN_RUN_COLUMNS}
     FROM campaign_runs
     WHERE campaign_id = ? AND status IN ('upcoming', 'active')
     ORDER BY run_number DESC
     LIMIT 1`,
  ).bind(campaignId).first<CampaignRunRow>();

  return row ? toCampaignRun(row) : null;
}

/** Every run of a campaign, oldest first. */
export async function listCampaignRuns(
  db: DbClient,
  campaignId: number,
): Promise<CampaignRun[]> {
  const { results } = await db.read.prepare(
    `SELECT ${CAMPAIGN_RUN_COLUMNS}
     FROM campaign_runs
     WHERE campaign_id = ?
     ORDER BY run_number ASC`,
  ).bind(campaignId).all<CampaignRunRow>();

  return results.map(toCampaignRun);
}

/**
 * Run-wide aggregate scoped through the run's active participants. The ledger
 * is the source of truth; `progress_distance` is only used to identify
 * contributors (active participants with a positive cached total).
 */
async function aggregateRunProgress(
  db: DbClient,
  runId: number,
): Promise<RunAggregateRow> {
  const row = await db.read.prepare(
    `SELECT
       (SELECT COUNT(*) FROM campaign_participants
         WHERE run_id = ? AND status = 'active') AS participant_count,
       (SELECT COUNT(*) FROM campaign_participants
         WHERE run_id = ? AND status = 'active' AND progress_distance > 0) AS contributor_count,
       (SELECT COALESCE(SUM(l.distance), 0)
          FROM campaign_progress_ledger l
          JOIN campaign_participants p ON p.id = l.participant_id
         WHERE p.run_id = ? AND p.status = 'active') AS total_distance`,
  ).bind(runId, runId, runId).first<RunAggregateRow>();

  return row ?? { participant_count: 0, contributor_count: 0, total_distance: 0 };
}

function toRunSummary(
  run: CampaignRun,
  aggregate: { participantCount: number; contributorCount: number; totalDistance: number },
  fromSnapshot: boolean,
): CampaignRunSummary {
  return {
    id: run.id,
    runNumber: run.run_number,
    targetDistance: run.target_distance,
    startDate: run.start_date,
    endDate: run.end_date,
    status: run.status,
    completedAt: run.completed_at,
    announcedAt: run.announced_at,
    participantCount: aggregate.participantCount,
    contributorCount: aggregate.contributorCount,
    totalDistance: aggregate.totalDistance,
    fromSnapshot,
  };
}

/**
 * Summarize a run. Terminal runs prefer their frozen final snapshot; a run
 * without one (or a live upcoming/active run) falls back to the live aggregate
 * so history stays correct regardless of when the snapshot was written.
 */
async function summarizeRun(db: DbClient, run: CampaignRun): Promise<CampaignRunSummary> {
  if (isTerminalStatus(run.status)
    && run.participant_count !== null
    && run.contributor_count !== null
    && run.total_distance !== null) {
    return toRunSummary(run, {
      participantCount: run.participant_count,
      contributorCount: run.contributor_count,
      totalDistance: run.total_distance,
    }, true);
  }

  const aggregate = await aggregateRunProgress(db, run.id);
  return toRunSummary(run, {
    participantCount: aggregate.participant_count,
    contributorCount: aggregate.contributor_count,
    totalDistance: aggregate.total_distance,
  }, false);
}

async function getParticipantForRun(
  db: DbClient,
  runId: number,
  userId: number,
): Promise<CampaignParticipant | null> {
  const row = await db.read.prepare(
    `SELECT ${CAMPAIGN_PARTICIPANT_COLUMNS}
     FROM campaign_participants
     WHERE run_id = ? AND user_id = ?
     LIMIT 1`,
  ).bind(runId, userId).first<CampaignParticipantRow>();

  return row ? toCampaignParticipant(row) : null;
}

async function buildParticipation(
  db: DbClient,
  runId: number | null,
  userId: number | undefined,
): Promise<CampaignParticipation | null> {
  if (runId === null || userId === undefined) return null;

  const participant = await getParticipantForRun(db, runId, userId);
  if (!participant) return null;

  return {
    participantId: participant.id,
    status: participant.status,
    joinedAt: participant.joined_at,
    contributionDistance: participant.progress_distance,
  };
}

interface BuiltCampaign {
  summary: CampaignSummary;
  /** Every run summary, newest run first. */
  runSummaries: CampaignRunSummary[];
}

/** Build a card/detail payload from a definition and its runs. */
async function buildCampaign(
  db: DbClient,
  definition: CampaignDefinition,
  runs: CampaignRun[],
  userId: number | undefined,
): Promise<BuiltCampaign> {
  const runSummaries: CampaignRunSummary[] = [];
  for (const run of runs) {
    runSummaries.push(await summarizeRun(db, run));
  }

  const activeRun = runSummaries.find(
    (summary) => summary.status === 'upcoming' || summary.status === 'active',
  ) ?? null;
  const pastRuns = runSummaries
    .filter((summary) => isTerminalStatus(summary.status))
    .sort((a, b) => b.runNumber - a.runNumber);

  return {
    summary: {
      id: definition.id,
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
      imageSlug: definition.image_slug,
      badgeSlug: definition.badge_slug,
      enabled: definition.enabled,
      activeRun,
      pastRuns,
      participation: await buildParticipation(db, activeRun?.id ?? null, userId),
    },
    runSummaries: [...runSummaries].sort((a, b) => b.runNumber - a.runNumber),
  };
}

// ── Listing and detail ─────────────────────────────────────────────────────

/**
 * Public campaign listing: enabled definitions only, each joined with its
 * active run (live progress/counts) and its terminal runs (snapshot outcome).
 * Ordered active first, then upcoming, then campaigns with no current run.
 */
export async function listCampaigns(
  db: DbClient,
  options: ListCampaignsOptions = {},
): Promise<CampaignSummary[]> {
  const { results: definitionRows } = await db.read.prepare(
    `SELECT ${CAMPAIGN_DEFINITION_COLUMNS}
     FROM campaign_definitions
     WHERE enabled = 1
     ORDER BY id ASC`,
  ).all<CampaignDefinitionRow>();

  if (definitionRows.length === 0) return [];

  const definitions = definitionRows.map(toCampaignDefinition);

  const { results: runRows } = await db.read.prepare(
    `SELECT r.id, r.campaign_id, r.run_number, r.target_distance, r.start_date, r.end_date,
            r.status, r.completed_at, r.announced_at, r.participant_count,
            r.contributor_count, r.total_distance, r.created_at, r.updated_at
     FROM campaign_runs r
     JOIN campaign_definitions d ON d.id = r.campaign_id
     WHERE d.enabled = 1
     ORDER BY r.campaign_id ASC, r.run_number ASC`,
  ).all<CampaignRunRow>();

  const runsByCampaign = new Map<number, CampaignRun[]>();
  for (const row of runRows) {
    const run = toCampaignRun(row);
    const existing = runsByCampaign.get(run.campaign_id);
    if (existing) {
      existing.push(run);
    } else {
      runsByCampaign.set(run.campaign_id, [run]);
    }
  }

  const summaries: CampaignSummary[] = [];
  for (const definition of definitions) {
    const built = await buildCampaign(
      db,
      definition,
      runsByCampaign.get(definition.id) ?? [],
      options.userId,
    );
    summaries.push(built.summary);
  }

  return summaries.sort((a, b) => {
    const bucketA = ACTIVE_RUN_STATUS_ORDER[a.activeRun?.status ?? 'none'];
    const bucketB = ACTIVE_RUN_STATUS_ORDER[b.activeRun?.status ?? 'none'];
    if (bucketA !== bucketB) return bucketA - bucketB;

    const startA = a.activeRun?.startDate ?? '';
    const startB = b.activeRun?.startDate ?? '';
    if (startA !== startB) return startA < startB ? -1 : 1;

    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return a.id - b.id;
  });
}

/**
 * Full campaign detail. Disabled campaigns are still returned (with
 * `enabled: false`) so admin surfaces can inspect them; public handlers decide
 * whether to expose them. Returns null when the campaign does not exist.
 */
export async function getCampaignDetail(
  db: DbClient,
  campaignId: number,
  options: ListCampaignsOptions = {},
): Promise<CampaignDetail | null> {
  const definition = await getCampaignDefinitionById(db, campaignId);
  if (!definition) return null;

  const runs = await listCampaignRuns(db, campaignId);
  const built = await buildCampaign(db, definition, runs, options.userId);
  return { ...built.summary, runs: built.runSummaries };
}

// ── Ledger helpers (shared with walk-save reconciliation) ──────────────────

/**
 * Idempotent ledger upsert: one row per (participant, canonical walk). Editing
 * a walk updates the existing row instead of inserting a duplicate.
 */
export async function upsertProgressLedgerEntry(
  db: DbClient,
  participantId: number,
  runId: number,
  sourceProgressId: number,
  distance: number,
): Promise<void> {
  await db.write.prepare(
    `INSERT INTO campaign_progress_ledger (participant_id, run_id, source_progress_id, distance)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(participant_id, source_progress_id)
     DO UPDATE SET distance = excluded.distance, run_id = excluded.run_id,
                   updated_at = CURRENT_TIMESTAMP`,
  ).bind(participantId, runId, sourceProgressId, distance).run();
}

/** Recompute the participant's cached total from the ledger. */
export async function recomputeParticipantDistance(
  db: DbClient,
  participantId: number,
): Promise<void> {
  await db.write.prepare(
    `UPDATE campaign_participants
     SET progress_distance = COALESCE(
           (SELECT SUM(distance) FROM campaign_progress_ledger WHERE participant_id = ?),
           0
         ),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).bind(participantId, participantId).run();
}

/**
 * Backfill a participant's existing walks whose dates fall inside the run
 * window. Uses the same idempotent upsert as walk-save reconciliation, so
 * calling it again never double-counts. Graceful degradation: errors are
 * logged and never propagated — participation is already committed by the
 * time this runs, and later reconciliation will retry the credit.
 */
export async function backfillParticipantWalks(
  db: DbClient,
  participant: CampaignParticipant,
  run: CampaignRun,
): Promise<void> {
  try {
    const { results: walks } = await db.read.prepare(
      `SELECT id, distance
       FROM progress
       WHERE user_id = ? AND date >= ? AND date <= ?
       ORDER BY id ASC`,
    ).bind(participant.user_id, run.start_date, run.end_date).all<WalkRow>();

    for (const walk of walks) {
      await upsertProgressLedgerEntry(
        db,
        participant.id,
        participant.run_id,
        walk.id,
        walk.distance,
      );
    }

    await recomputeParticipantDistance(db, participant.id);
  } catch (error: unknown) {
    console.error('Error backfilling campaign participant walks:', error);
  }
}

// ── Participation ──────────────────────────────────────────────────────────

/**
 * Join a campaign's active run. Creates a run-scoped participant row, then
 * backfills the user's existing in-window walks. Rejects a disabled campaign,
 * a campaign without a current run, a run whose end date has passed, and a
 * duplicate join of the same run. Joining a later run is always a fresh opt-in.
 */
export async function joinCampaignRun(
  db: DbClient,
  campaignId: number,
  userId: number,
  options: JoinCampaignOptions = {},
): Promise<JoinCampaignResult> {
  const today = options.today ?? utcToday();

  const campaign = await getCampaignDefinitionById(db, campaignId);
  if (!campaign) {
    throw new CampaignNotFoundError(`No campaign found for id ${campaignId}`);
  }

  if (!campaign.enabled) {
    throw new CampaignValidationError('This campaign is not accepting participants');
  }

  const run = await getActiveCampaignRun(db, campaignId);
  if (!run) {
    throw new CampaignValidationError('This campaign is not accepting participants');
  }

  if (run.end_date < today) {
    throw new CampaignValidationError('This campaign is not accepting participants');
  }

  const existing = await getParticipantForRun(db, run.id, userId);
  if (existing) {
    throw new CampaignConflictError('You have already joined this run');
  }

  try {
    await db.write.prepare(
      `INSERT INTO campaign_participants (campaign_id, run_id, user_id)
       VALUES (?, ?, ?)`,
    ).bind(campaign.id, run.id, userId).run();
  } catch (error: unknown) {
    if (isUniqueConstraintViolation(error)) {
      throw new CampaignConflictError('You have already joined this run');
    }
    throw error;
  }

  const participant = await getParticipantForRun(db, run.id, userId);
  if (!participant) {
    throw new CampaignNotFoundError('The new campaign participant could not be found');
  }

  await backfillParticipantWalks(db, participant, run);

  const refreshed = await getParticipantForRun(db, run.id, userId) ?? participant;
  return { campaign, run, participant: refreshed };
}

// ── Community progress ─────────────────────────────────────────────────────

/**
 * Ranked contributors: active participants with a positive contribution,
 * ordered by distance DESC then username ASC. Competition ranking means tied
 * distances share a rank and the next distinct distance skips accordingly.
 */
async function listContributors(
  db: DbClient,
  runId: number,
): Promise<ContributorRankEntry[]> {
  const { results } = await db.read.prepare(
    `SELECT p.user_id, u.username, p.progress_distance AS distance
     FROM campaign_participants p
     JOIN users u ON u.id = p.user_id
     WHERE p.run_id = ? AND p.status = 'active' AND p.progress_distance > 0
     ORDER BY p.progress_distance DESC, u.username ASC, p.user_id ASC
     LIMIT 50`,
  ).bind(runId).all<ContributorRow>();

  let rank = 0;
  let previousDistance: number | null = null;
  return results.map((row, index) => {
    if (previousDistance === null || row.distance !== previousDistance) {
      rank = index + 1;
      previousDistance = row.distance;
    }
    return {
      rank,
      userId: row.user_id,
      username: row.username,
      distance: row.distance,
    };
  });
}

/**
 * The caller's own contribution and rank, only when it is greater than zero.
 * Rank counts every active contributor ahead of them, not just the top 50.
 */
async function getOwnContribution(
  db: DbClient,
  runId: number,
  userId: number,
): Promise<OwnContribution | null> {
  const row = await db.read.prepare(
    `SELECT p.progress_distance AS distance,
            (SELECT COUNT(*)
               FROM campaign_participants q
              WHERE q.run_id = p.run_id
                AND q.status = 'active'
                AND q.progress_distance > p.progress_distance) AS ahead_count
     FROM campaign_participants p
     WHERE p.run_id = ? AND p.user_id = ? AND p.status = 'active'
     LIMIT 1`,
  ).bind(runId, userId).first<OwnContributionRow>();

  if (!row || row.distance <= 0) return null;

  return { distance: row.distance, rank: row.ahead_count + 1 };
}

/**
 * Public community progress for a campaign's active run. Returns null when the
 * campaign does not exist or is disabled (a frozen campaign's progress is not
 * public data — handlers treat both cases as absent); a campaign without a
 * current run returns a zeroed payload with null run fields. With `userId`,
 * also returns that user's own contribution/rank when it is greater than zero.
 */
export async function getCommunityProgress(
  db: DbClient,
  campaignId: number,
  options: CommunityProgressOptions = {},
): Promise<CommunityProgressResponse | null> {
  const today = options.today ?? utcToday();

  const campaign = await getCampaignDefinitionById(db, campaignId);
  if (!campaign || !campaign.enabled) return null;

  const run = await getActiveCampaignRun(db, campaignId);
  if (!run) {
    return {
      campaignId: campaign.id,
      campaignSlug: campaign.slug,
      runId: null,
      runNumber: null,
      targetDistance: null,
      startDate: null,
      endDate: null,
      status: null,
      daysRemaining: null,
      totalDistance: 0,
      participantCount: 0,
      contributorCount: 0,
      contributors: [],
      you: null,
    };
  }

  const aggregate = await aggregateRunProgress(db, run.id);
  const contributors = await listContributors(db, run.id);
  const you = options.userId === undefined
    ? null
    : await getOwnContribution(db, run.id, options.userId);

  return {
    campaignId: campaign.id,
    campaignSlug: campaign.slug,
    runId: run.id,
    runNumber: run.run_number,
    targetDistance: run.target_distance,
    startDate: run.start_date,
    endDate: run.end_date,
    status: run.status,
    daysRemaining: daysBetween(today, run.end_date),
    totalDistance: aggregate.total_distance,
    participantCount: aggregate.participant_count,
    contributorCount: aggregate.contributor_count,
    contributors,
    you,
  };
}
