import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import { checkAndAwardJourneyBadges } from '../../src/achievement-awards';
import {
  AchievementDefinitionNotFoundError,
  awardAchievement,
  getUserAchievementSummary,
  type AwardAchievementResult,
} from '../../src/achievement-utils';
import * as achievementUtils from '../../src/achievement-utils';
import type { DbClient } from '../../src/db';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

const FRODO_SAM = 'frodo-sam';
const PIPPIN = 'pippin';

const JOURNEY_SLUGS_UNDER_4000_KM = [
  'journey-frodo-sam-buckleberry-ferry',
  'journey-frodo-sam-glittering-caves',
  'journey-frodo-sam-lothlorien-guest',
  'journey-frodo-sam-mordor-threshold',
  'journey-frodo-sam-rauros-parting',
  'journey-frodo-sam-through-khazad-dum',
  'journey-frodo-sam-weathertop-survivor',
];

const MINIMAL_SCHEMA = `
CREATE TABLE storylines (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  path_key TEXT NOT NULL DEFAULT 'fellowship',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  admin_only INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT UNIQUE,
  is_admin INTEGER NOT NULL DEFAULT 0,
  active_storyline_id INTEGER,
  storyline_distance_offset REAL NOT NULL DEFAULT 0
);

CREATE TABLE progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  date TEXT NOT NULL,
  distance REAL NOT NULL,
  user_id INTEGER,
  UNIQUE(date, user_id)
);
`;

type SqlValue = string | number | null;

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

/** Minimal DbClient adapter over an in-memory SQLite database. */
function createDbClient(database: DatabaseSync): DbClient {
  const connection = {
    prepare(sql: string) {
      const statement = () => database.prepare(sql);
      const bound = (values: SqlValue[]) => ({
        async first<T>(): Promise<T | null> {
          return (statement().get(...values) ?? null) as T | null;
        },
        async all<T>() {
          return { results: statement().all(...values) as T[] };
        },
        async run() {
          const result = statement().run(...values);
          return {
            meta: {
              changes: Number(result.changes),
              last_row_id: Number(result.lastInsertRowid),
            },
          };
        },
      });

      return {
        ...bound([]),
        bind(...values: SqlValue[]) {
          return bound(values);
        },
      };
    },
  };

  return {
    read: connection as unknown as D1Database,
    write: connection as unknown as D1Database,
  };
}

describe('checkAndAwardJourneyBadges', () => {
  let sqlite: DatabaseSync;
  let db: DbClient;
  let userId: number;
  let userSequence = 0;
  let consoleError: jest.SpyInstance;

  function insertUser(storylineSlug: string, offset = 0): number {
    const storyline = sqlite
      .prepare('SELECT id FROM storylines WHERE slug = ?')
      .get(storylineSlug) as { id: number };
    const result = sqlite
      .prepare('INSERT INTO users (username, active_storyline_id, storyline_distance_offset) VALUES (?, ?, ?)')
      .run(`user-${storylineSlug}-${++userSequence}`, storyline.id, offset);
    return Number(result.lastInsertRowid);
  }

  function logProgress(user: number, date: string, distance: number): void {
    sqlite
      .prepare('INSERT INTO progress (date, distance, user_id) VALUES (?, ?, ?)')
      .run(date, distance, user);
  }

  function updateProgress(user: number, date: string, distance: number): void {
    sqlite
      .prepare('UPDATE progress SET distance = ? WHERE user_id = ? AND date = ?')
      .run(distance, user, date);
  }

  function insertDefinition(slug: string, badgeType: string, metadata: string | null, isRepeatable = 0): void {
    sqlite
      .prepare(
        `INSERT INTO achievement_definitions (slug, name, badge_type, is_repeatable, metadata)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(slug, slug, badgeType, isRepeatable, metadata);
  }

  function earnedSlugs(user: number, slugPrefix?: string): string[] {
    const rows = sqlite
      .prepare(
        `SELECT ad.slug FROM user_achievement_instances uai
         JOIN achievement_definitions ad ON ad.id = uai.achievement_id
         WHERE uai.user_id = ?
         ORDER BY ad.slug ASC`,
      )
      .all(user) as Array<{ slug: string }>;
    return rows
      .map((row) => row.slug)
      .filter((slug) => (slugPrefix === undefined ? true : slug.startsWith(slugPrefix)));
  }

  function instanceCount(user: number, slug: string): number {
    const row = sqlite
      .prepare(
        `SELECT COUNT(*) AS count FROM user_achievement_instances uai
         JOIN achievement_definitions ad ON ad.id = uai.achievement_id
         WHERE uai.user_id = ? AND ad.slug = ?`,
      )
      .get(user, slug) as { count: number };
    return Number(row.count);
  }

  function idempotencyKeys(user: number, slug: string): string[] {
    const rows = sqlite
      .prepare(
        `SELECT uai.idempotency_key FROM user_achievement_instances uai
         JOIN achievement_definitions ad ON ad.id = uai.achievement_id
         WHERE uai.user_id = ? AND ad.slug = ?
         ORDER BY uai.id ASC`,
      )
      .all(user, slug) as Array<{ idempotency_key: string }>;
    return rows.map((row) => row.idempotency_key);
  }

  function contextMetadata(user: number, slug: string): Array<Record<string, unknown>> {
    const rows = sqlite
      .prepare(
        `SELECT uai.context_metadata FROM user_achievement_instances uai
         JOIN achievement_definitions ad ON ad.id = uai.achievement_id
         WHERE uai.user_id = ? AND ad.slug = ?
         ORDER BY uai.id ASC`,
      )
      .all(user, slug) as Array<{ context_metadata: string | null }>;
    return rows.map((row) => JSON.parse(row.context_metadata ?? '{}') as Record<string, unknown>);
  }

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(MINIMAL_SCHEMA);
    sqlite.exec(readMigration('0142_create_achievement_definitions.sql'));
    sqlite.exec(readMigration('0143_create_user_achievement_instances.sql'));
    sqlite.exec(readMigration('0144_seed_journey_badges.sql'));
    sqlite.exec(readMigration('0145_seed_catalog_expansion.sql'));
    sqlite.exec(
      `INSERT INTO storylines (slug, title) VALUES
         ('${FRODO_SAM}', 'Frodo & Sam'),
         ('${PIPPIN}', 'Pippin');`,
    );

    db = createDbClient(sqlite);
    userId = insertUser(FRODO_SAM);
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  it('awards a journey badge when a walk crosses its threshold', async () => {
    logProgress(userId, '2026-01-05', 50);
    await checkAndAwardJourneyBadges(db, userId, '2026-01-05');

    expect(earnedSlugs(userId, 'journey-')).toEqual([]);

    logProgress(userId, '2026-01-06', 70);
    await checkAndAwardJourneyBadges(db, userId, '2026-01-06');

    expect(earnedSlugs(userId, 'journey-')).toEqual([
      'journey-frodo-sam-buckleberry-ferry',
    ]);
    expect(instanceCount(userId, 'journey-frodo-sam-buckleberry-ferry')).toBe(1);
  });

  it('awards against the displayed distance including the storyline offset', async () => {
    const offsetUserId = insertUser(FRODO_SAM, 3000);
    logProgress(offsetUserId, '2026-01-07', 900);

    await checkAndAwardJourneyBadges(db, offsetUserId, '2026-01-07');

    expect(earnedSlugs(offsetUserId)).toContain('journey-frodo-sam-glittering-caves');
  });

  it('awards the Glittering Caves return badge exactly at 3827.0 km', async () => {
    logProgress(userId, '2026-01-05', 3826.99);
    await checkAndAwardJourneyBadges(db, userId, '2026-01-05');

    expect(earnedSlugs(userId)).not.toContain('journey-frodo-sam-glittering-caves');

    updateProgress(userId, '2026-01-05', 3827.0);
    await checkAndAwardJourneyBadges(db, userId, '2026-01-05');

    expect(earnedSlugs(userId)).toContain('journey-frodo-sam-glittering-caves');
  });

  it('does not create a second instance for an already-earned badge', async () => {
    logProgress(userId, '2026-01-05', 200);
    await checkAndAwardJourneyBadges(db, userId, '2026-01-05');
    await checkAndAwardJourneyBadges(db, userId, '2026-01-05');

    expect(instanceCount(userId, 'habit-first-steps')).toBe(1);
    expect(instanceCount(userId, 'journey-frodo-sam-buckleberry-ferry')).toBe(1);
  });

  it('does not duplicate a badge that the 0148 backfill already stored under a legacy key', async () => {
    const backfilledSlugs = ['habit-first-steps', 'journey-frodo-sam-buckleberry-ferry'];

    logProgress(userId, '2026-01-05', 200);
    sqlite.exec(readMigration('0148_backfill_existing_achievements.sql'));

    // The backfill wrote per-definition keys, not the runtime's non-repeatable sentinel.
    expect(earnedSlugs(userId)).toEqual(backfilledSlugs);
    expect(idempotencyKeys(userId, 'habit-first-steps')).toEqual(['habit-first-steps']);
    expect(idempotencyKeys(userId, 'journey-frodo-sam-buckleberry-ferry')).toEqual([
      'journey:journey-frodo-sam-buckleberry-ferry',
    ]);
    const backfilledId = (sqlite
      .prepare(
        `SELECT i.id FROM user_achievement_instances i
         JOIN achievement_definitions d ON d.id = i.achievement_id
         WHERE i.user_id = ? AND d.slug = 'habit-first-steps'`,
      )
      .get(userId) as { id: number }).id;

    // Both entry points that award after a walk must find the backfilled row, whatever key it has.
    const directAward = await awardAchievement(db, userId, 'habit-first-steps', 'log:2026-01-05');
    expect(directAward).toEqual({ instanceId: backfilledId, isNew: false });

    await checkAndAwardJourneyBadges(db, userId, '2026-01-05');

    for (const slug of backfilledSlugs) {
      expect(instanceCount(userId, slug)).toBe(1);
    }
    const summary = await getUserAchievementSummary(db, userId);
    expect(
      summary.filter((entry) => backfilledSlugs.includes(entry.slug)).map((entry) => entry.earned_count),
    ).toEqual([1, 1]);
  });

  it('skips journey badges scoped to another storyline', async () => {
    const pippinUserId = insertUser(PIPPIN);
    logProgress(pippinUserId, '2026-01-05', 4000);

    await checkAndAwardJourneyBadges(db, pippinUserId, '2026-01-05');

    expect(earnedSlugs(pippinUserId, 'journey-')).toEqual([]);
  });

  it('applies global habit badges on any storyline', async () => {
    const pippinUserId = insertUser(PIPPIN);
    logProgress(pippinUserId, '2026-01-05', 1);

    await checkAndAwardJourneyBadges(db, pippinUserId, '2026-01-05');

    expect(earnedSlugs(pippinUserId)).toEqual(['habit-first-steps']);
  });

  it('awards the faithful-walker habit on Sunday when the whole Monday-Sunday week is logged', async () => {
    const week = [
      '2026-01-26',
      '2026-01-27',
      '2026-01-28',
      '2026-01-29',
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
    ];
    for (const date of week) {
      logProgress(userId, date, 1);
    }

    await checkAndAwardJourneyBadges(db, userId, '2026-02-01');

    expect(earnedSlugs(userId)).toContain('habit-faithful-walker');
    const keys = idempotencyKeys(userId, 'habit-faithful-walker');
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/:2026-02-01$/);
  });

  it('does not award the faithful-walker habit on a non-Sunday log', async () => {
    const week = [
      '2026-01-26',
      '2026-01-27',
      '2026-01-28',
      '2026-01-29',
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
    ];
    for (const date of week) {
      logProgress(userId, date, 1);
    }

    await checkAndAwardJourneyBadges(db, userId, '2026-01-31');

    expect(earnedSlugs(userId)).not.toContain('habit-faithful-walker');
  });

  it('does not award the faithful-walker habit for an incomplete week', async () => {
    const mondayToSaturday = [
      '2026-01-26',
      '2026-01-27',
      '2026-01-28',
      '2026-01-29',
      '2026-01-30',
      '2026-01-31',
    ];
    for (const date of mondayToSaturday) {
      logProgress(userId, date, 1);
    }

    await checkAndAwardJourneyBadges(db, userId, '2026-02-01');

    expect(earnedSlugs(userId)).not.toContain('habit-faithful-walker');
  });

  it('does not award the faithful-walker habit twice in the same week', async () => {
    const week = [
      '2026-01-26',
      '2026-01-27',
      '2026-01-28',
      '2026-01-29',
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
    ];
    for (const date of week) {
      logProgress(userId, date, 1);
    }

    await checkAndAwardJourneyBadges(db, userId, '2026-02-01');
    await checkAndAwardJourneyBadges(db, userId, '2026-02-01');
    await checkAndAwardJourneyBadges(db, userId, '2026-01-26');

    expect(instanceCount(userId, 'habit-faithful-walker')).toBe(1);
  });

  it('backfills every crossed journey threshold in one call', async () => {
    logProgress(userId, '2026-01-05', 4000);

    await checkAndAwardJourneyBadges(db, userId, '2026-01-05');

    expect(earnedSlugs(userId, 'journey-')).toEqual(JOURNEY_SLUGS_UNDER_4000_KM);
    expect(earnedSlugs(userId)).toContain('habit-first-steps');
    expect(earnedSlugs(userId)).not.toContain('journey-frodo-sam-home-at-sunset');
  });

  it('isolates a missing definition and still awards the rest', async () => {
    logProgress(userId, '2026-01-05', 4000);

    const realAward = achievementUtils.awardAchievement;
    jest.spyOn(achievementUtils, 'awardAchievement').mockImplementation(
      async (
        awardDb: DbClient,
        awardUserId: number,
        slug: string,
        key: string,
        context?: string | null,
      ): Promise<AwardAchievementResult> => {
        if (slug === 'journey-frodo-sam-weathertop-survivor') {
          throw new AchievementDefinitionNotFoundError(slug);
        }
        return realAward(awardDb, awardUserId, slug, key, context);
      },
    );

    await expect(
      checkAndAwardJourneyBadges(db, userId, '2026-01-05'),
    ).resolves.toBeUndefined();

    expect(earnedSlugs(userId)).toContain('journey-frodo-sam-buckleberry-ferry');
    expect(earnedSlugs(userId)).toContain('journey-frodo-sam-through-khazad-dum');
    expect(earnedSlugs(userId)).not.toContain('journey-frodo-sam-weathertop-survivor');
    expect(consoleError).toHaveBeenCalled();
  });

  it('isolates a thrown award error and still awards the rest', async () => {
    logProgress(userId, '2026-01-05', 4000);

    const realAward = achievementUtils.awardAchievement;
    jest.spyOn(achievementUtils, 'awardAchievement').mockImplementation(
      async (
        awardDb: DbClient,
        awardUserId: number,
        slug: string,
        key: string,
        context?: string | null,
      ): Promise<AwardAchievementResult> => {
        if (slug === 'journey-frodo-sam-glittering-caves') {
          throw new Error('D1_ERROR: disk I/O error');
        }
        return realAward(awardDb, awardUserId, slug, key, context);
      },
    );

    await expect(
      checkAndAwardJourneyBadges(db, userId, '2026-01-05'),
    ).resolves.toBeUndefined();

    expect(earnedSlugs(userId)).toContain('journey-frodo-sam-mordor-threshold');
    expect(earnedSlugs(userId)).not.toContain('journey-frodo-sam-glittering-caves');
    expect(consoleError).toHaveBeenCalled();
  });

  it('is safe with malformed or missing badge metadata', async () => {
    insertDefinition('journey-broken-metadata', 'journey', '{not valid json');
    insertDefinition('journey-missing-metadata', 'journey', null);
    insertDefinition('journey-string-threshold', 'journey', '{"threshold_km":"far"}');
    logProgress(userId, '2026-01-05', 500);

    await expect(
      checkAndAwardJourneyBadges(db, userId, '2026-01-05'),
    ).resolves.toBeUndefined();

    expect(earnedSlugs(userId)).toContain('journey-frodo-sam-buckleberry-ferry');
    expect(earnedSlugs(userId)).not.toContain('journey-broken-metadata');
    expect(earnedSlugs(userId)).not.toContain('journey-missing-metadata');
    expect(earnedSlugs(userId)).not.toContain('journey-string-threshold');
  });

  it('awards Weekend Warrior when both weekend days are logged', async () => {
    logProgress(userId, '2026-01-10', 5); // Saturday
    logProgress(userId, '2026-01-11', 5); // Sunday

    await checkAndAwardJourneyBadges(db, userId, '2026-01-11');

    expect(idempotencyKeys(userId, 'habit-weekend-warrior')).toEqual([
      'habit-weekend-warrior:2026-01-10',
    ]);
    expect(contextMetadata(userId, 'habit-weekend-warrior')).toEqual([
      { weekend: '2026-01-10' },
    ]);
  });

  it('awards Weekend Warrior from a Saturday log when the Sunday walk already exists', async () => {
    logProgress(userId, '2026-01-11', 5); // Sunday
    logProgress(userId, '2026-01-10', 5); // Saturday

    await checkAndAwardJourneyBadges(db, userId, '2026-01-10');

    expect(instanceCount(userId, 'habit-weekend-warrior')).toBe(1);
  });

  it('does not award Weekend Warrior when one weekend day is missing', async () => {
    logProgress(userId, '2026-01-10', 5); // Saturday
    logProgress(userId, '2026-01-12', 5); // Monday

    await checkAndAwardJourneyBadges(db, userId, '2026-01-12');

    expect(earnedSlugs(userId)).not.toContain('habit-weekend-warrior');
  });

  it('awards Weekend Warrior once per weekend', async () => {
    logProgress(userId, '2026-01-10', 5);
    logProgress(userId, '2026-01-11', 5);

    await checkAndAwardJourneyBadges(db, userId, '2026-01-11');
    updateProgress(userId, '2026-01-11', 6);
    await checkAndAwardJourneyBadges(db, userId, '2026-01-11');
    await checkAndAwardJourneyBadges(db, userId, '2026-01-10');

    expect(instanceCount(userId, 'habit-weekend-warrior')).toBe(1);
  });

  it('awards Steady Month on the twentieth distinct date', async () => {
    for (let day = 1; day <= 19; day++) {
      logProgress(userId, `2026-03-${String(day).padStart(2, '0')}`, 1);
    }

    await checkAndAwardJourneyBadges(db, userId, '2026-03-19');

    expect(earnedSlugs(userId)).not.toContain('habit-steady-month');

    logProgress(userId, '2026-03-20', 1);
    await checkAndAwardJourneyBadges(db, userId, '2026-03-20');

    expect(idempotencyKeys(userId, 'habit-steady-month')).toEqual([
      'habit-steady-month:2026-03',
    ]);
    expect(contextMetadata(userId, 'habit-steady-month')).toEqual([{ month: '2026-03' }]);
  });

  it('does not award Steady Month when the twentieth log repeats an existing date', async () => {
    for (let day = 1; day <= 19; day++) {
      logProgress(userId, `2026-03-${String(day).padStart(2, '0')}`, 1);
    }

    await checkAndAwardJourneyBadges(db, userId, '2026-03-19');
    updateProgress(userId, '2026-03-19', 2);
    await checkAndAwardJourneyBadges(db, userId, '2026-03-19');

    expect(earnedSlugs(userId)).not.toContain('habit-steady-month');
  });

  it('awards Steady Month once per month', async () => {
    for (let day = 1; day <= 20; day++) {
      logProgress(userId, `2026-03-${String(day).padStart(2, '0')}`, 1);
    }

    await checkAndAwardJourneyBadges(db, userId, '2026-03-20');
    logProgress(userId, '2026-03-21', 1);
    await checkAndAwardJourneyBadges(db, userId, '2026-03-21');

    expect(instanceCount(userId, 'habit-steady-month')).toBe(1);
  });

  it('keeps Steady Month windows apart at the December year boundary', async () => {
    for (let day = 1; day <= 20; day++) {
      logProgress(userId, `2026-12-${String(day).padStart(2, '0')}`, 1);
    }

    await checkAndAwardJourneyBadges(db, userId, '2026-12-20');

    expect(idempotencyKeys(userId, 'habit-steady-month')).toEqual([
      'habit-steady-month:2026-12',
    ]);

    logProgress(userId, '2027-01-03', 1);
    await checkAndAwardJourneyBadges(db, userId, '2027-01-03');

    expect(idempotencyKeys(userId, 'habit-steady-month')).toEqual([
      'habit-steady-month:2026-12',
    ]);
  });

  it('awards Hundred-K Week on the Sunday log when the raw week totals 100 km', async () => {
    logProgress(userId, '2026-01-05', 60); // Monday
    logProgress(userId, '2026-01-11', 60); // Sunday

    await checkAndAwardJourneyBadges(db, userId, '2026-01-11');

    expect(idempotencyKeys(userId, 'habit-hundred-week')).toEqual([
      'habit-hundred-week:2026-01-11',
    ]);
    expect(contextMetadata(userId, 'habit-hundred-week')).toEqual([
      { week_ending: '2026-01-11', km: 120 },
    ]);
  });

  it('does not award Hundred-K Week on a Monday-to-Saturday log', async () => {
    for (let day = 5; day <= 10; day++) {
      logProgress(userId, `2026-01-${String(day).padStart(2, '0')}`, 20);
    }

    await checkAndAwardJourneyBadges(db, userId, '2026-01-10');

    expect(earnedSlugs(userId)).not.toContain('habit-hundred-week');
  });

  it('does not award Hundred-K Week when the raw week is below 100 km', async () => {
    logProgress(userId, '2026-01-05', 50); // Monday
    logProgress(userId, '2026-01-11', 49.9); // Sunday

    await checkAndAwardJourneyBadges(db, userId, '2026-01-11');

    expect(earnedSlugs(userId)).not.toContain('habit-hundred-week');
  });

  it('does not award Hundred-K Week from displayed distance alone', async () => {
    const offsetUserId = insertUser(FRODO_SAM, 3000);
    logProgress(offsetUserId, '2026-01-05', 50); // Monday
    logProgress(offsetUserId, '2026-01-11', 40); // Sunday, 90 km raw

    await checkAndAwardJourneyBadges(db, offsetUserId, '2026-01-11');

    expect(earnedSlugs(offsetUserId)).not.toContain('habit-hundred-week');
  });

  it('awards Hundred-K Week in each qualifying week, advancing rank', async () => {
    logProgress(userId, '2026-01-05', 100); // Monday
    logProgress(userId, '2026-01-11', 1); // Sunday
    await checkAndAwardJourneyBadges(db, userId, '2026-01-11');

    logProgress(userId, '2026-01-12', 100); // Monday
    logProgress(userId, '2026-01-18', 1); // Sunday
    await checkAndAwardJourneyBadges(db, userId, '2026-01-18');

    expect(idempotencyKeys(userId, 'habit-hundred-week')).toEqual([
      'habit-hundred-week:2026-01-11',
      'habit-hundred-week:2026-01-18',
    ]);
  });

  it('awards the in-scope habit criteria and skips unknown criteria', async () => {
    insertDefinition(
      'habit-unknown-criteria',
      'habit',
      '{"storyline":null,"criteria":"mystery_rule","unit":"things"}',
      1,
    );

    for (let day = 5; day <= 25; day++) {
      logProgress(userId, `2026-01-${String(day).padStart(2, '0')}`, day <= 11 ? 20 : 1);
    }

    await checkAndAwardJourneyBadges(db, userId, '2026-01-11');

    expect(earnedSlugs(userId)).toEqual(
      expect.arrayContaining([
        'habit-weekend-warrior',
        'habit-steady-month',
        'habit-hundred-week',
      ]),
    );
    expect(earnedSlugs(userId)).not.toContain('habit-unknown-criteria');
  });

  it('treats a missing or unparseable logged date as a no-op for habit windows', async () => {
    logProgress(userId, '2026-01-10', 5); // Saturday
    logProgress(userId, '2026-01-11', 5); // Sunday of the same weekend

    await expect(
      checkAndAwardJourneyBadges(db, userId, ''),
    ).resolves.toBeUndefined();
    await expect(
      checkAndAwardJourneyBadges(db, userId, 'not-a-date'),
    ).resolves.toBeUndefined();

    expect(instanceCount(userId, 'habit-weekend-warrior')).toBe(0);
    expect(instanceCount(userId, 'habit-faithful-walker')).toBe(0);
    expect(instanceCount(userId, 'habit-steady-month')).toBe(0);
    expect(instanceCount(userId, 'habit-hundred-week')).toBe(0);
  });
});
