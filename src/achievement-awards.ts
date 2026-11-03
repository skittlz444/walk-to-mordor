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
const WEEKEND_WARRIOR_SLUG = 'habit-weekend-warrior';
const STEADY_MONTH_SLUG = 'habit-steady-month';
const HUNDRED_WEEK_SLUG = 'habit-hundred-week';

// Stable `criteria` labels from the catalog metadata. Descriptions are not
// executable; only these literal strings are routed by this hook.
const WEEKEND_CRITERIA = 'weekend_both_days';
const STEADY_MONTH_CRITERIA = 'distinct_days_month >= 20';
const HUNDRED_WEEK_CRITERIA = 'trailing_7d_km >= 100';

const STEADY_MONTH_MIN_DAYS = 20;
const HUNDRED_WEEK_MIN_KM = 100;

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
  criteria: string | null;
}

/** Read metadata fields that are not part of the presentation contract. */
function toCandidate(row: AwardCandidateRow): AwardCandidate {
  const metadata = parseBadgeMetadataObject(row.metadata);
  const threshold = metadata.threshold_km;
  const criteria = metadata.criteria;
  return {
    slug: row.slug,
    badgeType: row.badge_type,
    thresholdKm: typeof threshold === 'number' && Number.isFinite(threshold) ? threshold : null,
    storyline: parseBadgeMetadata(metadata).storyline ?? null,
    criteria: typeof criteria === 'string' ? criteria : null,
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

/** True when every ISO date in `dates` has at least one progress row. */
async function loggedAllDates(
  db: DbClient,
  userId: number,
  dates: string[],
): Promise<boolean> {
  if (dates.length === 0) return false;
  const placeholders = dates.map(() => '?').join(', ');
  const { results } = await db.read.prepare(
    `SELECT DISTINCT date FROM progress
     WHERE user_id = ? AND date IN (${placeholders})`,
  ).bind(userId, ...dates).all<{ date: string }>();

  const logged = new Set((results || []).map((row) => String(row.date).slice(0, 10)));
  return dates.every((date) => logged.has(date));
}

/** Count distinct logged dates inside the calendar month `YYYY-MM`. */
async function countDistinctDaysInMonth(
  db: DbClient,
  userId: number,
  month: string,
): Promise<number> {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const start = `${month}-01`;
  const end = monthNumber === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;

  const row = await db.read.prepare(
    `SELECT COUNT(DISTINCT date) AS count FROM progress
     WHERE user_id = ? AND date >= ? AND date < ?`,
  ).bind(userId, start, end).first<{ count: number }>();

  return row ? Number(row.count) : 0;
}

/** Sum raw logged distance over the given ISO dates. */
async function sumDistanceForDates(
  db: DbClient,
  userId: number,
  dates: string[],
): Promise<number> {
  if (dates.length === 0) return 0;
  const placeholders = dates.map(() => '?').join(', ');
  const row = await db.read.prepare(
    `SELECT COALESCE(SUM(distance), 0) AS total FROM progress
     WHERE user_id = ? AND date IN (${placeholders})`,
  ).bind(userId, ...dates).first<{ total: number }>();

  return row ? Number(row.total) : 0;
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
 * - `habit-weekend-warrior` (`criteria: weekend_both_days`): `loggedDate` is a
 *   Saturday or Sunday and both weekend dates have progress rows. Keyed to the
 *   Saturday, so repeat logs in the same weekend cannot create a second instance.
 * - `habit-steady-month` (`criteria: distinct_days_month >= 20`): the logged
 *   month has at least 20 distinct logged dates. Keyed to the month.
 * - `habit-hundred-week` (`criteria: trailing_7d_km >= 100`): `loggedDate` is a
 *   Sunday and the raw distance for that Monday-Sunday week is at least 100 km.
 *   Keyed to the Sunday.
 *
 * Habit conditions use raw `progress.distance`; the storyline offset is a
 * display device and never counts toward a habit window.
 *
 * Definitions scoped to a different storyline are skipped; global definitions
 * (`storyline: null` or absent) apply on every storyline. Catalog habits with
 * other criteria are owned by other features and are skipped here.
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
  const weekendCandidates = candidates.filter(
    (candidate) => candidate.criteria === WEEKEND_CRITERIA,
  );
  const steadyMonthCandidates = candidates.filter(
    (candidate) => candidate.criteria === STEADY_MONTH_CRITERIA,
  );
  const hundredWeekCandidates = candidates.filter(
    (candidate) => candidate.criteria === HUNDRED_WEEK_CRITERIA,
  );

  const logged = loggedDate ? parseIsoDate(loggedDate) : null;

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

  if (!logged) return;

  const dayOfWeek = logged.getUTCDay();

  if (faithfulWalker && dayOfWeek === 0) {
    const dates = weekDatesEndingSunday(logged);
    if (await loggedAllDates(db, userId, dates)) {
      await awardSafely(
        db,
        userId,
        faithfulWalker.slug,
        `${FAITHFUL_WALKER_SLUG}:${toIsoDate(logged)}`,
        JSON.stringify({ week_ending: toIsoDate(logged) }),
      );
    }
  }

  if (weekendCandidates.length > 0 && (dayOfWeek === 6 || dayOfWeek === 0)) {
    const saturday = new Date(logged.getTime());
    saturday.setUTCDate(saturday.getUTCDate() - (dayOfWeek === 0 ? 1 : 0));
    const sunday = new Date(saturday.getTime());
    sunday.setUTCDate(sunday.getUTCDate() + 1);
    const saturdayIso = toIsoDate(saturday);
    const weekendDates = [saturdayIso, toIsoDate(sunday)];

    if (await loggedAllDates(db, userId, weekendDates)) {
      for (const candidate of weekendCandidates) {
        await awardSafely(
          db,
          userId,
          candidate.slug,
          `${WEEKEND_WARRIOR_SLUG}:${saturdayIso}`,
          JSON.stringify({ weekend: saturdayIso }),
        );
      }
    }
  }

  if (steadyMonthCandidates.length > 0) {
    const month = toIsoDate(logged).slice(0, 7);
    if ((await countDistinctDaysInMonth(db, userId, month)) >= STEADY_MONTH_MIN_DAYS) {
      for (const candidate of steadyMonthCandidates) {
        await awardSafely(
          db,
          userId,
          candidate.slug,
          `${STEADY_MONTH_SLUG}:${month}`,
          JSON.stringify({ month }),
        );
      }
    }
  }

  if (hundredWeekCandidates.length > 0 && dayOfWeek === 0) {
    const sundayIso = toIsoDate(logged);
    const weekKm = await sumDistanceForDates(db, userId, weekDatesEndingSunday(logged));
    if (weekKm >= HUNDRED_WEEK_MIN_KM) {
      for (const candidate of hundredWeekCandidates) {
        await awardSafely(
          db,
          userId,
          candidate.slug,
          `${HUNDRED_WEEK_SLUG}:${sundayIso}`,
          JSON.stringify({ week_ending: sundayIso, km: Number(weekKm.toFixed(2)) }),
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
