import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import {
  EncounterValidationError,
  addDays,
  utcToday,
} from '../../src/event-utils';
import {
  handleAcceptEncounter,
  handleDailyRoll,
  handleDeclineEncounter,
} from '../../src/event-handlers';
import type { DbClient } from '../../src/db';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
const TODAY = utcToday();

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

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function rawRequest(url: string, body: string): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

describe('event-handlers', () => {
  let sqlite: DatabaseSync;
  let db: DbClient;
  let userId: number;
  let definitionId: number;

  function insertUser(username: string): number {
    const result = sqlite.prepare('INSERT INTO users (username) VALUES (?)').run(username);
    return Number(result.lastInsertRowid);
  }

  function seedActivity(days = 7, distance = 1): void {
    for (let index = 0; index < days; index += 1) {
      sqlite.prepare('INSERT INTO progress (date, distance, user_id) VALUES (?, ?, ?)')
        .run(addDays(TODAY, -(index + 1)), distance, userId);
    }
  }

  function insertRoll(
    rollDate: string,
    status: 'offered' | 'accepted' | 'declined',
    encounterDefinitionId: number | null,
    previewTarget: number | null,
  ): number {
    const result = sqlite.prepare(
      `INSERT INTO daily_rolls
         (user_id, roll_date, status, encounter_definition_id, preview_target_distance)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(userId, rollDate, status, encounterDefinitionId, previewTarget);
    return Number(result.lastInsertRowid);
  }

  function insertOccurrence(target = 5, status: 'active' | 'completed' = 'active'): number {
    const rollId = insertRoll(addDays(TODAY, -40), 'accepted', definitionId, target);
    const result = sqlite.prepare(
      `INSERT INTO encounter_occurrences
         (definition_id, user_id, daily_roll_id, status, personalized_target,
          started_at, coverage_end_date, grace_deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      definitionId,
      userId,
      rollId,
      status,
      target,
      addDays(TODAY, -40),
      addDays(TODAY, -38),
      addDays(TODAY, -35),
    );
    return Number(result.lastInsertRowid);
  }

  function rollRow(): { status: string; encounter_definition_id: number | null } {
    return sqlite.prepare(
      'SELECT status, encounter_definition_id FROM daily_rolls WHERE user_id = ? AND roll_date = ?',
    ).get(userId, TODAY) as { status: string; encounter_definition_id: number | null };
  }

  function badDb(): DbClient {
    const failing = {
      prepare() {
        throw new EncounterValidationError('invalid from domain');
      },
    } as unknown as D1Database;
    return { read: failing, write: failing };
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

    db = createTestDb(sqlite);
    userId = insertUser('frodo');
    const definition = sqlite.prepare(
      'SELECT id FROM personal_encounter_definitions WHERE slug = ?',
    ).get('nazgul-pursuit') as { id: number };
    definitionId = definition.id;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  describe('handleDailyRoll', () => {
    it('returns no offer for an inactive user', async () => {
      const response = await handleDailyRoll(
        new Request('http://localhost/api/events/daily-roll', { method: 'POST' }),
        db,
        userId,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ offer: null });
    });

    it('forces an offer for an eligible user', async () => {
      seedActivity();

      const response = await handleDailyRoll(
        new Request('http://localhost/api/events/daily-roll', { method: 'POST' }),
        db,
        userId,
        { forceOffer: true },
      );

      expect(response.status).toBe(200);
      const body = await response.json() as {
        offer: { status: string; target: number; definition: { id: number } } | null;
      };
      expect(body.offer).not.toBeNull();
      expect(body.offer?.status).toBe('offered');
      expect(body.offer?.definition.id).toBe(definitionId);
      expect(body.offer?.target).toBe(3);
    });

    it('returns the same offer on a repeated roll', async () => {
      seedActivity();

      const first = await handleDailyRoll(
        new Request('http://localhost/api/events/daily-roll', { method: 'POST' }),
        db,
        userId,
        { forceOffer: true },
      );
      const second = await handleDailyRoll(
        new Request('http://localhost/api/events/daily-roll', { method: 'POST' }),
        db,
        userId,
        { forceOffer: true },
      );

      expect(await second.json()).toEqual(await first.json());
      const count = sqlite.prepare(
        'SELECT COUNT(*) AS count FROM daily_rolls WHERE user_id = ?',
      ).get(userId) as { count: number };
      expect(count.count).toBe(1);
    });

    it.each(['accepted', 'declined'] as const)(
      'returns no offer for an already-%s roll',
      async (status) => {
        insertRoll(TODAY, status, definitionId, 5);

        const response = await handleDailyRoll(
          new Request('http://localhost/api/events/daily-roll', { method: 'POST' }),
          db,
          userId,
          { forceOffer: true },
        );

        expect(await response.json()).toEqual({ offer: null });
      },
    );

    it('suppresses an offer while a personal challenge is active', async () => {
      seedActivity();
      insertOccurrence();

      const response = await handleDailyRoll(
        new Request('http://localhost/api/events/daily-roll', { method: 'POST' }),
        db,
        userId,
        { forceOffer: true },
      );

      expect(await response.json()).toEqual({ offer: null });
    });

    it('returns 500 and logs when the roll query fails', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      sqlite.exec('DROP TABLE daily_rolls');

      const response = await handleDailyRoll(
        new Request('http://localhost/api/events/daily-roll', { method: 'POST' }),
        db,
        userId,
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal server error' });
      expect(consoleError).toHaveBeenCalledWith(
        'Error rolling daily encounter:',
        expect.anything(),
      );
    });
  });

  describe('handleAcceptEncounter', () => {
    const ACCEPT_URL = 'http://localhost/api/events/daily-roll/accept';

    it('creates the occurrence and participant and flips the roll', async () => {
      insertRoll(TODAY, 'offered', definitionId, 10);

      const response = await handleAcceptEncounter(
        jsonRequest(ACCEPT_URL, { encounter_definition_id: definitionId }),
        db,
        userId,
      );

      expect(response.status).toBe(200);
      const body = await response.json() as {
        alreadyAccepted: boolean;
        completed: boolean;
        occurrence: {
          id: number;
          status: string;
          personalized_target: number;
          coverage_end_date: string;
          grace_deadline: string;
        };
        definition: {
          id: number;
          slug: string;
          description: string;
          image_slug: string | null;
          badge_slug: string | null;
        };
      };
      expect(body.alreadyAccepted).toBe(false);
      expect(body.completed).toBe(false);
      expect(body.occurrence.status).toBe('active');
      expect(body.occurrence.personalized_target).toBe(10);
      expect(body.occurrence.coverage_end_date).toBe(addDays(TODAY, 2));
      expect(body.occurrence.grace_deadline).toBe(addDays(TODAY, 5));
      expect(body.definition).toMatchObject({
        id: definitionId,
        slug: 'nazgul-pursuit',
        image_slug: 'nazgul-pursuit',
        badge_slug: 'challenge-nazgul-outrun',
      });
      expect(body.definition.description.length).toBeGreaterThan(0);

      expect(rollRow()).toEqual({ status: 'accepted', encounter_definition_id: definitionId });
      const participants = sqlite.prepare(
        'SELECT occurrence_id, progress_distance FROM event_participants WHERE user_id = ?',
      ).all(userId) as Array<{ occurrence_id: number; progress_distance: number }>;
      expect(participants).toEqual([
        { occurrence_id: body.occurrence.id, progress_distance: 0 },
      ]);
    });

    it('completes immediately when today\'s walk already meets the target', async () => {
      insertRoll(TODAY, 'offered', definitionId, 5);
      sqlite.prepare('INSERT INTO progress (date, distance, user_id) VALUES (?, ?, ?)')
        .run(TODAY, 8, userId);

      const response = await handleAcceptEncounter(
        jsonRequest(ACCEPT_URL, { encounter_definition_id: definitionId }),
        db,
        userId,
      );

      const body = await response.json() as { completed: boolean; occurrence: { status: string } };
      expect(body.completed).toBe(true);
      expect(body.occurrence.status).toBe('completed');
    });

    it('returns the same occurrence on a repeated accept', async () => {
      insertRoll(TODAY, 'offered', definitionId, 10);

      const first = await handleAcceptEncounter(
        jsonRequest(ACCEPT_URL, { encounter_definition_id: definitionId }),
        db,
        userId,
      );
      const second = await handleAcceptEncounter(
        jsonRequest(ACCEPT_URL, { encounter_definition_id: definitionId }),
        db,
        userId,
      );

      const firstBody = await first.json() as { occurrence: { id: number } };
      const secondBody = await second.json() as {
        alreadyAccepted: boolean;
        occurrence: { id: number };
      };
      expect(secondBody.alreadyAccepted).toBe(true);
      expect(secondBody.occurrence.id).toBe(firstBody.occurrence.id);
      const count = sqlite.prepare('SELECT COUNT(*) AS count FROM encounter_occurrences')
        .get() as { count: number };
      expect(count.count).toBe(1);
    });

    it('rejects invalid JSON bodies', async () => {
      const response = await handleAcceptEncounter(
        rawRequest(ACCEPT_URL, 'not json'),
        db,
        userId,
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid request body' });
    });

    it.each([null, [], 'text', 42])('rejects non-object body %p', async (body) => {
      const response = await handleAcceptEncounter(
        jsonRequest(ACCEPT_URL, body),
        db,
        userId,
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid request body' });
    });

    it.each([
      {},
      { encounter_definition_id: '1' },
      { encounter_definition_id: 0 },
      { encounter_definition_id: -1 },
      { encounter_definition_id: 1.5 },
      { encounter_definition_id: Number.MAX_SAFE_INTEGER + 1 },
    ])('rejects missing or invalid definition id %p', async (body) => {
      const response = await handleAcceptEncounter(
        jsonRequest(ACCEPT_URL, body),
        db,
        userId,
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'encounter_definition_id must be a positive integer',
      });
    });

    it('returns 404 when no roll exists for today', async () => {
      const response = await handleAcceptEncounter(
        jsonRequest(ACCEPT_URL, { encounter_definition_id: definitionId }),
        db,
        userId,
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'No encounter roll exists for today' });
    });

    it('returns 409 when the definition does not match the offer', async () => {
      insertRoll(TODAY, 'offered', definitionId, 5);

      const response = await handleAcceptEncounter(
        jsonRequest(ACCEPT_URL, { encounter_definition_id: definitionId + 1 }),
        db,
        userId,
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: 'The offered encounter does not match this definition',
      });
    });

    it('returns 409 when the offer was already declined', async () => {
      insertRoll(TODAY, 'declined', definitionId, 5);

      const response = await handleAcceptEncounter(
        jsonRequest(ACCEPT_URL, { encounter_definition_id: definitionId }),
        db,
        userId,
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: 'This encounter offer was already declined',
      });
    });

    it('maps domain validation errors to 400', async () => {
      const response = await handleAcceptEncounter(
        jsonRequest(ACCEPT_URL, { encounter_definition_id: definitionId }),
        badDb(),
        userId,
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid from domain' });
    });

    it('returns 500 and logs unknown errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      insertRoll(TODAY, 'offered', definitionId, 5);
      sqlite.exec('DROP TABLE event_participants');

      const response = await handleAcceptEncounter(
        jsonRequest(ACCEPT_URL, { encounter_definition_id: definitionId }),
        db,
        userId,
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal server error' });
      expect(consoleError).toHaveBeenCalledWith(
        'Error accepting daily encounter:',
        expect.anything(),
      );
    });
  });

  describe('handleDeclineEncounter', () => {
    const DECLINE_URL = 'http://localhost/api/events/daily-roll/decline';

    it('declines an offered encounter', async () => {
      insertRoll(TODAY, 'offered', definitionId, 5);

      const response = await handleDeclineEncounter(
        jsonRequest(DECLINE_URL, { encounter_definition_id: definitionId }),
        db,
        userId,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ declined: true, alreadyDeclined: false });
      expect(rollRow().status).toBe('declined');
    });

    it('accepts an empty body when no definition id is sent', async () => {
      insertRoll(TODAY, 'offered', definitionId, 5);

      const response = await handleDeclineEncounter(jsonRequest(DECLINE_URL, {}), db, userId);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ declined: true, alreadyDeclined: false });
    });

    it('accepts a request with no body at all', async () => {
      insertRoll(TODAY, 'offered', definitionId, 5);

      const response = await handleDeclineEncounter(
        new Request(DECLINE_URL, { method: 'POST' }),
        db,
        userId,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ declined: true, alreadyDeclined: false });
    });

    it('is idempotent after the first decline', async () => {
      insertRoll(TODAY, 'offered', definitionId, 5);

      await handleDeclineEncounter(
        jsonRequest(DECLINE_URL, { encounter_definition_id: definitionId }),
        db,
        userId,
      );
      const second = await handleDeclineEncounter(
        jsonRequest(DECLINE_URL, { encounter_definition_id: definitionId }),
        db,
        userId,
      );

      expect(await second.json()).toEqual({ declined: true, alreadyDeclined: true });
    });

    it('returns 409 after the offer was accepted', async () => {
      insertRoll(TODAY, 'offered', definitionId, 5);
      await handleAcceptEncounter(
        jsonRequest('http://localhost/api/events/daily-roll/accept', {
          encounter_definition_id: definitionId,
        }),
        db,
        userId,
      );

      const response = await handleDeclineEncounter(
        jsonRequest(DECLINE_URL, { encounter_definition_id: definitionId }),
        db,
        userId,
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: 'This encounter offer was already accepted',
      });
    });

    it('returns 404 when no roll exists for today', async () => {
      const response = await handleDeclineEncounter(jsonRequest(DECLINE_URL, {}), db, userId);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'No encounter roll exists for today' });
    });

    it('rejects invalid JSON bodies', async () => {
      const response = await handleDeclineEncounter(
        rawRequest(DECLINE_URL, 'not json'),
        db,
        userId,
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid request body' });
    });

    it.each([null, [], 'text'])('rejects non-object body %p', async (body) => {
      const response = await handleDeclineEncounter(
        jsonRequest(DECLINE_URL, body),
        db,
        userId,
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid request body' });
    });

    it.each([
      { encounter_definition_id: '1' },
      { encounter_definition_id: 0 },
      { encounter_definition_id: -2 },
      { encounter_definition_id: 2.5 },
    ])('rejects an invalid definition id %p', async (body) => {
      const response = await handleDeclineEncounter(
        jsonRequest(DECLINE_URL, body),
        db,
        userId,
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'encounter_definition_id must be a positive integer',
      });
    });

    it('maps domain validation errors to 400', async () => {
      const response = await handleDeclineEncounter(
        jsonRequest(DECLINE_URL, {}),
        badDb(),
        userId,
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid from domain' });
    });

    it('returns 500 and logs unknown errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      sqlite.exec('DROP TABLE daily_rolls');

      const response = await handleDeclineEncounter(jsonRequest(DECLINE_URL, {}), db, userId);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal server error' });
      expect(consoleError).toHaveBeenCalledWith(
        'Error declining daily encounter:',
        expect.anything(),
      );
    });
  });
});
