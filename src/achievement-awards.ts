// Badge awarding from walk logging.
//
// Called after a successful progress write. Resolves the user's active
// storyline and displayed distance once, then awards each qualifying
// journey/habit badge through the shared idempotent `awardAchievement`.
//
// Every individual award is isolated: a missing definition, malformed
// metadata, or a D1 failure for one badge is logged and skipped so the rest
// still award. Callers additionally wrap the whole call so a badge bug can
// never fail a walk log.
import type { DbClient } from './db';
import { awardAchievement } from './achievement-utils';
import { parseBadgeMetadata, parseBadgeMetadataObject } from './badge-presentation';
import { calculateTotalDistance } from './goals-handlers';
import { applyStorylineOffset, resolveUserStoryline } from './storyline-utils';

const FIRST_STEPS_SLUG = 'habit-first-steps';
const FAITHFUL_WALKER_SLUG = 'habit-faithful-walker';

interface AwardCandidateRow {
  slug: string;
  badge_type: string;
  metadata: string | null;
}

interface AwardCandidate {
  slug: string;
  badgeType: string;
  thresholdKm: number | null;
  storyline: string | null;
}

/** Read metadata fields that are not part of the presentation contract. */
function toCandidate(row: AwardCandidateRow): AwardCandidate {
  const metadata = parseBadgeMetadataObject(row.metadata);
  const threshold = metadata.threshold_km;
  return {
    slug: row.slug,
    badgeType: row.badge_type,
    thresholdKm: typeof threshold === 'number' && Number.isFinite(threshold) ? threshold : null,
    storyline: parseBadgeMetadata(metadata).storyline ?? null,
  };
}

/**
 * Load the definitions this hook owns. Other catalog entries (community,
 * challenge, book, Field Guide) are awarded by their own consuming features.
 */
async function loadAwardCandidates(db: DbClient): Promise<AwardCandidate[]> {
  const { results } = await db.read.prepare(
    `SELECT slug, badge_type, metadata
     FROM achievement_definitions
     WHERE badge_type IN ('journey', 'habit')
     ORDER BY id ASC`,
  ).all<AwardCandidateRow>();

  return (results || []).map(toCandidate);
}

async function hasAnyProgress(db: DbClient, userId: number): Promise<boolean> {
  const row = await db.read.prepare(
    'SELECT 1 AS present FROM progress WHERE user_id = ? LIMIT 1',
  ).bind(userId).first<{ present: number }>();

  return row != null;
}

/** Parse a `YYYY-MM-DD` string as UTC midnight. Returns null when unusable. */
function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject dates that JS would otherwise roll over (e.g. 2026-02-30).
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Monday-through-Sunday ISO dates for the week containing `sunday`. */
function weekDatesEndingSunday(sunday: Date): string[] {
  const dates: string[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(sunday.getTime());
    day.setUTCDate(day.getUTCDate() - offset);
    dates.push(toIsoDate(day));
  }
  return dates;
}

async function loggedAllOfWeek(
  db: DbClient,
  userId: number,
  dates: string[],
): Promise<boolean> {
  const { results } = await db.read.prepare(
    `SELECT DISTINCT date FROM progress
     WHERE user_id = ? AND date IN (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(userId, ...dates).all<{ date: string }>();

  const logged = new Set((results || []).map((row) => String(row.date).slice(0, 10)));
  return dates.every((date) => logged.has(date));
}

/**
 * Award every journey/habit badge the user currently qualifies for.
 *
 * Conditions:
 * - `habit-first-steps`: the user has at least one progress row.
 * - `journey-*`: `threshold_km <= displayed distance` for the active storyline.
 * - `habit-faithful-walker`: `loggedDate` is a Sunday and all seven dates of
 *   that Monday-Sunday week have progress rows. Keyed to the Sunday date, so
 *   repeat logs in the same week cannot create a second instance.
 *
 * Definitions scoped to a different storyline are skipped; global definitions
 * (`storyline: null` or absent) apply on every storyline. Catalog habits with
 * other criteria are not handled here and are skipped.
 */
export async function checkAndAwardJourneyBadges(
  db: DbClient,
  userId: number,
  loggedDate: string,
): Promise<void> {
  const [{ storyline, distanceOffset }, rawDistance] = await Promise.all([
    resolveUserStoryline(db, userId),
    calculateTotalDistance(db, userId),
  ]);
  const displayedDistance = applyStorylineOffset(rawDistance, distanceOffset);
  const activeStoryline = storyline.slug;

  const candidates = (await loadAwardCandidates(db)).filter(
    (candidate) => candidate.storyline === null || candidate.storyline === activeStoryline,
  );

  const firstSteps = candidates.find((candidate) => candidate.slug === FIRST_STEPS_SLUG);
  const faithfulWalker = candidates.find(
    (candidate) => candidate.slug === FAITHFUL_WALKER_SLUG,
  );
  const journeyCandidates = candidates.filter(
    (candidate) => candidate.badgeType === 'journey',
  );

  if (firstSteps && (await hasAnyProgress(db, userId))) {
    await awardSafely(db, userId, firstSteps.slug, FIRST_STEPS_SLUG, null);
  }

  for (const candidate of journeyCandidates) {
    if (candidate.thresholdKm === null) continue;
    if (candidate.thresholdKm > displayedDistance) continue;
    await awardSafely(
      db,
      userId,
      candidate.slug,
      `journey:${candidate.slug}`,
      JSON.stringify({ storyline: activeStoryline, distance_km: displayedDistance }),
    );
  }

  if (faithfulWalker && loggedDate) {
    const logged = parseIsoDate(loggedDate);
    if (logged && logged.getUTCDay() === 0) {
      const dates = weekDatesEndingSunday(logged);
      if (await loggedAllOfWeek(db, userId, dates)) {
        await awardSafely(
          db,
          userId,
          faithfulWalker.slug,
          `${FAITHFUL_WALKER_SLUG}:${toIsoDate(logged)}`,
          JSON.stringify({ week_ending: toIsoDate(logged) }),
        );
      }
    }
  }
}

/** Award one badge, swallowing and logging failures so the rest still run. */
async function awardSafely(
  db: DbClient,
  userId: number,
  slug: string,
  idempotencyKey: string,
  contextMetadata: string | null,
): Promise<void> {
  try {
    await awardAchievement(db, userId, slug, idempotencyKey, contextMetadata);
  } catch (error: unknown) {
    console.error(`Failed to award achievement "${slug}" for user ${userId}:`, error);
  }
}
