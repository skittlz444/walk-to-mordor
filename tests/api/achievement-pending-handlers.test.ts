import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import { handleGetPendingAchievements } from '../../src/achievement-handlers';
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
  };

  return {
    read: connection as unknown as D1Database,
    write: connection as unknown as D1Database,
  };
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

interface PendingBody {
  pending: Array<Record<string, unknown> & { presentation: Record<string, unknown> }>;
}

describe('handleGetPendingAchievements', () => {
  let sqlite: DatabaseSync;
  let db: DbClient;
  let userId: number;
  let otherUserId: number;

  function insertUser(username: string): number {
    const result = sqlite
      .prepare('INSERT INTO users (username) VALUES (?)')
      .run(username);
    return Number(result.lastInsertRowid);
  }

  function insertDefinition(options: {
    slug: string;
    name?: string;
    description?: string | null;
    imageSlug?: string | null;
    badgeType?: string;
    isRepeatable?: boolean;
    metadata?: string | null;
  }): number {
    const result = sqlite
      .prepare(
        `INSERT INTO achievement_definitions
           (slug, name, description, image_slug, badge_type, is_repeatable, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        options.slug,
        options.name ?? options.slug,
        options.description ?? null,
        options.imageSlug ?? options.slug,
        options.badgeType ?? 'habit',
        options.isRepeatable ? 1 : 0,
        options.metadata ?? null,
      );
    return Number(result.lastInsertRowid);
  }

  function insertInstance(
    user: number,
    achievementId: number,
    earnedAt: string,
    key: string,
  ): number {
    const result = sqlite
      .prepare(
        `INSERT INTO user_achievement_instances
           (user_id, achievement_id, earned_at, idempotency_key)
         VALUES (?, ?, ?, ?)`,
      )
      .run(user, achievementId, earnedAt, key);
    return Number(result.lastInsertRowid);
  }

  function acknowledge(user: number, instanceId: number): void {
    sqlite
      .prepare(
        `INSERT INTO user_achievement_acknowledgements (user_id, instance_id)
         VALUES (?, ?)`,
      )
      .run(user, instanceId);
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  function request(path = '/api/achievements/pending'): Request {
    return new Request(`http://localhost${path}`);
  }

  it('returns pending entries with the documented shape and resolved presentation', async () => {
    const definitionId = insertDefinition({
      slug: 'journey-frodo-sam-buckleberry-ferry',
      name: 'Across the Buckleberry Ferry',
      description: 'The first step out of the Shire.',
      imageSlug: 'journey-frodo-sam-buckleberry-ferry',
      badgeType: 'journey',
      isRepeatable: false,
      metadata:
        '{"rank":1,"storyline":"frodo-sam","collection":{"slug":"frodo-sam-journey","label":"The Road to Mordor","index":1,"size":8}}',
    });
    const instanceId = insertInstance(
      userId,
      definitionId,
      '2026-01-02 03:04:05',
      'buckleberry-ferry',
    );

    const response = await handleGetPendingAchievements(request(), db, userId);

    expect(response.status).toBe(200);
    const body = await response.json() as PendingBody;
    expect(body.pending).toHaveLength(1);
    expect(body.pending[0]).toEqual({
      instance_id: instanceId,
      earned_at: '2026-01-02T03:04:05Z',
      earned_count: 1,
      slug: 'journey-frodo-sam-buckleberry-ferry',
      name: 'Across the Buckleberry Ferry',
      description: 'The first step out of the Shire.',
      image_slug: 'journey-frodo-sam-buckleberry-ferry',
      badge_type: 'journey',
      is_repeatable: false,
      presentation: {
        rank: 1,
        rank_label: 'bronze',
        storyline: 'frodo-sam',
        collection: {
          slug: 'frodo-sam-journey',
          label: 'The Road to Mordor',
          index: 1,
          size: 8,
        },
      },
    });
    expect(typeof body.pending[0].is_repeatable).toBe('boolean');
    expect(body.pending[0]).not.toHaveProperty('metadata');
    expect(body.pending[0]).not.toHaveProperty('achievement_id');
    expect(body.pending[0]).not.toHaveProperty('awarding_ordinal');
  });

  it('excludes acknowledged instances', async () => {
    const acknowledgedDefinition = insertDefinition({ slug: 'habit-first-steps' });
    const pendingDefinition = insertDefinition({ slug: 'habit-faithful-walker' });
    const acknowledgedInstance = insertInstance(
      userId,
      acknowledgedDefinition,
      '2026-01-01 00:00:00',
      'a',
    );
    const pendingInstance = insertInstance(
      userId,
      pendingDefinition,
      '2026-01-02 00:00:00',
      'b',
    );
    acknowledge(userId, acknowledgedInstance);

    const response = await handleGetPendingAchievements(request(), db, userId);

    const body = await response.json() as PendingBody;
    expect(body.pending.map((entry) => entry.instance_id)).toEqual([pendingInstance]);
  });

  it('excludes instances earned by another user', async () => {
    const definitionId = insertDefinition({ slug: 'habit-first-steps' });
    const ownInstance = insertInstance(userId, definitionId, '2026-01-01 00:00:00', 'own');
    insertInstance(otherUserId, definitionId, '2026-01-02 00:00:00', 'other');

    const response = await handleGetPendingAchievements(request(), db, userId);

    const body = await response.json() as PendingBody;
    expect(body.pending.map((entry) => entry.instance_id)).toEqual([ownInstance]);
  });

  it('returns an empty pending array when nothing is outstanding', async () => {
    const definitionId = insertDefinition({ slug: 'habit-first-steps' });
    const instanceId = insertInstance(userId, definitionId, '2026-01-01 00:00:00', 'a');
    acknowledge(userId, instanceId);

    const response = await handleGetPendingAchievements(request(), db, userId);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pending: [] });
  });

  it('orders pending awards oldest-earned first, then by instance id', async () => {
    const older = insertDefinition({ slug: 'older' });
    const newer = insertDefinition({ slug: 'newer' });
    const newerInstance = insertInstance(userId, newer, '2026-02-01 00:00:00', 'newer');
    const tieA = insertInstance(userId, older, '2026-01-01 00:00:00', 'tie-a');
    const tieB = insertInstance(userId, older, '2026-01-01 00:00:00', 'tie-b');

    const response = await handleGetPendingAchievements(request(), db, userId);

    const body = await response.json() as PendingBody;
    expect(body.pending.map((entry) => entry.instance_id)).toEqual([
      tieA,
      tieB,
      newerInstance,
    ]);
  });

  it('resolves each instance rank from its awarding ordinal across thresholds', async () => {
    const definitionId = insertDefinition({
      slug: 'habit-faithful-walker',
      name: 'Faithful Walker',
      badgeType: 'habit',
      isRepeatable: true,
      metadata: '{"rank_thresholds":[1,4,12,26]}',
    });
    const instanceIds = [1, 2, 3, 4].map((ordinal) =>
      insertInstance(userId, definitionId, '2026-01-01 00:00:00', `week-${ordinal}`),
    );

    const response = await handleGetPendingAchievements(request(), db, userId);

    const body = await response.json() as PendingBody;
    expect(body.pending.map((entry) => entry.instance_id)).toEqual(instanceIds);
    expect(body.pending.map((entry) => entry.earned_count)).toEqual([4, 4, 4, 4]);
    expect(body.pending.map((entry) => entry.presentation.rank_label)).toEqual([
      'bronze',
      'bronze',
      'bronze',
      'silver',
    ]);
    expect(body.pending.every((entry) => entry.is_repeatable === true)).toBe(true);
  });

  it('derives the awarding ordinal from earned time, not insertion order', async () => {
    const definitionId = insertDefinition({
      slug: 'habit-faithful-walker',
      name: 'Faithful Walker',
      badgeType: 'habit',
      isRepeatable: true,
      metadata: '{"rank_thresholds":[1,4,12,26]}',
    });
    const second = insertInstance(userId, definitionId, '2026-01-02 00:00:00', 't2');
    const fourth = insertInstance(userId, definitionId, '2026-01-04 00:00:00', 't4');
    const first = insertInstance(userId, definitionId, '2026-01-01 00:00:00', 't1');
    const third = insertInstance(userId, definitionId, '2026-01-03 00:00:00', 't3');

    const response = await handleGetPendingAchievements(request(), db, userId);

    const body = await response.json() as PendingBody;
    expect(body.pending.map((entry) => entry.instance_id)).toEqual([
      first,
      second,
      third,
      fourth,
    ]);
    expect(body.pending.map((entry) => entry.presentation.rank_label)).toEqual([
      'bronze',
      'bronze',
      'bronze',
      'silver',
    ]);
  });

  it('counts acknowledged siblings when deriving the awarding ordinal', async () => {
    const definitionId = insertDefinition({
      slug: 'habit-faithful-walker',
      name: 'Faithful Walker',
      badgeType: 'habit',
      isRepeatable: true,
      metadata: '{"rank_thresholds":[1,4,12,26]}',
    });
    const instanceIds = [1, 2, 3, 4].map((ordinal) =>
      insertInstance(userId, definitionId, `2026-01-0${ordinal} 00:00:00`, `week-${ordinal}`),
    );
    acknowledge(userId, instanceIds[0]);
    acknowledge(userId, instanceIds[1]);
    acknowledge(userId, instanceIds[2]);

    const response = await handleGetPendingAchievements(request(), db, userId);

    const body = await response.json() as PendingBody;
    expect(body.pending.map((entry) => entry.instance_id)).toEqual([instanceIds[3]]);
    expect(body.pending[0].presentation.rank_label).toBe('silver');
  });

  it('normalizes SQLite CURRENT_TIMESTAMP values to ISO 8601', async () => {
    const definitionId = insertDefinition({ slug: 'default-time' });
    sqlite
      .prepare(
        `INSERT INTO user_achievement_instances (user_id, achievement_id, idempotency_key)
         VALUES (?, ?, 'default-time')`,
      )
      .run(userId, definitionId);

    const response = await handleGetPendingAchievements(request(), db, userId);

    const body = await response.json() as PendingBody;
    expect(body.pending[0].earned_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('falls back safely when the definition metadata is malformed', async () => {
    const definitionId = insertDefinition({
      slug: 'broken-metadata',
      metadata: '{not valid json',
    });
    insertInstance(userId, definitionId, '2026-01-01 00:00:00', 'broken');

    const response = await handleGetPendingAchievements(request(), db, userId);

    const body = await response.json() as PendingBody;
    expect(body.pending[0].presentation).toEqual({
      rank: 1,
      rank_label: 'bronze',
      storyline: null,
      collection: null,
    });
  });

  it('falls back safely when the definition metadata is out of range', async () => {
    const definitionId = insertDefinition({
      slug: 'out-of-range-metadata',
      metadata:
        '{"rank":9,"storyline":"","collection":{"slug":"x","label":"X","index":9,"size":2}}',
    });
    insertInstance(userId, definitionId, '2026-01-01 00:00:00', 'out-of-range');

    const response = await handleGetPendingAchievements(request(), db, userId);

    const body = await response.json() as PendingBody;
    expect(body.pending[0].presentation).toEqual({
      rank: 1,
      rank_label: 'bronze',
      storyline: null,
      collection: null,
    });
  });

  it('returns 500 and logs when the pending query fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    sqlite.exec('DROP TABLE user_achievement_acknowledgements');

    const response = await handleGetPendingAchievements(request(), db, userId);

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalled();
  });
});
