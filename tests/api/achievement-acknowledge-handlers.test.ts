import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import { handleAcknowledgeAchievements } from '../../src/achievement-handlers';
import type { DbClient } from '../../src/db';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

const MINIMAL_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT UNIQUE
);
`;

type SqlValue = string | number | null;

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
    async batch(statements: Array<{ run(): Promise<{ meta: { changes: number } }> }>) {
      return Promise.all(statements.map((statement) => statement.run()));
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

interface AcknowledgeBody {
  acknowledged: number;
}

describe('handleAcknowledgeAchievements', () => {
  let sqlite: DatabaseSync;
  let db: DbClient;
  let userId: number;
  let otherUserId: number;
  let definitionId: number;

  function insertUser(username: string): number {
    const result = sqlite
      .prepare('INSERT INTO users (username) VALUES (?)')
      .run(username);
    return Number(result.lastInsertRowid);
  }

  function insertInstance(
    user: number,
    earnedAt: string,
    key: string,
  ): number {
    const result = sqlite
      .prepare(
        `INSERT INTO user_achievement_instances
           (user_id, achievement_id, earned_at, idempotency_key)
         VALUES (?, ?, ?, ?)`,
      )
      .run(user, definitionId, earnedAt, key);
    return Number(result.lastInsertRowid);
  }

  function acknowledgementRows(): Array<{ user_id: number; instance_id: number }> {
    return sqlite
      .prepare(
        'SELECT user_id, instance_id FROM user_achievement_acknowledgements ORDER BY user_id, instance_id',
      )
      .all() as Array<{ user_id: number; instance_id: number }>;
  }

  function instanceRows(): Array<Record<string, unknown>> {
    return sqlite
      .prepare('SELECT * FROM user_achievement_instances ORDER BY id')
      .all() as Array<Record<string, unknown>>;
  }

  function request(body: unknown): Request {
    return new Request('http://localhost/api/achievements/acknowledge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(MINIMAL_SCHEMA);
    sqlite.exec(readMigration('0142_create_achievement_definitions.sql'));
    sqlite.exec(readMigration('0143_create_user_achievement_instances.sql'));
    sqlite.exec(readMigration('0147_create_user_achievement_acknowledgements.sql'));

    db = createDbClient(sqlite);
    userId = insertUser('frodo');
    otherUserId = insertUser('sam');

    const definition = sqlite
      .prepare(
        `INSERT INTO achievement_definitions (slug, name, badge_type)
         VALUES ('habit-first-steps', 'First Steps', 'habit')`,
      )
      .run();
    definitionId = Number(definition.lastInsertRowid);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  it('acknowledges owned instances and reports the inserted count', async () => {
    const first = insertInstance(userId, '2026-01-01 00:00:00', 'a');
    const second = insertInstance(userId, '2026-01-02 00:00:00', 'b');

    const response = await handleAcknowledgeAchievements(
      request({ instance_ids: [first, second] }),
      db,
      userId,
    );

    expect(response.status).toBe(200);
    const body = await response.json() as AcknowledgeBody;
    expect(body).toEqual({ acknowledged: 2 });
    expect(acknowledgementRows()).toEqual([
      { user_id: userId, instance_id: first },
      { user_id: userId, instance_id: second },
    ]);
  });

  it('is idempotent when the same instance is acknowledged again', async () => {
    const instanceId = insertInstance(userId, '2026-01-01 00:00:00', 'a');

    const first = await handleAcknowledgeAchievements(
      request({ instance_ids: [instanceId] }),
      db,
      userId,
    );
    const second = await handleAcknowledgeAchievements(
      request({ instance_ids: [instanceId] }),
      db,
      userId,
    );

    expect(await first.json()).toEqual({ acknowledged: 1 });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ acknowledged: 0 });
    expect(acknowledgementRows()).toHaveLength(1);
  });

  it('counts a duplicate ID in one request only once', async () => {
    const instanceId = insertInstance(userId, '2026-01-01 00:00:00', 'a');

    const response = await handleAcknowledgeAchievements(
      request({ instance_ids: [instanceId, instanceId] }),
      db,
      userId,
    );

    expect(await response.json()).toEqual({ acknowledged: 1 });
    expect(acknowledgementRows()).toHaveLength(1);
  });

  it('ignores instances owned by another user', async () => {
    const own = insertInstance(userId, '2026-01-01 00:00:00', 'own');
    const foreign = insertInstance(otherUserId, '2026-01-02 00:00:00', 'foreign');

    const response = await handleAcknowledgeAchievements(
      request({ instance_ids: [own, foreign] }),
      db,
      userId,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ acknowledged: 1 });
    expect(acknowledgementRows()).toEqual([{ user_id: userId, instance_id: own }]);
  });

  it('ignores stale instance IDs that do not exist', async () => {
    insertInstance(userId, '2026-01-01 00:00:00', 'a');

    const response = await handleAcknowledgeAchievements(
      request({ instance_ids: [999999] }),
      db,
      userId,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ acknowledged: 0 });
    expect(acknowledgementRows()).toEqual([]);
  });

  it('never mutates the earned instance rows', async () => {
    const instanceId = insertInstance(userId, '2026-01-01 00:00:00', 'a');
    const before = instanceRows();

    await handleAcknowledgeAchievements(
      request({ instance_ids: [instanceId] }),
      db,
      userId,
    );

    expect(instanceRows()).toEqual(before);
  });

  it.each([
    ['malformed JSON', '{not valid json'],
    ['a non-object body', '[]'],
    ['a null body', 'null'],
    ['a missing instance_ids', '{}'],
    ['a non-array instance_ids', { instance_ids: '1' }],
    ['an empty instance_ids', { instance_ids: [] }],
    ['a float instance ID', { instance_ids: [1.5] }],
    ['a string instance ID', { instance_ids: ['1'] }],
    ['a zero instance ID', { instance_ids: [0] }],
    ['a negative instance ID', { instance_ids: [-1] }],
    ['a null instance ID', { instance_ids: [null] }],
    ['an unsafe instance ID', { instance_ids: [Number.MAX_SAFE_INTEGER + 1] }],
    ['a mixed valid/invalid array', { instance_ids: [1, '2'] }],
  ])('returns 400 for %s', async (_label, body) => {
    const instanceId = insertInstance(userId, '2026-01-01 00:00:00', 'a');

    const response = await handleAcknowledgeAchievements(
      request(body),
      db,
      userId,
    );

    expect(response.status).toBe(400);
    expect(acknowledgementRows()).toEqual([]);
    expect(sqlite
      .prepare('SELECT COUNT(*) AS count FROM user_achievement_instances WHERE id = ?')
      .get(instanceId) as { count: number }).toEqual({ count: 1 });
  });

  it('rejects more than the maximum number of IDs in one request', async () => {
    const response = await handleAcknowledgeAchievements(
      request({ instance_ids: Array.from({ length: 101 }, (_, index) => index + 1) }),
      db,
      userId,
    );

    expect(response.status).toBe(400);
    expect(acknowledgementRows()).toEqual([]);
  });

  it('returns 500 and logs when the acknowledgement write fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const instanceId = insertInstance(userId, '2026-01-01 00:00:00', 'a');
    sqlite.exec('DROP TABLE user_achievement_acknowledgements');

    const response = await handleAcknowledgeAchievements(
      request({ instance_ids: [instanceId] }),
      db,
      userId,
    );

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalled();
  });
});
