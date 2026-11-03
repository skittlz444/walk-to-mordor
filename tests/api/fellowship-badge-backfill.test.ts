import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

const NON_REPEATABLE_KEY = '__non_repeatable__';

const MINIMAL_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT UNIQUE
);
`;

interface AwardRow {
  user_id: number;
  slug: string;
  context_metadata: string | null;
  idempotency_key: string;
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function applyBaseMigrations(sqlite: DatabaseSync): void {
  sqlite.exec(readMigration('0142_create_achievement_definitions.sql'));
  sqlite.exec(readMigration('0143_create_user_achievement_instances.sql'));
  sqlite.exec(readMigration('0145_seed_catalog_expansion.sql'));
  sqlite.exec(readMigration('0119_create_fellowship_tables.sql'));
}

function awards(sqlite: DatabaseSync): AwardRow[] {
  return sqlite
    .prepare(
      `SELECT i.user_id, d.slug, i.context_metadata, i.idempotency_key
       FROM user_achievement_instances i
       JOIN achievement_definitions d ON d.id = i.achievement_id
       ORDER BY i.user_id, d.slug`,
    )
    .all() as unknown as AwardRow[];
}

function awardedSlugs(sqlite: DatabaseSync, userId: number): string[] {
  return awards(sqlite)
    .filter((award) => Number(award.user_id) === userId)
    .map((award) => award.slug);
}

function seedUser(sqlite: DatabaseSync, id: number, username: string): void {
  sqlite.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run(id, username);
}

function seedFellowship(
  sqlite: DatabaseSync,
  id: number,
  leaderId: number,
  options: { dissolved?: boolean } = {},
): void {
  sqlite
    .prepare(
      `INSERT INTO parties (id, name, leader_id, invite_code, dissolved_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      `fellowship-${id}`,
      leaderId,
      `invite-${id}`,
      options.dissolved ? '2026-11-01 00:00:00' : null,
    );
}

function seedMember(
  sqlite: DatabaseSync,
  partyId: number,
  userId: number,
  options: { status?: 'active' | 'left' | 'kicked'; role?: 'leader' | 'member' } = {},
): void {
  sqlite
    .prepare('INSERT INTO party_members (party_id, user_id, role, status) VALUES (?, ?, ?, ?)')
    .run(partyId, userId, options.role ?? 'member', options.status ?? 'active');
}

describe('fellowship badge backfill migration (0150)', () => {
  let sqlite: DatabaseSync;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(MINIMAL_SCHEMA);
    applyBaseMigrations(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it('awards the founder badge to the leader of a non-dissolved fellowship', () => {
    seedUser(sqlite, 1, 'frodo');
    seedFellowship(sqlite, 1, 1);
    seedMember(sqlite, 1, 1, { role: 'leader' });

    sqlite.exec(readMigration('0150_backfill_fellowship_badges.sql'));

    expect(awardedSlugs(sqlite, 1)).toEqual(['community-fellowship-founder']);
    const [founder] = awards(sqlite);
    expect(JSON.parse(founder.context_metadata as string)).toEqual({ party_id: 1 });
  });

  it('awards Good Company to all four active members of a qualifying fellowship', () => {
    for (const id of [1, 2, 3, 4]) seedUser(sqlite, id, `member-${id}`);
    seedFellowship(sqlite, 1, 1);
    seedMember(sqlite, 1, 1, { role: 'leader' });
    for (const id of [2, 3, 4]) seedMember(sqlite, 1, id);

    sqlite.exec(readMigration('0150_backfill_fellowship_badges.sql'));

    expect(awardedSlugs(sqlite, 1)).toEqual([
      'community-fellowship-founder',
      'community-good-company',
    ]);
    for (const id of [2, 3, 4]) {
      expect(awardedSlugs(sqlite, id)).toEqual(['community-good-company']);
    }
  });

  it('does not award Good Company to a fellowship with only three active members', () => {
    for (const id of [1, 2, 3]) seedUser(sqlite, id, `member-${id}`);
    seedFellowship(sqlite, 1, 1);
    seedMember(sqlite, 1, 1, { role: 'leader' });
    for (const id of [2, 3]) seedMember(sqlite, 1, id);

    sqlite.exec(readMigration('0150_backfill_fellowship_badges.sql'));

    expect(awardedSlugs(sqlite, 1)).toEqual(['community-fellowship-founder']);
    expect(awards(sqlite).filter((award) => award.slug === 'community-good-company')).toHaveLength(
      0,
    );
  });

  it('awards nothing for a dissolved fellowship', () => {
    for (const id of [1, 2, 3, 4]) seedUser(sqlite, id, `member-${id}`);
    seedFellowship(sqlite, 1, 1, { dissolved: true });
    seedMember(sqlite, 1, 1, { role: 'leader' });
    for (const id of [2, 3, 4]) seedMember(sqlite, 1, id);

    sqlite.exec(readMigration('0150_backfill_fellowship_badges.sql'));

    expect(awards(sqlite)).toEqual([]);
  });

  it('excludes non-active members from Good Company and from the active-member count', () => {
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) seedUser(sqlite, id, `member-${id}`);

    // Four active members qualify; the departed members receive nothing.
    seedFellowship(sqlite, 1, 1);
    seedMember(sqlite, 1, 1, { role: 'leader' });
    for (const id of [2, 3, 4]) seedMember(sqlite, 1, id);
    seedMember(sqlite, 1, 5, { status: 'left' });
    seedMember(sqlite, 1, 6, { status: 'kicked' });

    // Two active plus two departed members do not reach the threshold.
    seedFellowship(sqlite, 2, 7);
    seedMember(sqlite, 2, 7, { role: 'leader' });
    seedMember(sqlite, 2, 8);
    seedMember(sqlite, 2, 5, { status: 'left' });
    seedMember(sqlite, 2, 6, { status: 'kicked' });

    sqlite.exec(readMigration('0150_backfill_fellowship_badges.sql'));

    for (const id of [1, 2, 3, 4]) {
      expect(awardedSlugs(sqlite, id)).toContain('community-good-company');
    }
    for (const id of [5, 6, 8]) {
      expect(awardedSlugs(sqlite, id)).toEqual([]);
    }
    expect(awardedSlugs(sqlite, 7)).toEqual(['community-fellowship-founder']);
  });

  it('is idempotent and stores every award under the non-repeatable sentinel', () => {
    for (const id of [1, 2, 3, 4]) seedUser(sqlite, id, `member-${id}`);
    seedFellowship(sqlite, 1, 1);
    seedMember(sqlite, 1, 1, { role: 'leader' });
    for (const id of [2, 3, 4]) seedMember(sqlite, 1, id);

    const migration = readMigration('0150_backfill_fellowship_badges.sql');
    sqlite.exec(migration);
    const first = awards(sqlite);
    expect(first).toHaveLength(5);

    expect(() => sqlite.exec(migration)).not.toThrow();

    expect(awards(sqlite)).toEqual(first);
    expect(first.every((award) => award.idempotency_key === NON_REPEATABLE_KEY)).toBe(true);
  });
});
