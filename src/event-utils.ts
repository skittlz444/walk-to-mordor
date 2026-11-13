// Personal challenge domain service: definitions, daily rolls, accept/decline,
// ledger-backed progress reconciliation, and scheduled settlement. All writes
// go through DbClient so the same code runs against D1 and the in-memory test
// adapter.
import type { DbClient } from './db';
import { awardAchievement } from './achievement-utils';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PersonalEncounterDefinition {
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
}

export type EncounterOccurrenceStatus = 'active' | 'completed' | 'failed';

export interface EncounterOccurrence {
  id: number;
  definition_id: number;
  user_id: number;
  daily_roll_id: number;
  status: EncounterOccurrenceStatus;
  personalized_target: number;
  started_at: string;
  coverage_end_date: string;
  grace_deadline: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DailyRollStatus = 'offered' | 'accepted' | 'declined';

export interface DailyRoll {
  id: number;
  user_id: number;
  roll_date: string;
  encounter_definition_id: number | null;
  preview_target_distance: number | null;
  status: DailyRollStatus;
  created_at: string;
  updated_at: string;
}

export interface EventParticipant {
  id: number;
  occurrence_id: number;
  user_id: number;
  progress_distance: number;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface EventProgressLedgerEntry {
  id: number;
  participant_id: number;
  source_progress_id: number;
  distance: number;
  created_at: string;
  updated_at: string;
}

/** Definition shape embedded in a daily-roll offer. */
export interface EncounterOfferDefinition {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string | null;
  badge_slug: string | null;
  duration_days: number;
}

export interface EncounterOffer {
  status: 'offered';
  definition: EncounterOfferDefinition;
  target: number;
  coverageStart: string;
  coverageEnd: string;
  graceDeadline: string;
}

export interface RollResult {
  offer: EncounterOffer | null;
}

export interface AcceptEncounterResult {
  occurrence: EncounterOccurrence;
  definition: PersonalEncounterDefinition;
  alreadyAccepted: boolean;
  completed: boolean;
}

export interface DeclineEncounterResult {
  declined: true;
  alreadyDeclined: boolean;
}

export interface EncounterEligibility {
  eligible: boolean;
  reason: 'eligible' | 'insufficient_activity' | 'active_challenge' | 'no_definition';
  useCooldownBranch: boolean;
}

// ── Errors ─────────────────────────────────────────────────────────────────

export class EncounterValidationError extends Error {
  readonly status: number = 400;

  constructor(message: string) {
    super(message);
    this.name = 'EncounterValidationError';
  }
}

export class EncounterConflictError extends Error {
  readonly status: number = 409;

  constructor(message: string) {
    super(message);
    this.name = 'EncounterConflictError';
  }
}

export class EncounterNotFoundError extends Error {
  readonly status: number = 404;

  constructor(message: string) {
    super(message);
    this.name = 'EncounterNotFoundError';
  }
}

// ── Row shapes ─────────────────────────────────────────────────────────────

interface PersonalEncounterDefinitionRow {
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
}

interface EncounterOccurrenceRow {
  id: number;
  definition_id: number;
  user_id: number;
  daily_roll_id: number;
  status: EncounterOccurrenceStatus;
  personalized_target: number;
  started_at: string;
  coverage_end_date: string;
  grace_deadline: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DailyRollRow {
  id: number;
  user_id: number;
  roll_date: string;
  encounter_definition_id: number | null;
  preview_target_distance: number | null;
  status: DailyRollStatus;
  created_at: string;
  updated_at: string;
}

interface CountRow {
  count: number;
}

interface DistanceAverageRow {
  total: number;
  days: number;
}

interface ProgressRow {
  id: number;
  distance: number;
}

interface ActiveParticipantRow {
  participant_id: number;
  occurrence_id: number;
  occurrence_status: EncounterOccurrenceStatus;
  personalized_target: number;
  started_at: string;
  coverage_end_date: string;
  badge_slug: string | null;
  definition_slug: string;
}

interface ProgressDistanceRow {
  progress_distance: number;
}

interface ExpiredOccurrenceRow {
  occurrence_id: number;
  user_id: number;
  personalized_target: number;
  badge_slug: string | null;
  definition_slug: string;
}

interface TotalRow {
  total: number;
}

// ── Mapping + helpers ──────────────────────────────────────────────────────

function toDefinition(row: PersonalEncounterDefinitionRow): PersonalEncounterDefinition {
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
  };
}

function toOccurrence(row: EncounterOccurrenceRow): EncounterOccurrence {
  return {
    id: row.id,
    definition_id: row.definition_id,
    user_id: row.user_id,
    daily_roll_id: row.daily_roll_id,
    status: row.status,
    personalized_target: row.personalized_target,
    started_at: row.started_at,
    coverage_end_date: row.coverage_end_date,
    grace_deadline: row.grace_deadline,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toOfferDefinition(definition: PersonalEncounterDefinition): EncounterOfferDefinition {
  return {
    id: definition.id,
    slug: definition.slug,
    name: definition.name,
    description: definition.description,
    image_slug: definition.image_slug,
    badge_slug: definition.badge_slug,
    duration_days: definition.duration_days,
  };
}

function buildOffer(
  definition: PersonalEncounterDefinition,
  rollDate: string,
  target: number,
): EncounterOffer {
  const coverageEnd = addDays(rollDate, definition.duration_days - 1);
  return {
    status: 'offered',
    definition: toOfferDefinition(definition),
    target,
    coverageStart: rollDate,
    coverageEnd,
    graceDeadline: addDays(coverageEnd, 3),
  };
}

/**
 * True if `error` (or its `.cause`) looks like a UNIQUE constraint violation.
 * This is a best-effort string match against the underlying D1/SQLite driver's
 * error wording — keep in sync with the driver if that phrasing ever changes.
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const causeMessage = error instanceof Error && error.cause instanceof Error ? error.cause.message : '';
  return message.includes('UNIQUE constraint') || causeMessage.includes('UNIQUE constraint');
}

function clampTarget(value: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(value, min), max) * 100) / 100;
}

// ── Date helpers ───────────────────────────────────────────────────────────

/** Today's UTC date as YYYY-MM-DD. */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Add calendar days to a YYYY-MM-DD date, returning YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

// ── Definitions + eligibility ──────────────────────────────────────────────

/** Fetch an encounter definition by id. Returns null when it does not exist. */
export async function getEncounterDefinitionById(
  db: DbClient,
  id: number,
): Promise<PersonalEncounterDefinition | null> {
  const row = await db.read.prepare(
    `SELECT id, slug, name, description, image_slug, badge_slug, duration_days,
            target_stretch_multiplier, target_min_distance, target_max_distance,
            is_repeatable, enabled, created_at, updated_at
     FROM personal_encounter_definitions
     WHERE id = ?`,
  ).bind(id).first<PersonalEncounterDefinitionRow>();

  return row ? toDefinition(row) : null;
}

/**
 * Enabled definitions the user can still receive. Non-repeatable definitions
 * are excluded once the user has completed them; repeatable definitions stay
 * available forever.
 */
async function listEligibleDefinitions(
  db: DbClient,
  userId: number,
): Promise<PersonalEncounterDefinition[]> {
  const { results } = await db.read.prepare(
    `SELECT d.id, d.slug, d.name, d.description, d.image_slug, d.badge_slug,
            d.duration_days, d.target_stretch_multiplier, d.target_min_distance,
            d.target_max_distance, d.is_repeatable, d.enabled, d.created_at, d.updated_at
     FROM personal_encounter_definitions d
     WHERE d.enabled = 1
       AND (
         d.is_repeatable = 1
         OR NOT EXISTS (
           SELECT 1 FROM encounter_occurrences o
           WHERE o.user_id = ? AND o.definition_id = d.id AND o.status = 'completed'
         )
       )
     ORDER BY d.id ASC`,
  ).bind(userId).all<PersonalEncounterDefinitionRow>();

  return results.map(toDefinition);
}

/**
 * Evaluate whether the user is allowed to receive a personal encounter today.
 * The cooldown flag only selects the probability branch; it never blocks.
 */
export async function evaluateEncounterEligibility(
  db: DbClient,
  userId: number,
  today: string = utcToday(),
): Promise<EncounterEligibility> {
  const definitions = await listEligibleDefinitions(db, userId);
  if (definitions.length === 0) {
    return { eligible: false, reason: 'no_definition', useCooldownBranch: false };
  }

  const active = await db.read.prepare(
    `SELECT id FROM encounter_occurrences
     WHERE user_id = ? AND status = 'active'
     LIMIT 1`,
  ).bind(userId).first<{ id: number }>();

  const cooldownStart = addDays(today, -29);
  const recentDecision = await db.read.prepare(
    `SELECT id FROM daily_rolls
     WHERE user_id = ?
       AND roll_date >= ? AND roll_date <= ?
       AND status IN ('accepted', 'declined')
     LIMIT 1`,
  ).bind(userId, cooldownStart, today).first<{ id: number }>();
  const useCooldownBranch = recentDecision !== null;

  if (active) {
    return { eligible: false, reason: 'active_challenge', useCooldownBranch };
  }

  const last30 = (await db.read.prepare(
    `SELECT COUNT(DISTINCT date) AS count FROM progress
     WHERE user_id = ? AND date >= ? AND date <= ?`,
  ).bind(userId, cooldownStart, today).first<CountRow>()) as CountRow;
  const last7 = (await db.read.prepare(
    `SELECT COUNT(DISTINCT date) AS count FROM progress
     WHERE user_id = ? AND date >= ? AND date <= ?`,
  ).bind(userId, addDays(today, -6), today).first<CountRow>()) as CountRow;

  const days30 = last30.count;
  const days7 = last7.count;
  if (days30 < 7 && days7 < 3) {
    return { eligible: false, reason: 'insufficient_activity', useCooldownBranch };
  }

  return { eligible: true, reason: 'eligible', useCooldownBranch };
}

/**
 * Personalized target: recent active-day average × stretch multiplier, clamped
 * to the definition's min/max bracket and rounded to two decimals.
 */
export async function calculatePreviewTarget(
  db: DbClient,
  definition: PersonalEncounterDefinition,
  userId: number,
  today: string = utcToday(),
): Promise<number> {
  const row = (await db.read.prepare(
    `SELECT COALESCE(SUM(distance), 0) AS total, COUNT(DISTINCT date) AS days
     FROM progress
     WHERE user_id = ? AND date >= ? AND date <= ?`,
  ).bind(userId, addDays(today, -29), today).first<DistanceAverageRow>()) as DistanceAverageRow;

  const total = row.total;
  const days = row.days;
  const average = days > 0 ? total / days : 0;
  return clampTarget(
    average * definition.target_stretch_multiplier,
    definition.target_min_distance,
    definition.target_max_distance,
  );
}

// ── Daily roll ─────────────────────────────────────────────────────────────

/**
 * Roll (or return) today's encounter offer. Idempotent per (user, UTC date):
 * the first call records the row, later calls return the stored outcome.
 */
export async function rollDailyEncounter(
  db: DbClient,
  userId: number,
  options: { today?: string; random?: () => number; forceOffer?: boolean } = {},
): Promise<RollResult> {
  const today = options.today ?? utcToday();
  const random = options.random ?? Math.random;
  const forceOffer = options.forceOffer ?? false;

  const insertResult = await db.write.prepare(
    `INSERT OR IGNORE INTO daily_rolls (user_id, roll_date, status)
     VALUES (?, ?, 'offered')`,
  ).bind(userId, today).run();

  const roll = (await db.read.prepare(
    `SELECT id, user_id, roll_date, encounter_definition_id, preview_target_distance,
            status, created_at, updated_at
     FROM daily_rolls
     WHERE user_id = ? AND roll_date = ?`,
  ).bind(userId, today).first<DailyRollRow>()) as DailyRollRow;

  // A row created by an earlier call is terminal: this is at most one roll per
  // UTC day, including a no-offer roll. Only the insert that actually created
  // the row is allowed to evaluate eligibility and draw.
  if (insertResult.meta.changes === 0) {
    return { offer: await storedOffer(db, roll) };
  }

  const eligibility = await evaluateEncounterEligibility(db, userId, today);
  if (!eligibility.eligible) {
    return { offer: null };
  }

  const probability = eligibility.useCooldownBranch ? 1 / 30 : 1 / 10;
  if (!forceOffer && random() >= probability) {
    return { offer: null };
  }

  const definitions = await listEligibleDefinitions(db, userId);
  const index = definitions.length === 1
    ? 0
    : Math.min(Math.floor(random() * definitions.length), definitions.length - 1);
  const definition = definitions[index];
  const target = await calculatePreviewTarget(db, definition, userId, today);

  await db.write.prepare(
    `UPDATE daily_rolls
     SET encounter_definition_id = ?, preview_target_distance = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND encounter_definition_id IS NULL`,
  ).bind(definition.id, target, roll.id).run();

  // Re-read so a concurrent first roll wins: every caller for the same UTC day
  // must see the same stored definition and target.
  const stored = (await db.read.prepare(
    `SELECT id, user_id, roll_date, encounter_definition_id, preview_target_distance,
            status, created_at, updated_at
     FROM daily_rolls
     WHERE id = ?`,
  ).bind(roll.id).first<DailyRollRow>()) as DailyRollRow;

  return { offer: await storedOffer(db, stored) };
}

/**
 * Build the offer from a stored roll, or null when that roll did not offer an
 * encounter. Used for every repeat call so the stored outcome never changes.
 */
async function storedOffer(db: DbClient, roll: DailyRollRow): Promise<EncounterOffer | null> {
  if (roll.encounter_definition_id === null || roll.preview_target_distance === null || roll.status !== 'offered') {
    return null;
  }

  const definition = await getEncounterDefinitionById(db, roll.encounter_definition_id);
  if (!definition) return null;

  return buildOffer(definition, roll.roll_date, roll.preview_target_distance);
}

// ── Accept / decline ───────────────────────────────────────────────────────

async function getOccurrenceByDailyRollId(
  db: DbClient,
  dailyRollId: number,
): Promise<EncounterOccurrence | null> {
  const row = await db.read.prepare(
    `SELECT id, definition_id, user_id, daily_roll_id, status, personalized_target,
            started_at, coverage_end_date, grace_deadline, completed_at, created_at, updated_at
     FROM encounter_occurrences
     WHERE daily_roll_id = ?`,
  ).bind(dailyRollId).first<EncounterOccurrenceRow>();

  return row ? toOccurrence(row) : null;
}

/**
 * Accept today's offer. Creates the occurrence and participant and flips the
 * roll to accepted in one write batch, then immediately credits any walk already
 * logged for the accept date.
 */
export async function acceptEncounter(
  db: DbClient,
  userId: number,
  definitionId: number,
  options: { today?: string } = {},
): Promise<AcceptEncounterResult> {
  if (!Number.isInteger(definitionId) || definitionId <= 0) {
    throw new EncounterValidationError('encounter_definition_id must be a positive integer');
  }

  const today = options.today ?? utcToday();
  const roll = await db.read.prepare(
    `SELECT id, user_id, roll_date, encounter_definition_id, preview_target_distance,
            status, created_at, updated_at
     FROM daily_rolls
     WHERE user_id = ? AND roll_date = ?`,
  ).bind(userId, today).first<DailyRollRow>();

  if (!roll) {
    throw new EncounterNotFoundError('No encounter roll exists for today');
  }

  if (roll.encounter_definition_id !== definitionId) {
    throw new EncounterConflictError('The offered encounter does not match this definition');
  }

  const definition = await getEncounterDefinitionById(db, definitionId);
  if (!definition) {
    throw new EncounterNotFoundError(`No encounter definition found for id ${definitionId}`);
  }

  if (roll.status === 'declined') {
    throw new EncounterConflictError('This encounter offer was already declined');
  }

  if (roll.status === 'accepted') {
    const existing = await getOccurrenceByDailyRollId(db, roll.id);
    if (!existing) {
      throw new EncounterNotFoundError('The accepted encounter occurrence could not be found');
    }
    return {
      occurrence: existing,
      definition,
      alreadyAccepted: true,
      completed: existing.status === 'completed',
    };
  }

  if (!definition.enabled) {
    throw new EncounterConflictError('This encounter definition is no longer available');
  }

  const target = roll.preview_target_distance
    ?? await calculatePreviewTarget(db, definition, userId, today);
  const coverageEnd = addDays(today, definition.duration_days - 1);
  const graceDeadline = addDays(coverageEnd, 3);

  try {
    await db.write.batch([
      db.write.prepare(
        `INSERT INTO encounter_occurrences
           (definition_id, user_id, daily_roll_id, status, personalized_target,
            started_at, coverage_end_date, grace_deadline)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
      ).bind(definition.id, userId, roll.id, target, today, coverageEnd, graceDeadline),
      db.write.prepare(
        `INSERT INTO event_participants (occurrence_id, user_id, progress_distance)
         SELECT id, ?, 0 FROM encounter_occurrences WHERE daily_roll_id = ?`,
      ).bind(userId, roll.id),
      db.write.prepare(
        `UPDATE daily_rolls SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      ).bind(roll.id),
    ]);
  } catch (error: unknown) {
    if (isUniqueConstraintViolation(error)) {
      const existing = await getOccurrenceByDailyRollId(db, roll.id);
      if (existing) {
        return {
          occurrence: existing,
          definition,
          alreadyAccepted: true,
          completed: existing.status === 'completed',
        };
      }
    }
    throw error;
  }

  let occurrence = (await getOccurrenceByDailyRollId(db, roll.id)) as EncounterOccurrence;

  const progress = await db.read.prepare(
    `SELECT id, distance FROM progress WHERE user_id = ? AND date = ?`,
  ).bind(userId, today).first<ProgressRow>();

  if (progress) {
    await reconcileProgressForUser(db, userId, {
      progressId: progress.id,
      date: today,
      distance: progress.distance,
      operation: 'upsert',
    });
    occurrence = (await getOccurrenceByDailyRollId(db, roll.id)) as EncounterOccurrence;
  }

  return {
    occurrence,
    definition,
    alreadyAccepted: false,
    completed: occurrence.status === 'completed',
  };
}

/** Decline today's offer. Idempotent after the first decline. */
export async function declineEncounter(
  db: DbClient,
  userId: number,
  definitionId?: number,
  options: { today?: string } = {},
): Promise<DeclineEncounterResult> {
  const today = options.today ?? utcToday();
  const roll = await db.read.prepare(
    `SELECT id, user_id, roll_date, encounter_definition_id, preview_target_distance,
            status, created_at, updated_at
     FROM daily_rolls
     WHERE user_id = ? AND roll_date = ?`,
  ).bind(userId, today).first<DailyRollRow>();

  if (!roll) {
    throw new EncounterNotFoundError('No encounter roll exists for today');
  }

  if (definitionId !== undefined && roll.encounter_definition_id !== definitionId) {
    throw new EncounterConflictError('The offered encounter does not match this definition');
  }

  if (roll.status === 'accepted') {
    throw new EncounterConflictError('This encounter offer was already accepted');
  }

  if (roll.status === 'declined') {
    return { declined: true, alreadyDeclined: true };
  }

  if (roll.encounter_definition_id === null) {
    throw new EncounterConflictError('There is no encounter offer to decline');
  }

  await db.write.prepare(
    `UPDATE daily_rolls SET status = 'declined', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).bind(roll.id).run();

  return { declined: true, alreadyDeclined: false };
}

// ── Progress reconciliation ────────────────────────────────────────────────

/**
 * Credit or un-credit a canonical walk row across the user's active personal
 * challenges. Never throws: walk saves must succeed even if event processing
 * fails (matching the syncPartyProgressLog graceful-degradation pattern).
 */
export async function reconcileProgressForUser(
  db: DbClient,
  userId: number,
  params: {
    progressId: number;
    date: string;
    distance: number;
    operation: 'upsert' | 'delete';
  },
): Promise<void> {
  try {
    const { results: participants } = await db.read.prepare(
      `SELECT ep.id AS participant_id, eo.id AS occurrence_id,
              eo.status AS occurrence_status,
              eo.personalized_target, eo.started_at, eo.coverage_end_date,
              d.badge_slug, d.slug AS definition_slug
       FROM event_participants ep
       JOIN encounter_occurrences eo ON eo.id = ep.occurrence_id
       JOIN personal_encounter_definitions d ON d.id = eo.definition_id
       WHERE ep.user_id = ? AND eo.status IN ('active', 'completed')`,
    ).bind(userId).all<ActiveParticipantRow>();

    for (const participant of participants) {
      if (params.date < participant.started_at || params.date > participant.coverage_end_date) {
        continue;
      }

      if (params.operation === 'upsert') {
        await db.write.prepare(
          `INSERT INTO event_progress_ledger (participant_id, source_progress_id, distance)
           VALUES (?, ?, ?)
           ON CONFLICT(participant_id, source_progress_id)
           DO UPDATE SET distance = excluded.distance, updated_at = CURRENT_TIMESTAMP`,
        ).bind(participant.participant_id, params.progressId, params.distance).run();
      } else {
        await db.write.prepare(
          `DELETE FROM event_progress_ledger
           WHERE participant_id = ? AND source_progress_id = ?`,
        ).bind(participant.participant_id, params.progressId).run();
      }

      await db.write.prepare(
        `UPDATE event_participants
         SET progress_distance = COALESCE(
               (SELECT SUM(distance) FROM event_progress_ledger WHERE participant_id = ?),
               0
             ),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      ).bind(participant.participant_id, participant.participant_id).run();

      const totalRow = (await db.read.prepare(
        `SELECT progress_distance FROM event_participants WHERE id = ?`,
      ).bind(participant.participant_id).first<ProgressDistanceRow>()) as ProgressDistanceRow;
      const progressDistance = totalRow.progress_distance;

      if (progressDistance >= participant.personalized_target && participant.occurrence_status === 'active') {
        const completion = await db.write.prepare(
          `UPDATE encounter_occurrences
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status = 'active'`,
        ).bind(participant.occurrence_id).run();

        if (completion.meta.changes > 0 && participant.badge_slug) {
          await awardAchievement(
            db,
            userId,
            participant.badge_slug,
            `encounter_occurrence:${participant.occurrence_id}`,
            JSON.stringify({
              occurrence_id: participant.occurrence_id,
              definition_slug: participant.definition_slug,
              personalized_target: participant.personalized_target,
              progress_distance: progressDistance,
            }),
          );
        }
      }
    }
  } catch (error: unknown) {
    console.error('Error reconciling personal challenge progress:', error);
  }
}

// ── Scheduled settlement ───────────────────────────────────────────────────

/**
 * Finalize active occurrences whose grace deadline is strictly in the past.
 * Each occurrence is handled in its own try/catch so one bad row never blocks
 * the rest of the settlement pass.
 */
export async function settleExpiredChallenges(
  db: DbClient,
  options: { today?: string } = {},
): Promise<{ completed: number; failed: number }> {
  const today = options.today ?? utcToday();
  const { results: occurrences } = await db.read.prepare(
    `SELECT o.id AS occurrence_id, o.user_id, o.personalized_target,
            d.badge_slug, d.slug AS definition_slug
     FROM encounter_occurrences o
     JOIN personal_encounter_definitions d ON d.id = o.definition_id
     WHERE o.status = 'active' AND o.grace_deadline < ?
     ORDER BY o.id ASC`,
  ).bind(today).all<ExpiredOccurrenceRow>();

  let completed = 0;
  let failed = 0;

  for (const occurrence of occurrences) {
    try {
      const totalRow = (await db.read.prepare(
        `SELECT COALESCE(SUM(progress_distance), 0) AS total
         FROM event_participants
         WHERE occurrence_id = ?`,
      ).bind(occurrence.occurrence_id).first<TotalRow>()) as TotalRow;
      const total = totalRow.total;

      if (total >= occurrence.personalized_target) {
        await db.write.prepare(
          `UPDATE encounter_occurrences
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status = 'active'`,
        ).bind(occurrence.occurrence_id).run();

        if (occurrence.badge_slug) {
          await awardAchievement(
            db,
            occurrence.user_id,
            occurrence.badge_slug,
            `encounter_occurrence:${occurrence.occurrence_id}`,
            JSON.stringify({
              occurrence_id: occurrence.occurrence_id,
              definition_slug: occurrence.definition_slug,
              personalized_target: occurrence.personalized_target,
              progress_distance: total,
            }),
          );
        }
        completed += 1;
      } else {
        await db.write.prepare(
          `UPDATE encounter_occurrences
           SET status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND status = 'active'`,
        ).bind(occurrence.occurrence_id).run();
        failed += 1;
      }
    } catch (error: unknown) {
      console.error('Error settling personal challenge occurrence:', error);
    }
  }

  return { completed, failed };
}
