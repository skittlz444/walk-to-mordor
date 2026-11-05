jest.mock('../../src/event-utils', () => ({
  ...jest.requireActual('../../src/event-utils'),
  settleExpiredChallenges: jest.fn(),
}));

jest.mock('../../src/scheduled-handlers', () => ({
  handleOneMoreMileCron: jest.fn(),
  handleReengagementCron: jest.fn(),
}));

import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import { addDays, settleExpiredChallenges } from '../../src/event-utils';
import { handleOneMoreMileCron, handleReengagementCron } from '../../src/scheduled-handlers';
import worker from '../../src/index';
import type { DbClient } from '../../src/db';

const actualEventUtils = jest.requireActual<typeof import('../../src/event-utils')>(
  '../../src/event-utils',
);

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
const START = '2026-06-01';
const GRACE_DEADLINE = addDays(START, 5);
const AFTER_GRACE = addDays(GRACE_DEADLINE, 1);

const PREREQUISITE_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT UNIQUE
);

CREATE TABLE progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  date DATE NOT NULL,
  distance REAL NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(date, user_id)
);
`;

const EVENT_MIGRATIONS = [
  '0152_create_personal_encounter_definitions.sql',
  '0153_create_encounter_occurrences.sql',
  '0154_create_daily_rolls.sql',
  '0155_create_event_participants.sql',
  '0156_create_event_progress_ledger.sql',
  '0157_seed_nazgul_encounter.sql',
  '0158_seed_nazgul_badge.sql',
];

type SqlValue = string | number | null;

/** Minimal DbClient adapter over an in-memory SQLite database. */
function createTestDb(database: DatabaseSync): DbClient {
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
    async batch(statements: Array<{ run(): Promise<{ meta: { changes: number } }> }>) {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    },
  };

  return {
    read: connection as unknown as D1Database,
    write: connection as unknown as D1Database,
  };
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

describe('personal challenge settlement', () => {
  let sqlite: DatabaseSync;
  let db: DbClient;
  let userId: number;
  let definitionId: number;

  function insertDefinition(slug: string, badgeSlug: string | null): number {
    const result = sqlite.prepare(
      `INSERT INTO personal_encounter_definitions
         (slug, name, description, image_slug, badge_slug, duration_days,
          target_stretch_multiplier, target_min_distance, target_max_distance,
          is_repeatable, enabled)
       VALUES (?, ?, ?, ?, ?, 3, 1.3, 3.0, 50.0, 1, 1)`,
    ).run(slug, slug, `${slug} description`, slug, badgeSlug);
    return Number(result.lastInsertRowid);
  }

  function createChallenge(options: {
    target?: number;
    progress?: number;
    definition?: number;
    rollDate?: string;
  } = {}): { occurrenceId: number; participantId: number } {
    const target = options.target ?? 5;
    const challengeDefinition = options.definition ?? definitionId;
    const roll = sqlite.prepare(
      `INSERT INTO daily_rolls
         (user_id, roll_date, status, encounter_definition_id, preview_target_distance)
       VALUES (?, ?, 'accepted', ?, ?)`,
    ).run(userId, options.rollDate ?? addDays(START, -30), challengeDefinition, target);
    const occurrence = sqlite.prepare(
      `INSERT INTO encounter_occurrences
         (definition_id, user_id, daily_roll_id, status, personalized_target,
          started_at, coverage_end_date, grace_deadline)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
    ).run(
      challengeDefinition,
      userId,
      Number(roll.lastInsertRowid),
      target,
      START,
      addDays(START, 2),
      GRACE_DEADLINE,
    );
    const participant = sqlite.prepare(
      'INSERT INTO event_participants (occurrence_id, user_id, progress_distance) VALUES (?, ?, ?)',
    ).run(Number(occurrence.lastInsertRowid), userId, options.progress ?? 0);

    return {
      occurrenceId: Number(occurrence.lastInsertRowid),
      participantId: Number(participant.lastInsertRowid),
    };
  }

  function occurrenceStatus(occurrenceId: number): string {
    const row = sqlite.prepare(
      'SELECT status FROM encounter_occurrences WHERE id = ?',
    ).get(occurrenceId) as { status: string };
    return row.status;
  }

  function badgeCount(): number {
    const row = sqlite.prepare(
      `SELECT COUNT(*) AS count
       FROM user_achievement_instances uai
       JOIN achievement_definitions ad ON ad.id = uai.achievement_id
       WHERE uai.user_id = ? AND ad.slug = 'challenge-nazgul-outrun'`,
    ).get(userId) as { count: number };
    return row.count;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(handleOneMoreMileCron).mockResolvedValue(undefined);
    jest.mocked(handleReengagementCron).mockResolvedValue(undefined);
    jest.mocked(settleExpiredChallenges).mockResolvedValue({ completed: 0, failed: 0 });

    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(PREREQUISITE_SCHEMA);
    sqlite.exec(readMigration('0142_create_achievement_definitions.sql'));
    sqlite.exec(readMigration('0143_create_user_achievement_instances.sql'));
    for (const filename of EVENT_MIGRATIONS) {
      sqlite.exec(readMigration(filename));
    }

    db = createTestDb(sqlite);
    const user = sqlite.prepare('INSERT INTO users (username) VALUES (?)').run('frodo');
    userId = Number(user.lastInsertRowid);
    const definition = sqlite.prepare(
      'SELECT id FROM personal_encounter_definitions WHERE slug = ?',
    ).get('nazgul-pursuit') as { id: number };
    definitionId = definition.id;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  describe('settleExpiredChallenges', () => {
    it('completes a past-grace challenge whose target was met and awards the badge', async () => {
      const challenge = createChallenge({ target: 5, progress: 6 });

      const result = await actualEventUtils.settleExpiredChallenges(db, {
        today: AFTER_GRACE,
      });

      expect(result).toEqual({ completed: 1, failed: 0 });
      expect(occurrenceStatus(challenge.occurrenceId)).toBe('completed');
      expect(badgeCount()).toBe(1);
    });

    it('fails a past-grace challenge whose target was not met without a badge', async () => {
      const challenge = createChallenge({ target: 5, progress: 4 });

      const result = await actualEventUtils.settleExpiredChallenges(db, {
        today: AFTER_GRACE,
      });

      expect(result).toEqual({ completed: 0, failed: 1 });
      expect(occurrenceStatus(challenge.occurrenceId)).toBe('failed');
      expect(badgeCount()).toBe(0);
    });

    it('leaves a challenge active on the grace deadline day itself', async () => {
      const challenge = createChallenge({ target: 5, progress: 6 });

      const result = await actualEventUtils.settleExpiredChallenges(db, {
        today: GRACE_DEADLINE,
      });

      expect(result).toEqual({ completed: 0, failed: 0 });
      expect(occurrenceStatus(challenge.occurrenceId)).toBe('active');
    });

    it('isolates one broken occurrence so the rest still settle', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      // The seeded badge definition is missing, so awardAchievement throws after
      // the occurrence is marked completed; settlement must continue.
      const brokenDefinitionId = insertDefinition('broken-badge', 'missing-badge');
      const broken = createChallenge({
        target: 5,
        progress: 6,
        definition: brokenDefinitionId,
        rollDate: addDays(START, -31),
      });
      const good = createChallenge({ target: 5, progress: 6 });

      const result = await actualEventUtils.settleExpiredChallenges(db, {
        today: AFTER_GRACE,
      });

      expect(occurrenceStatus(broken.occurrenceId)).toBe('completed');
      expect(occurrenceStatus(good.occurrenceId)).toBe('completed');
      expect(result).toEqual({ completed: 1, failed: 0 });
      expect(consoleError).toHaveBeenCalledWith(
        'Error settling personal challenge occurrence:',
        expect.anything(),
      );
    });
  });

  describe('scheduled() wiring', () => {
    it('still runs the existing cron jobs when settlement throws', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.mocked(settleExpiredChallenges).mockRejectedValue(new Error('settle boom'));
      const env = { DB: {} } as unknown as Env;

      await worker.scheduled({} as never, env, {} as never);

      expect(settleExpiredChallenges).toHaveBeenCalledTimes(1);
      expect(handleOneMoreMileCron).toHaveBeenCalledWith(env);
      expect(handleReengagementCron).toHaveBeenCalledWith(env);
      expect(consoleError).toHaveBeenCalledWith(
        'Scheduled personal challenge settlement failed',
        expect.any(Error),
      );
    });
  });
});
