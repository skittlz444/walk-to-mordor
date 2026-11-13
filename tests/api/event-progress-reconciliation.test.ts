import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import {
  handleProgressDelete,
  handleProgressPost,
  handleProgressPut,
} from '../../src/progress-handlers';
import { addDays } from '../../src/event-utils';
import type { DbClient } from '../../src/db';

jest.mock('../../src/achievement-awards', () => ({
  checkAndAwardJourneyBadges: jest.fn().mockResolvedValue(undefined),
}));

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

const PREREQUISITE_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT UNIQUE,
  email TEXT,
  approved INTEGER DEFAULT 1,
  reengage_tier_sent INTEGER DEFAULT 0
);

CREATE TABLE progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  date DATE NOT NULL,
  distance REAL NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(date, user_id)
);

CREATE TABLE party_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  party_id INTEGER,
  user_id INTEGER,
  status TEXT
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

// The progress handlers also reconcile community campaigns, so the fixture
// needs the real campaign tables (empty here) instead of letting that hook
// error against a missing schema.
const CAMPAIGN_MIGRATIONS = [
  '0161_create_campaign_definitions.sql',
  '0162_create_campaign_runs.sql',
  '0163_create_campaign_participants.sql',
  '0164_create_campaign_progress_ledger.sql',
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

describe('progress handlers → personal challenge reconciliation', () => {
  const START = '2026-06-10';
  const WINDOW_DATE = '2026-06-11';
  const COVERAGE_END = addDays(START, 2);

  let sqlite: DatabaseSync;
  let db: DbClient;
  let userId: number;
  let definitionId: number;

  function authedRequest(method: 'POST' | 'PUT' | 'DELETE'): Request {
    return new Request('http://localhost/api/calendar-progress', {
      method,
      headers: { Authorization: 'Bearer TEST_MOCK_TOKEN_frodo' },
    });
  }

  function createChallenge(target: number): {
    occurrenceId: number;
    participantId: number;
  } {
    const roll = sqlite.prepare(
      `INSERT INTO daily_rolls
         (user_id, roll_date, status, encounter_definition_id, preview_target_distance)
       VALUES (?, ?, 'accepted', ?, ?)`,
    ).run(userId, addDays(START, -30), definitionId, target);
    const occurrence = sqlite.prepare(
      `INSERT INTO encounter_occurrences
         (definition_id, user_id, daily_roll_id, status, personalized_target,
          started_at, coverage_end_date, grace_deadline)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`,
    ).run(
      definitionId,
      userId,
      Number(roll.lastInsertRowid),
      target,
      START,
      COVERAGE_END,
      addDays(COVERAGE_END, 3),
    );
    const participant = sqlite.prepare(
      'INSERT INTO event_participants (occurrence_id, user_id, progress_distance) VALUES (?, ?, 0)',
    ).run(Number(occurrence.lastInsertRowid), userId);

    return {
      occurrenceId: Number(occurrence.lastInsertRowid),
      participantId: Number(participant.lastInsertRowid),
    };
  }

  function progressRows(): Array<{ id: number; date: string; distance: number }> {
    return sqlite.prepare(
      'SELECT id, date, distance FROM progress WHERE user_id = ? ORDER BY id',
    ).all(userId) as Array<{ id: number; date: string; distance: number }>;
  }

  function ledgerRows(participantId: number): Array<{ distance: number }> {
    return sqlite.prepare(
      'SELECT distance FROM event_progress_ledger WHERE participant_id = ? ORDER BY id',
    ).all(participantId) as Array<{ distance: number }>;
  }

  function participantTotal(participantId: number): number {
    const row = sqlite.prepare(
      'SELECT progress_distance FROM event_participants WHERE id = ?',
    ).get(participantId) as { progress_distance: number };
    return row.progress_distance;
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
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(PREREQUISITE_SCHEMA);
    sqlite.exec(readMigration('0142_create_achievement_definitions.sql'));
    sqlite.exec(readMigration('0143_create_user_achievement_instances.sql'));
    for (const filename of EVENT_MIGRATIONS) {
      sqlite.exec(readMigration(filename));
    }
    for (const filename of CAMPAIGN_MIGRATIONS) {
      sqlite.exec(readMigration(filename));
    }

    db = createTestDb(sqlite);
    const user = sqlite.prepare(
      'INSERT INTO users (username, email, approved) VALUES (?, ?, 1)',
    ).run('frodo', 'frodo@example.com');
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

  it('credits a POST to the ledger and completes the challenge when the target is met', async () => {
    const challenge = createChallenge(10);

    const response = await handleProgressPost(
      authedRequest('POST'),
      db,
      { start: WINDOW_DATE, title: '10' },
      'true',
    );

    expect(response.status).toBe(201);
    expect(progressRows()).toEqual([
      { id: expect.any(Number), date: WINDOW_DATE, distance: 10 },
    ]);
    expect(ledgerRows(challenge.participantId)).toEqual([{ distance: 10 }]);
    expect(participantTotal(challenge.participantId)).toBe(10);
    expect(occurrenceStatus(challenge.occurrenceId)).toBe('completed');
    expect(badgeCount()).toBe(1);
  });

  it.each(['2026-06-09', '2026-06-13'])(
    'excludes a walk dated %s outside the coverage window',
    async (date) => {
      const challenge = createChallenge(10);

      const response = await handleProgressPost(
        authedRequest('POST'),
        db,
        { start: date, title: '10' },
        'true',
      );

      expect(response.status).toBe(201);
      expect(ledgerRows(challenge.participantId)).toEqual([]);
      expect(participantTotal(challenge.participantId)).toBe(0);
      expect(occurrenceStatus(challenge.occurrenceId)).toBe('active');
    },
  );

  it('updates the ledger on PUT and completes on a later upward edit', async () => {
    const challenge = createChallenge(10);

    const createResponse = await handleProgressPost(
      authedRequest('POST'),
      db,
      { start: WINDOW_DATE, title: '4' },
      'true',
    );
    expect(createResponse.status).toBe(201);
    expect(participantTotal(challenge.participantId)).toBe(4);
    expect(occurrenceStatus(challenge.occurrenceId)).toBe('active');

    const updateResponse = await handleProgressPut(
      authedRequest('PUT'),
      db,
      { start: WINDOW_DATE, title: '12' },
      'true',
    );

    expect(updateResponse.status).toBe(200);
    expect(ledgerRows(challenge.participantId)).toEqual([{ distance: 12 }]);
    expect(participantTotal(challenge.participantId)).toBe(12);
    expect(occurrenceStatus(challenge.occurrenceId)).toBe('completed');
    expect(badgeCount()).toBe(1);
  });

  it('removes credit on DELETE but keeps the completion and badge', async () => {
    const challenge = createChallenge(10);
    await handleProgressPost(
      authedRequest('POST'),
      db,
      { start: WINDOW_DATE, title: '12' },
      'true',
    );
    expect(occurrenceStatus(challenge.occurrenceId)).toBe('completed');
    expect(badgeCount()).toBe(1);

    const response = await handleProgressDelete(
      authedRequest('DELETE'),
      db,
      { start: WINDOW_DATE },
      'true',
    );

    expect(response.status).toBe(200);
    expect(ledgerRows(challenge.participantId)).toEqual([]);
    expect(participantTotal(challenge.participantId)).toBe(0);
    expect(progressRows()).toEqual([]);
    expect(occurrenceStatus(challenge.occurrenceId)).toBe('completed');
    expect(badgeCount()).toBe(1);
  });

  it('credits a coverage-window walk logged after the coverage period (grace logging)', async () => {
    const challenge = createChallenge(10);

    const response = await handleProgressPost(
      authedRequest('POST'),
      db,
      { start: COVERAGE_END, title: '5' },
      'true',
    );

    expect(response.status).toBe(201);
    expect(ledgerRows(challenge.participantId)).toEqual([{ distance: 5 }]);
    expect(participantTotal(challenge.participantId)).toBe(5);
  });

  it('still saves the walk when reconciliation fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    createChallenge(10);
    sqlite.exec('DROP TABLE event_progress_ledger');

    const response = await handleProgressPost(
      authedRequest('POST'),
      db,
      { start: WINDOW_DATE, title: '4' },
      'true',
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ message: 'Created successfully' });
    expect(progressRows()).toEqual([
      { id: expect.any(Number), date: WINDOW_DATE, distance: 4 },
    ]);
    expect(consoleError).toHaveBeenCalledWith(
      'Error reconciling personal challenge progress:',
      expect.anything(),
    );
  });
});
