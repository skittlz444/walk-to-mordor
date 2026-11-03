import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

const MINIMAL_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT UNIQUE,
  active_storyline_id INTEGER,
  storyline_distance_offset REAL NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE storylines (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  admin_only INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  user_id INTEGER,
  date DATE,
  distance REAL NOT NULL
);
`;

const SENTINEL = '__non_repeatable__';

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

interface InstanceRow {
  id: number;
  idempotency_key: string;
}

function instances(sqlite: DatabaseSync, userId: number, slug: string): InstanceRow[] {
  return sqlite
    .prepare(
      `SELECT i.id, i.idempotency_key
       FROM user_achievement_instances i
       JOIN achievement_definitions d ON d.id = i.achievement_id
       WHERE i.user_id = ? AND d.slug = ?
       ORDER BY i.id ASC`,
    )
    .all(userId, slug) as InstanceRow[];
}

function isAcknowledged(sqlite: DatabaseSync, userId: number, instanceId: number): boolean {
  const row = sqlite
    .prepare(
      `SELECT 1 AS present FROM user_achievement_acknowledgements
       WHERE user_id = ? AND instance_id = ?`,
    )
    .get(userId, instanceId);
  return row != null;
}

function definitionId(sqlite: DatabaseSync, slug: string): number {
  const row = sqlite
    .prepare('SELECT id FROM achievement_definitions WHERE slug = ?')
    .get(slug) as { id: number };
  return Number(row.id);
}

describe('non-repeatable duplicate correction migration (0151)', () => {
  let sqlite: DatabaseSync;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(MINIMAL_SCHEMA);
    sqlite.exec(readMigration('0142_create_achievement_definitions.sql'));
    sqlite.exec(readMigration('0143_create_user_achievement_instances.sql'));
    sqlite.exec(readMigration('0144_seed_journey_badges.sql'));
    sqlite.exec(readMigration('0145_seed_catalog_expansion.sql'));
    sqlite.exec(readMigration('0147_create_user_achievement_acknowledgements.sql'));
    sqlite.exec("INSERT INTO storylines (id, slug) VALUES (1, 'frodo-sam')");

    sqlite
      .prepare(
        `INSERT INTO users (id, username, active_storyline_id, storyline_distance_offset)
         VALUES (1, 'frodo', 1, 0)`,
      )
      .run();
    sqlite
      .prepare('INSERT INTO progress (user_id, date, distance) VALUES (1, ?, ?)')
      .run('2026-11-02', 1592.88);

    // Real backfill: writes 'habit-first-steps' and 'journey:<slug>' keys.
    sqlite.exec(readMigration('0148_backfill_existing_achievements.sql'));
  });

  afterEach(() => {
    sqlite.close();
  });

  /**
   * Reproduce the live corruption: the runtime award stores non-repeatables under
   * the sentinel, so the backfilled row did not stop a second insert.
   */
  function seedRuntimeDuplicate(userId: number, slug: string): number {
    const result = sqlite
      .prepare(
        `INSERT INTO user_achievement_instances (user_id, achievement_id, idempotency_key)
         VALUES (?, ?, ?)`,
      )
      .run(userId, definitionId(sqlite, slug), SENTINEL);
    return Number(result.lastInsertRowid);
  }

  it('keeps the earliest instance per non-repeatable badge and re-keys it to the sentinel', () => {
    const firstStepsId = instances(sqlite, 1, 'habit-first-steps')[0].id;
    const ferryId = instances(sqlite, 1, 'journey-frodo-sam-buckleberry-ferry')[0].id;
    const firstStepsDuplicateId = seedRuntimeDuplicate(1, 'habit-first-steps');
    const ferryDuplicateId = seedRuntimeDuplicate(1, 'journey-frodo-sam-buckleberry-ferry');

    expect(instances(sqlite, 1, 'habit-first-steps')).toHaveLength(2);
    expect(instances(sqlite, 1, 'journey-frodo-sam-buckleberry-ferry')).toHaveLength(2);

    sqlite.exec(readMigration('0151_dedupe_non_repeatable_achievements.sql'));

    expect(instances(sqlite, 1, 'habit-first-steps')).toEqual([
      { id: firstStepsId, idempotency_key: SENTINEL },
    ]);
    expect(instances(sqlite, 1, 'journey-frodo-sam-buckleberry-ferry')).toEqual([
      { id: ferryId, idempotency_key: SENTINEL },
    ]);
    expect(instances(sqlite, 1, 'habit-first-steps')[0].id).not.toBe(firstStepsDuplicateId);
    expect(instances(sqlite, 1, 'journey-frodo-sam-buckleberry-ferry')[0].id).not.toBe(ferryDuplicateId);
  });

  it('carries an acknowledgement on a removed duplicate over to the survivor', () => {
    const survivorId = instances(sqlite, 1, 'journey-frodo-sam-lothlorien-guest')[0].id;
    const duplicateId = seedRuntimeDuplicate(1, 'journey-frodo-sam-lothlorien-guest');
    sqlite
      .prepare('INSERT INTO user_achievement_acknowledgements (user_id, instance_id) VALUES (1, ?)')
      .run(duplicateId);

    sqlite.exec(readMigration('0151_dedupe_non_repeatable_achievements.sql'));

    expect(instances(sqlite, 1, 'journey-frodo-sam-lothlorien-guest')).toEqual([
      { id: survivorId, idempotency_key: SENTINEL },
    ]);
    expect(isAcknowledged(sqlite, 1, survivorId)).toBe(true);
    // The deleted duplicate's acknowledgement cascaded away.
    expect(isAcknowledged(sqlite, 1, duplicateId)).toBe(false);
  });

  it('does not invent acknowledgements for groups that had none', () => {
    const survivorId = instances(sqlite, 1, 'habit-first-steps')[0].id;
    seedRuntimeDuplicate(1, 'habit-first-steps');

    sqlite.exec(readMigration('0151_dedupe_non_repeatable_achievements.sql'));

    expect(isAcknowledged(sqlite, 1, survivorId)).toBe(false);
  });

  it('leaves repeatable badges and their multiple rows untouched', () => {
    for (const key of ['habit-faithful-walker:2026-01-04', 'habit-faithful-walker:2026-01-11']) {
      sqlite
        .prepare(
          `INSERT INTO user_achievement_instances (user_id, achievement_id, idempotency_key)
           SELECT 1, id, ? FROM achievement_definitions WHERE slug = 'habit-faithful-walker'`,
        )
        .run(key);
    }
    const repeatableBefore = instances(sqlite, 1, 'habit-faithful-walker');
    expect(repeatableBefore).toHaveLength(2);

    sqlite.exec(readMigration('0151_dedupe_non_repeatable_achievements.sql'));

    expect(instances(sqlite, 1, 'habit-faithful-walker')).toEqual(repeatableBefore);
  });

  it('is a no-op when applied a second time', () => {
    seedRuntimeDuplicate(1, 'habit-first-steps');
    seedRuntimeDuplicate(1, 'journey-frodo-sam-buckleberry-ferry');
    sqlite.exec(readMigration('0151_dedupe_non_repeatable_achievements.sql'));

    const snapshot = () =>
      sqlite
        .prepare('SELECT id, user_id, achievement_id, idempotency_key FROM user_achievement_instances ORDER BY id')
        .all();
    const acknowledgements = () =>
      sqlite
        .prepare('SELECT user_id, instance_id FROM user_achievement_acknowledgements ORDER BY instance_id')
        .all();
    const before = snapshot();
    const acknowledgementsBefore = acknowledgements();

    expect(() => sqlite.exec(readMigration('0151_dedupe_non_repeatable_achievements.sql'))).not.toThrow();

    expect(snapshot()).toEqual(before);
    expect(acknowledgements()).toEqual(acknowledgementsBefore);
  });
});
