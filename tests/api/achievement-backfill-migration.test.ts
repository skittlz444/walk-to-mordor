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

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function applyBaseMigrations(sqlite: DatabaseSync): void {
  sqlite.exec(readMigration('0142_create_achievement_definitions.sql'));
  sqlite.exec(readMigration('0143_create_user_achievement_instances.sql'));
  sqlite.exec(readMigration('0144_seed_journey_badges.sql'));
}

function awardedSlugs(sqlite: DatabaseSync, userId: number): string[] {
  const rows = sqlite
    .prepare(
      `SELECT d.slug
       FROM user_achievement_instances i
       JOIN achievement_definitions d ON d.id = i.achievement_id
       WHERE i.user_id = ?
       ORDER BY d.slug`,
    )
    .all(userId) as Array<{ slug: string }>;
  return rows.map((row) => row.slug);
}

function awardCount(sqlite: DatabaseSync): number {
  const row = sqlite
    .prepare('SELECT COUNT(*) AS count FROM user_achievement_instances')
    .get() as { count: number };
  return Number(row.count);
}

describe('existing-progress achievement backfill migration', () => {
  let sqlite: DatabaseSync;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(MINIMAL_SCHEMA);
    applyBaseMigrations(sqlite);
    sqlite.exec("INSERT INTO storylines (id, slug) VALUES (1, 'frodo-sam')");
  });

  afterEach(() => {
    sqlite.close();
  });

  function seedUser(
    id: number,
    username: string,
    options: { distance?: number; offset?: number; storylineId?: number | null } = {},
  ): void {
    sqlite
      .prepare(
        `INSERT INTO users (id, username, active_storyline_id, storyline_distance_offset)
         VALUES (?, ?, ?, ?)`,
      )
      .run(id, username, options.storylineId ?? 1, options.offset ?? 0);

    if (options.distance !== undefined) {
      sqlite
        .prepare('INSERT INTO progress (user_id, date, distance) VALUES (?, ?, ?)')
        .run(id, '2026-11-02', options.distance);
    }
  }

  it('awards first-steps and every qualifying journey badge for existing distance', () => {
    seedUser(1, 'frodo', { distance: 1592.88 });

    sqlite.exec(readMigration('0148_backfill_existing_achievements.sql'));

    expect(awardedSlugs(sqlite, 1)).toEqual([
      'habit-first-steps',
      'journey-frodo-sam-buckleberry-ferry',
      'journey-frodo-sam-lothlorien-guest',
      'journey-frodo-sam-through-khazad-dum',
      'journey-frodo-sam-weathertop-survivor',
    ]);
  });

  it('applies the active storyline offset before comparing thresholds', () => {
    seedUser(1, 'frodo', { distance: 1100, offset: 200 });

    sqlite.exec(readMigration('0148_backfill_existing_achievements.sql'));

    const slugs = awardedSlugs(sqlite, 1);
    expect(slugs).toContain('journey-frodo-sam-through-khazad-dum');
    expect(slugs).not.toContain('journey-frodo-sam-lothlorien-guest');

    const row = sqlite
      .prepare(
        `SELECT context_metadata
         FROM user_achievement_instances i
         JOIN achievement_definitions d ON d.id = i.achievement_id
         WHERE i.user_id = 1 AND d.slug = 'journey-frodo-sam-through-khazad-dum'`,
      )
      .get() as { context_metadata: string };
    expect(JSON.parse(row.context_metadata)).toEqual({
      storyline: 'frodo-sam',
      distance_km: 1300,
    });
  });

  it('leaves users with no progress unawarded and gives progress-only users first-steps', () => {
    seedUser(1, 'no-progress');
    seedUser(2, 'short-walk', { distance: 50 });

    sqlite.exec(readMigration('0148_backfill_existing_achievements.sql'));

    expect(awardedSlugs(sqlite, 1)).toEqual([]);
    expect(awardedSlugs(sqlite, 2)).toEqual(['habit-first-steps']);
  });

  it('is idempotent when applied twice', () => {
    seedUser(1, 'frodo', { distance: 1592.88 });

    sqlite.exec(readMigration('0148_backfill_existing_achievements.sql'));
    const countAfterFirst = awardCount(sqlite);
    sqlite.exec(readMigration('0148_backfill_existing_achievements.sql'));

    expect(awardCount(sqlite)).toBe(countAfterFirst);
    expect(awardedSlugs(sqlite, 1)).toHaveLength(5);
  });

  it('does not duplicate an award that already exists under another key', () => {
    seedUser(1, 'frodo', { distance: 1592.88 });
    sqlite.exec(
      `INSERT INTO user_achievement_instances (user_id, achievement_id, idempotency_key)
       SELECT 1, id, 'legacy-first-steps-key'
       FROM achievement_definitions WHERE slug = 'habit-first-steps'`,
    );

    sqlite.exec(readMigration('0148_backfill_existing_achievements.sql'));

    expect(awardedSlugs(sqlite, 1).filter((slug) => slug === 'habit-first-steps')).toHaveLength(1);
  });
});
