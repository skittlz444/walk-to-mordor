import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import type { DbClient } from '../../src/db';
import {
  handleAdminEncountersList,
  handleAdminEncounterGet,
  handleAdminEncounterCreate,
  handleAdminEncounterUpdate,
  handleAdminEncounterEnable,
  handleAdminEncounterDisable,
} from '../../src/encounter-admin-handlers';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

interface FakeMeta {
  changes: number;
  last_row_id: number;
}

class SqliteStatement {
  // The node:sqlite statement API is structurally close to D1's prepare/bind
  // surface but not typed as D1, so keep the wrapper intentionally untyped.
  private readonly statement: any;
  private readonly params: unknown[];
  private readonly failWith: (() => Error) | null;

  constructor(
    statement: any,
    params: unknown[] = [],
    failWith: (() => Error) | null = null,
  ) {
    this.statement = statement;
    this.params = params;
    this.failWith = failWith;
  }

  bind(...params: unknown[]): SqliteStatement {
    return new SqliteStatement(this.statement, params, this.failWith);
  }

  async first<T>(): Promise<T | null> {
    const row = this.statement.get(...(this.params as never[]));
    return (row ?? null) as T | null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.statement.all(...(this.params as never[])) as T[] };
  }

  async run(): Promise<{ success: true; meta: FakeMeta }> {
    if (this.failWith) throw this.failWith();

    const result = this.statement.run(...(this.params as never[]));
    return {
      success: true,
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }
}

class SqliteD1 {
  private failFragment: string | null = null;
  private failMessage = 'Injected failure';

  constructor(private readonly sqlite: DatabaseSync) {}

  /** Make statements whose SQL contains `sqlFragment` throw on run. */
  failOn(sqlFragment: string, message = `Injected failure for ${sqlFragment}`): void {
    this.failFragment = sqlFragment;
    this.failMessage = message;
  }

  prepare(sql: string): SqliteStatement {
    const failWith = this.failFragment && sql.includes(this.failFragment)
      ? () => new Error(this.failMessage)
      : null;
    return new SqliteStatement(this.sqlite.prepare(sql), [], failWith);
  }

  /**
   * D1 batch semantics: statements run sequentially inside one transaction and
   * any failure rolls the whole batch back.
   */
  async batch(statements: SqliteStatement[]): Promise<Array<{ success: true; meta: FakeMeta }>> {
    this.sqlite.exec('BEGIN');
    try {
      const results: Array<{ success: true; meta: FakeMeta }> = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error: unknown) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}

interface AuditRow {
  id: number;
  admin_user_id: number;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: string | null;
  ip_address: string | null;
  success: number;
}

interface DefinitionSeed {
  slug?: string;
  name?: string;
  description?: string;
  image_slug?: string | null;
  badge_slug?: string | null;
  duration_days?: number;
  target_stretch_multiplier?: number;
  target_min_distance?: number;
  target_max_distance?: number;
  is_repeatable?: number;
  enabled?: number;
}

interface AchievementSeed {
  name?: string;
  description?: string;
  image_slug?: string;
  badge_type?: string;
  is_repeatable?: number;
  metadata?: string | null;
}

const BASE_BODY = {
  slug: 'moria-chase',
  name: 'Moria Chase',
  description: 'Run through the dark of Moria before the drums catch you.',
  image_slug: 'moria-chase',
  badge_slug: 'challenge-moria-chase',
  duration_days: 3,
  target_stretch_multiplier: 1.3,
  target_min_distance: 3,
  target_max_distance: 50,
  is_repeatable: true,
};

let sqlite: DatabaseSync;
let d1: SqliteD1;
let db: DbClient;
let slugCounter = 0;

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = OFF;');
  database.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      username TEXT UNIQUE
    );
  `);
  for (const filename of [
    '0121_create_admin_audit_log.sql',
    '0142_create_achievement_definitions.sql',
    '0152_create_personal_encounter_definitions.sql',
    '0153_create_encounter_occurrences.sql',
    '0154_create_daily_rolls.sql',
  ]) {
    database.exec(readMigration(filename));
  }
  return database;
}

function seedDefinition(overrides: DefinitionSeed = {}): number {
  slugCounter += 1;
  const row = {
    slug: overrides.slug ?? `seed-encounter-${slugCounter}`,
    name: overrides.name ?? `Seed Encounter ${slugCounter}`,
    description: overrides.description ?? 'A seeded personal encounter.',
    image_slug: overrides.image_slug === undefined ? 'seed-image' : overrides.image_slug,
    badge_slug: overrides.badge_slug === undefined ? 'challenge-seed' : overrides.badge_slug,
    duration_days: overrides.duration_days ?? 3,
    target_stretch_multiplier: overrides.target_stretch_multiplier ?? 1.3,
    target_min_distance: overrides.target_min_distance ?? 3,
    target_max_distance: overrides.target_max_distance ?? 50,
    is_repeatable: overrides.is_repeatable ?? 1,
    enabled: overrides.enabled ?? 1,
  };

  const result = sqlite.prepare(
    `INSERT INTO personal_encounter_definitions
       (slug, name, description, image_slug, badge_slug, duration_days,
        target_stretch_multiplier, target_min_distance, target_max_distance,
        is_repeatable, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.slug,
    row.name,
    row.description,
    row.image_slug,
    row.badge_slug,
    row.duration_days,
    row.target_stretch_multiplier,
    row.target_min_distance,
    row.target_max_distance,
    row.is_repeatable,
    row.enabled,
  );

  return Number(result.lastInsertRowid);
}

function seedAchievement(slug: string, overrides: AchievementSeed = {}): void {
  sqlite.prepare(
    `INSERT INTO achievement_definitions
       (slug, name, description, image_slug, badge_type, is_repeatable, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    slug,
    overrides.name ?? `Badge ${slug}`,
    overrides.description ?? `Description for ${slug}`,
    overrides.image_slug ?? slug,
    overrides.badge_type ?? 'challenge',
    overrides.is_repeatable ?? 1,
    overrides.metadata ?? '{"storyline":null,"rank_thresholds":[1,3,7,15],"unit":"completions","criteria":"personal_encounter_completed"}',
  );
}

function ensureUser(userId: number): void {
  sqlite.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)')
    .run(userId, `walker-${userId}`);
}

function seedOccurrence(
  definitionId: number,
  userId: number,
  rollDate: string,
  status: 'active' | 'completed' | 'failed' = 'active',
): number {
  ensureUser(userId);
  const roll = sqlite.prepare(
    'INSERT INTO daily_rolls (user_id, roll_date, status) VALUES (?, ?, ?)',
  ).run(userId, rollDate, 'accepted');
  const occurrence = sqlite.prepare(
    `INSERT INTO encounter_occurrences
       (definition_id, user_id, daily_roll_id, status, personalized_target,
        started_at, coverage_end_date, grace_deadline)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    definitionId,
    userId,
    Number(roll.lastInsertRowid),
    status,
    10,
    '2026-01-01',
    '2026-01-03',
    '2026-01-05',
  );
  return Number(occurrence.lastInsertRowid);
}

function adminRequest(method = 'GET', body?: unknown): Request {
  return new Request('https://example.com/api/admin/encounters', {
    method,
    headers: {
      'content-type': 'application/json',
      'CF-Connecting-IP': '203.0.113.9',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function auditRows(): AuditRow[] {
  return sqlite.prepare('SELECT * FROM admin_audit_log ORDER BY id ASC').all() as unknown as AuditRow[];
}

function auditDetails(row: AuditRow): Record<string, unknown> {
  return JSON.parse(row.details ?? '{}') as Record<string, unknown>;
}

/**
 * Simulate a stale badge lookup: the handler's first achievement-by-slug read
 * reports no row even when one exists, reproducing the TOCTOU window in which
 * another writer creates the badge between the read and the batch.
 */
function withStaleAchievementLookup(base: DbClient): DbClient {
  let stale = true;
  const read = {
    prepare(sql: string) {
      if (stale && sql.includes('FROM achievement_definitions') && sql.includes('WHERE slug = ?')) {
        stale = false;
        return base.read.prepare('SELECT 1 AS id WHERE ? IS NULL');
      }
      return base.read.prepare(sql);
    },
  };

  return {
    read: read as unknown as D1Database,
    write: base.write,
  };
}

function countRows(sql: string, ...params: unknown[]): number {
  const row = sqlite.prepare(sql).get(...(params as never[])) as unknown as { count: number };
  return Number(row.count);
}

function definitionRow(id: number): {
  slug: string;
  name: string;
  badge_slug: string | null;
  enabled: number;
  is_repeatable: number;
} {
  return sqlite.prepare(
    'SELECT slug, name, badge_slug, enabled, is_repeatable FROM personal_encounter_definitions WHERE id = ?',
  ).get(id) as unknown as {
    slug: string;
    name: string;
    badge_slug: string | null;
    enabled: number;
    is_repeatable: number;
  };
}

describe('admin encounter handlers', () => {
  beforeEach(() => {
    sqlite = createDatabase();
    d1 = new SqliteD1(sqlite);
    db = {
      read: d1 as unknown as D1Database,
      write: d1 as unknown as D1Database,
    };
    slugCounter = 0;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  describe('handleAdminEncountersList / handleAdminEncounterGet', () => {
    it('lists every definition with enabled state and linked badge name', async () => {
      seedAchievement('challenge-one', { name: 'Badge One' });
      const enabledId = seedDefinition({ slug: 'encounter-one', badge_slug: 'challenge-one', enabled: 1 });
      const disabledId = seedDefinition({ slug: 'encounter-two', badge_slug: null, enabled: 0 });

      const response = await handleAdminEncountersList(adminRequest(), db);
      const body = await response.json() as { encounters: Array<Record<string, any>> };

      expect(response.status).toBe(200);
      expect(body.encounters).toHaveLength(2);
      expect(body.encounters[0]).toMatchObject({
        id: enabledId,
        slug: 'encounter-one',
        enabled: true,
        badge_name: 'Badge One',
      });
      expect(body.encounters[0].badge).toMatchObject({ name: 'Badge One', badge_type: 'challenge' });
      expect(body.encounters[1]).toMatchObject({
        id: disabledId,
        slug: 'encounter-two',
        enabled: false,
        badge: null,
        badge_name: null,
      });
    });

    it('returns one definition with complete linked badge metadata', async () => {
      seedAchievement('challenge-full', {
        name: 'Full Badge',
        description: 'Complete metadata',
        image_slug: 'challenge-full',
        is_repeatable: 1,
      });
      const id = seedDefinition({ slug: 'full-encounter', badge_slug: 'challenge-full' });

      const response = await handleAdminEncounterGet(adminRequest(), db, id);
      const body = await response.json() as { encounter: Record<string, any> };

      expect(response.status).toBe(200);
      expect(body.encounter).toMatchObject({
        id,
        slug: 'full-encounter',
        enabled: true,
        badge_slug: 'challenge-full',
        badge_name: 'Full Badge',
      });
      expect(body.encounter.badge).toEqual(expect.objectContaining({
        slug: 'challenge-full',
        name: 'Full Badge',
        description: 'Complete metadata',
        image_slug: 'challenge-full',
        badge_type: 'challenge',
        is_repeatable: true,
      }));
      expect(JSON.parse(body.encounter.badge.metadata)).toEqual({
        storyline: null,
        rank_thresholds: [1, 3, 7, 15],
        unit: 'completions',
        criteria: 'personal_encounter_completed',
      });
    });

    it('returns 404 for a missing definition', async () => {
      const response = await handleAdminEncounterGet(adminRequest(), db, 999);
      expect(response.status).toBe(404);
    });
  });

  describe('handleAdminEncounterCreate', () => {
    it('creates a disabled definition that links to an existing badge', async () => {
      seedAchievement('challenge-existing', { name: 'Existing Badge' });

      const response = await handleAdminEncounterCreate(
        adminRequest('POST', {
          ...BASE_BODY,
          badge_slug: 'challenge-existing',
          enabled: true,
        }),
        db,
        { ...BASE_BODY, badge_slug: 'challenge-existing', enabled: true },
        42,
      );
      const body = await response.json() as { encounter: Record<string, any> };

      expect(response.status).toBe(201);
      expect(body.encounter).toMatchObject({
        slug: 'moria-chase',
        badge_slug: 'challenge-existing',
        enabled: false,
        badge_name: 'Existing Badge',
      });

      const persisted = definitionRow(body.encounter.id);
      expect(persisted.enabled).toBe(0);

      const audits = auditRows();
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        admin_user_id: 42,
        action: 'create_encounter',
        target_type: 'personal_encounter',
        target_id: body.encounter.id,
        ip_address: '203.0.113.9',
        success: 1,
      });
      expect(auditDetails(audits[0]).enabled).toBe(false);
      expect(auditDetails(audits[0]).badge_created).toBe(false);
    });

    it.each([
      { repeatable: true, thresholds: [1, 3, 7, 15] },
      { repeatable: false, thresholds: [1] },
    ])(
      'auto-creates a complete challenge badge (repeatable=$repeatable)',
      async ({ repeatable, thresholds }) => {
        const body = {
          ...BASE_BODY,
          badge_slug: 'challenge-new',
          is_repeatable: repeatable,
          badge_name: 'New Challenge Badge',
          badge_description: 'Awarded for completing the encounter.',
          badge_image_slug: 'challenge-new-art',
        };

        const response = await handleAdminEncounterCreate(adminRequest('POST', body), db, body, 7);
        const responseBody = await response.json() as { encounter: Record<string, any> };

        expect(response.status).toBe(201);
        expect(responseBody.encounter.badge).toEqual(expect.objectContaining({
          slug: 'challenge-new',
          name: 'New Challenge Badge',
          description: 'Awarded for completing the encounter.',
          image_slug: 'challenge-new-art',
          badge_type: 'challenge',
          is_repeatable: repeatable,
        }));

        const badgeRow = sqlite.prepare(
          `SELECT slug, name, description, image_slug, badge_type, is_repeatable, metadata
           FROM achievement_definitions WHERE slug = 'challenge-new'`,
        ).get() as unknown as {
          slug: string;
          name: string;
          description: string;
          image_slug: string;
          badge_type: string;
          is_repeatable: number;
          metadata: string;
        };

        expect(badgeRow).toMatchObject({
          slug: 'challenge-new',
          name: 'New Challenge Badge',
          description: 'Awarded for completing the encounter.',
          image_slug: 'challenge-new-art',
          badge_type: 'challenge',
          is_repeatable: repeatable ? 1 : 0,
        });
        expect(JSON.parse(badgeRow.metadata)).toEqual({
          storyline: null,
          rank_thresholds: thresholds,
          unit: 'completions',
          criteria: 'personal_encounter_completed',
        });
        expect(auditDetails(auditRows()[0]).badge_created).toBe(true);
      },
    );

    it('rolls back the definition when the badge write fails', async () => {
      d1.failOn('INSERT INTO achievement_definitions');
      const body = {
        ...BASE_BODY,
        badge_slug: 'challenge-rollback',
        badge_name: 'Rollback Badge',
        badge_description: 'Should not persist.',
        badge_image_slug: 'challenge-rollback-art',
      };

      const response = await handleAdminEncounterCreate(adminRequest('POST', body), db, body, 11);

      expect(response.status).toBe(500);
      expect(countRows(
        'SELECT COUNT(*) AS count FROM personal_encounter_definitions WHERE slug = ?',
        body.slug,
      )).toBe(0);
      expect(countRows(
        'SELECT COUNT(*) AS count FROM achievement_definitions WHERE slug = ?',
        body.badge_slug,
      )).toBe(0);
      expect(auditRows()).toHaveLength(0);
    });

    it('does not orphan a definition when another writer creates the badge first', async () => {
      seedAchievement('challenge-raced', { name: 'Raced Badge' });
      const staleDb = withStaleAchievementLookup(db);
      const body = {
        ...BASE_BODY,
        badge_slug: 'challenge-raced',
        badge_name: 'Loser Badge',
        badge_description: 'Should not overwrite the winner.',
        badge_image_slug: 'loser-art',
      };

      const response = await handleAdminEncounterCreate(
        adminRequest('POST', body),
        staleDb,
        body,
        12,
      );

      expect(response.status).toBe(400);
      expect(countRows(
        'SELECT COUNT(*) AS count FROM personal_encounter_definitions WHERE slug = ?',
        body.slug,
      )).toBe(0);
      const badge = sqlite.prepare(
        'SELECT name, description, image_slug FROM achievement_definitions WHERE slug = ?',
      ).get('challenge-raced') as unknown as {
        name: string;
        description: string;
        image_slug: string;
      };
      expect(badge).toEqual({
        name: 'Raced Badge',
        description: 'Description for challenge-raced',
        image_slug: 'challenge-raced',
      });
      expect(auditRows()).toHaveLength(0);
    });

    it('requires complete inline badge fields when the badge slug is new', async () => {
      const requestBody = { ...BASE_BODY, badge_name: 'Only a name' };
      const response = await handleAdminEncounterCreate(
        adminRequest('POST', requestBody),
        db,
        requestBody,
        1,
      );
      const body = await response.json() as {
        error: string;
        fields: Record<string, string>;
      };

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation');
      expect(body.fields).toEqual(expect.objectContaining({
        badge_description: expect.any(String),
        badge_image_slug: expect.any(String),
      }));
      expect(body.fields.badge_name).toBeUndefined();
      expect(
        (sqlite.prepare('SELECT COUNT(*) AS count FROM personal_encounter_definitions').get() as { count: number }).count,
      ).toBe(0);
    });

    it('allows equal target min and max distances', async () => {
      seedAchievement('challenge-existing');
      const body = {
        ...BASE_BODY,
        badge_slug: 'challenge-existing',
        target_min_distance: 12.5,
        target_max_distance: 12.5,
      };

      const response = await handleAdminEncounterCreate(adminRequest('POST', body), db, body, 1);
      const responseBody = await response.json() as { encounter: Record<string, any> };

      expect(response.status).toBe(201);
      expect(responseBody.encounter.target_min_distance).toBe(12.5);
      expect(responseBody.encounter.target_max_distance).toBe(12.5);
    });

    it('rejects a duplicate slug', async () => {
      seedAchievement('challenge-existing');
      seedDefinition({ slug: 'moria-chase', badge_slug: 'challenge-existing' });

      const response = await handleAdminEncounterCreate(
        adminRequest('POST', { ...BASE_BODY, badge_slug: 'challenge-existing' }),
        db,
        { ...BASE_BODY, badge_slug: 'challenge-existing' },
        1,
      );
      const body = await response.json() as { error: string; fields: Record<string, string> };

      expect(response.status).toBe(400);
      expect(body.error).toBe('validation');
      expect(body.fields.slug).toContain('already in use');
    });

    const validationCases: Array<{
      name: string;
      patch: Record<string, unknown>;
      field: string;
    }> = [
      { name: 'missing slug', patch: { slug: '' }, field: 'slug' },
      { name: 'slug too long', patch: { slug: 'a'.repeat(81) }, field: 'slug' },
      { name: 'slug not kebab-case', patch: { slug: 'Not_Kebab' }, field: 'slug' },
      { name: 'missing name', patch: { name: '' }, field: 'name' },
      { name: 'name too long', patch: { name: 'n'.repeat(121) }, field: 'name' },
      { name: 'missing description', patch: { description: '' }, field: 'description' },
      { name: 'description too long', patch: { description: 'd'.repeat(2001) }, field: 'description' },
      { name: 'missing image slug', patch: { image_slug: '' }, field: 'image_slug' },
      { name: 'image slug too long', patch: { image_slug: 'i'.repeat(121) }, field: 'image_slug' },
      { name: 'missing badge slug', patch: { badge_slug: '' }, field: 'badge_slug' },
      { name: 'badge slug too long', patch: { badge_slug: 'b'.repeat(121) }, field: 'badge_slug' },
      { name: 'badge slug not kebab-case', patch: { badge_slug: 'Bad_Badge' }, field: 'badge_slug' },
      { name: 'missing duration', patch: { duration_days: undefined }, field: 'duration_days' },
      { name: 'non-integer duration', patch: { duration_days: 2.5 }, field: 'duration_days' },
      { name: 'duration below range', patch: { duration_days: 0 }, field: 'duration_days' },
      { name: 'duration above range', patch: { duration_days: 31 }, field: 'duration_days' },
      { name: 'missing stretch multiplier', patch: { target_stretch_multiplier: undefined }, field: 'target_stretch_multiplier' },
      { name: 'stretch multiplier below range', patch: { target_stretch_multiplier: 0.9 }, field: 'target_stretch_multiplier' },
      { name: 'stretch multiplier above range', patch: { target_stretch_multiplier: 5.1 }, field: 'target_stretch_multiplier' },
      { name: 'missing target minimum', patch: { target_min_distance: undefined }, field: 'target_min_distance' },
      { name: 'non-positive target minimum', patch: { target_min_distance: 0 }, field: 'target_min_distance' },
      { name: 'missing target maximum', patch: { target_max_distance: undefined }, field: 'target_max_distance' },
      { name: 'minimum above maximum', patch: { target_min_distance: 60, target_max_distance: 50 }, field: 'target_min_distance' },
      { name: 'non-boolean repeatable flag', patch: { is_repeatable: 'yes' }, field: 'is_repeatable' },
    ];

    it.each(validationCases)('rejects $name', async ({ patch, field }) => {
      seedAchievement('challenge-existing');
      const body = { ...BASE_BODY, badge_slug: 'challenge-existing', ...patch };
      for (const key of Object.keys(patch)) {
        if (patch[key] === undefined) delete (body as Record<string, unknown>)[key];
      }

      const response = await handleAdminEncounterCreate(adminRequest('POST', body), db, body, 1);
      const responseBody = await response.json() as {
        error: string;
        fields: Record<string, string>;
      };

      expect(response.status).toBe(400);
      expect(responseBody.error).toBe('validation');
      expect(responseBody.fields[field]).toEqual(expect.any(String));
      expect(
        (sqlite.prepare('SELECT COUNT(*) AS count FROM personal_encounter_definitions').get() as { count: number }).count,
      ).toBe(0);
    });
  });

  describe('handleAdminEncounterUpdate', () => {
    it('updates fields and the linked badge without deleting the prior badge', async () => {
      seedAchievement('challenge-old', { name: 'Old Badge' });
      seedAchievement('challenge-new', { name: 'Old New Badge' });
      const id = seedDefinition({
        slug: 'old-slug',
        name: 'Old Name',
        badge_slug: 'challenge-old',
        is_repeatable: 1,
        enabled: 0,
      });

      const body = {
        ...BASE_BODY,
        slug: 'new-slug',
        name: 'New Name',
        badge_slug: 'challenge-new',
        badge_name: 'New Badge Name',
        badge_description: 'New badge description',
        badge_image_slug: 'challenge-new-art',
        is_repeatable: false,
        enabled: true,
      };

      const response = await handleAdminEncounterUpdate(adminRequest('PUT', body), db, id, body, 42);
      const responseBody = await response.json() as { encounter: Record<string, any> };

      expect(response.status).toBe(200);
      expect(responseBody.encounter).toMatchObject({
        id,
        slug: 'new-slug',
        name: 'New Name',
        badge_slug: 'challenge-new',
        badge_name: 'New Badge Name',
        is_repeatable: false,
        enabled: false,
      });

      const updatedBadge = sqlite.prepare(
        `SELECT name, description, image_slug, is_repeatable, metadata
         FROM achievement_definitions WHERE slug = 'challenge-new'`,
      ).get() as unknown as {
        name: string;
        description: string;
        image_slug: string;
        is_repeatable: number;
        metadata: string;
      };
      expect(updatedBadge).toMatchObject({
        name: 'New Badge Name',
        description: 'New badge description',
        image_slug: 'challenge-new-art',
        is_repeatable: 0,
      });
      expect(JSON.parse(updatedBadge.metadata).rank_thresholds).toEqual([1]);

      // The prior badge definition remains for historical achievement display.
      expect(
        (sqlite.prepare("SELECT COUNT(*) AS count FROM achievement_definitions WHERE slug = 'challenge-old'").get() as { count: number }).count,
      ).toBe(1);

      const audits = auditRows();
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: 'update_encounter',
        target_type: 'personal_encounter',
        target_id: id,
        success: 1,
      });
      const details = auditDetails(audits[0]) as {
        changes: Record<string, unknown>;
        badge: Record<string, unknown>;
      };
      expect(details.changes.name).toEqual({ old: 'Old Name', new: 'New Name' });
      expect(details.changes.badge_slug).toEqual({ old: 'challenge-old', new: 'challenge-new' });
      expect(details.badge).toEqual({ slug: 'challenge-new', created: false, updated: true });
    });

    it('does not rewrite a linked badge owned by another feature when only repeatability changes', async () => {
      const externalMetadata = '{"storyline":"frodo-sam","rank":1,"threshold_km":112.65,"criteria":"distance_km >= 112.65"}';
      seedAchievement('journey-external-badge', {
        name: 'External Journey Badge',
        badge_type: 'journey',
        is_repeatable: 0,
        metadata: externalMetadata,
      });
      const id = seedDefinition({
        slug: 'external-badge-encounter',
        badge_slug: 'journey-external-badge',
        is_repeatable: 1,
      });

      const body = {
        ...BASE_BODY,
        slug: 'external-badge-encounter',
        badge_slug: 'journey-external-badge',
        is_repeatable: false,
      };

      const response = await handleAdminEncounterUpdate(adminRequest('PUT', body), db, id, body, 3);
      expect(response.status).toBe(200);
      expect(definitionRow(id).is_repeatable).toBe(0);

      const badge = sqlite.prepare(
        `SELECT name, badge_type, is_repeatable, metadata
         FROM achievement_definitions WHERE slug = 'journey-external-badge'`,
      ).get() as unknown as {
        name: string;
        badge_type: string;
        is_repeatable: number;
        metadata: string;
      };
      expect(badge).toEqual({
        name: 'External Journey Badge',
        badge_type: 'journey',
        is_repeatable: 0,
        metadata: externalMetadata,
      });
    });

    it('never rewrites an external badge when full prefilled inline fields are submitted', async () => {
      const externalMetadata = '{"storyline":"frodo-sam","rank":1,"threshold_km":112.65,"criteria":"distance_km >= 112.65"}';
      seedAchievement('journey-external-badge', {
        name: 'External Journey Badge',
        description: 'Journey description',
        image_slug: 'journey-art',
        badge_type: 'journey',
        is_repeatable: 0,
        metadata: externalMetadata,
      });
      const id = seedDefinition({
        slug: 'external-badge-encounter',
        badge_slug: 'journey-external-badge',
        is_repeatable: 1,
      });

      // Matches what the admin UI actually submits: the linked badge's fields
      // are prefilled, so inline fields are present even for a foreign badge.
      const body = {
        ...BASE_BODY,
        slug: 'external-badge-encounter',
        badge_slug: 'journey-external-badge',
        badge_name: 'Hijacked Badge Name',
        badge_description: 'Hijacked badge description',
        badge_image_slug: 'hijacked-art',
        is_repeatable: true,
      };

      const response = await handleAdminEncounterUpdate(adminRequest('PUT', body), db, id, body, 3);
      const responseBody = await response.json() as { encounter: Record<string, any> };

      expect(response.status).toBe(200);
      expect(responseBody.encounter.badge_name).toBe('External Journey Badge');
      expect(responseBody.encounter.badge).toEqual(expect.objectContaining({
        name: 'External Journey Badge',
        description: 'Journey description',
        image_slug: 'journey-art',
        badge_type: 'journey',
        is_repeatable: false,
        metadata: externalMetadata,
      }));

      const badge = sqlite.prepare(
        `SELECT name, description, image_slug, badge_type, is_repeatable, metadata
         FROM achievement_definitions WHERE slug = 'journey-external-badge'`,
      ).get() as unknown as {
        name: string;
        description: string;
        image_slug: string;
        badge_type: string;
        is_repeatable: number;
        metadata: string;
      };
      expect(badge).toEqual({
        name: 'External Journey Badge',
        description: 'Journey description',
        image_slug: 'journey-art',
        badge_type: 'journey',
        is_repeatable: 0,
        metadata: externalMetadata,
      });
    });

    it('edits a seeded challenge badge without discarding shared metadata keys', async () => {
      const seededMetadata = '{"storyline":null,"rank_thresholds":[1,3,7,15],"unit":"pursuits","criteria":"personal_encounter_completed"}';
      seedAchievement('challenge-nazgul-outrun', {
        name: 'Outrunner of the Nazgûl',
        description: 'Complete the Outrun the Nazgûl personal challenge.',
        image_slug: 'challenge-nazgul-outrun',
        is_repeatable: 1,
        metadata: seededMetadata,
      });
      const id = seedDefinition({
        slug: 'nazgul-encounter',
        badge_slug: 'challenge-nazgul-outrun',
        is_repeatable: 1,
      });

      const body = {
        ...BASE_BODY,
        slug: 'nazgul-encounter',
        badge_slug: 'challenge-nazgul-outrun',
        badge_name: 'Outrunner of the Nazgûl',
        badge_description: 'Updated challenge description.',
        badge_image_slug: 'challenge-nazgul-outrun',
        is_repeatable: false,
      };

      const response = await handleAdminEncounterUpdate(adminRequest('PUT', body), db, id, body, 4);
      expect(response.status).toBe(200);

      const badge = sqlite.prepare(
        `SELECT name, description, is_repeatable, metadata
         FROM achievement_definitions WHERE slug = 'challenge-nazgul-outrun'`,
      ).get() as unknown as {
        name: string;
        description: string;
        is_repeatable: number;
        metadata: string;
      };
      expect(badge).toMatchObject({
        name: 'Outrunner of the Nazgûl',
        description: 'Updated challenge description.',
        is_repeatable: 0,
      });
      expect(JSON.parse(badge.metadata)).toEqual({
        storyline: null,
        rank_thresholds: [1],
        unit: 'pursuits',
        criteria: 'personal_encounter_completed',
      });
    });

    it('leaves seeded badge metadata untouched on a display-only edit', async () => {
      const seededMetadata = '{"storyline":null,"rank_thresholds":[1,3,7,15],"unit":"pursuits","criteria":"personal_encounter_completed"}';
      seedAchievement('challenge-nazgul-outrun', {
        name: 'Outrunner of the Nazgûl',
        description: 'Complete the Outrun the Nazgûl personal challenge.',
        image_slug: 'challenge-nazgul-outrun',
        is_repeatable: 1,
        metadata: seededMetadata,
      });
      const id = seedDefinition({
        slug: 'nazgul-encounter',
        badge_slug: 'challenge-nazgul-outrun',
        is_repeatable: 1,
      });

      const body = {
        ...BASE_BODY,
        slug: 'nazgul-encounter',
        badge_slug: 'challenge-nazgul-outrun',
        badge_name: 'Outrunner of the Nazgûl',
        badge_description: 'Display-only description update.',
        badge_image_slug: 'challenge-nazgul-outrun',
        is_repeatable: true,
      };

      const response = await handleAdminEncounterUpdate(adminRequest('PUT', body), db, id, body, 6);
      expect(response.status).toBe(200);

      const badge = sqlite.prepare(
        `SELECT description, is_repeatable, metadata
         FROM achievement_definitions WHERE slug = 'challenge-nazgul-outrun'`,
      ).get() as unknown as {
        description: string;
        is_repeatable: number;
        metadata: string;
      };
      expect(badge.description).toBe('Display-only description update.');
      expect(badge.is_repeatable).toBe(1);
      expect(badge.metadata).toBe(seededMetadata);
    });

    it('rolls back definition changes when the badge write fails', async () => {
      seedAchievement('challenge-atomic', {
        name: 'Atomic Badge',
        description: 'Original badge description',
      });
      const id = seedDefinition({
        slug: 'atomic-edit',
        name: 'Original Name',
        badge_slug: 'challenge-atomic',
      });
      d1.failOn('UPDATE achievement_definitions');

      const body = {
        ...BASE_BODY,
        slug: 'atomic-edit',
        name: 'Renamed Encounter',
        badge_slug: 'challenge-atomic',
        badge_name: 'Renamed Badge',
        badge_description: 'Renamed badge description',
        badge_image_slug: 'renamed-art',
      };

      const response = await handleAdminEncounterUpdate(adminRequest('PUT', body), db, id, body, 13);

      expect(response.status).toBe(500);
      expect(definitionRow(id)).toMatchObject({
        slug: 'atomic-edit',
        name: 'Original Name',
        badge_slug: 'challenge-atomic',
      });
      const badge = sqlite.prepare(
        'SELECT name, description, image_slug FROM achievement_definitions WHERE slug = ?',
      ).get('challenge-atomic') as unknown as {
        name: string;
        description: string;
        image_slug: string;
      };
      expect(badge).toEqual({
        name: 'Atomic Badge',
        description: 'Original badge description',
        image_slug: 'challenge-atomic',
      });
      expect(auditRows()).toHaveLength(0);
    });

    it('creates a new badge on edit when the new slug is absent and inline fields are supplied', async () => {
      seedAchievement('challenge-old');
      const id = seedDefinition({ slug: 'encounter-edit', badge_slug: 'challenge-old' });

      const body = {
        ...BASE_BODY,
        slug: 'encounter-edit',
        badge_slug: 'challenge-brand-new',
        badge_name: 'Brand New Badge',
        badge_description: 'Created while editing.',
        badge_image_slug: 'challenge-brand-new',
      };

      const response = await handleAdminEncounterUpdate(adminRequest('PUT', body), db, id, body, 5);
      expect(response.status).toBe(200);

      const created = sqlite.prepare(
        `SELECT badge_type, is_repeatable, metadata FROM achievement_definitions
         WHERE slug = 'challenge-brand-new'`,
      ).get() as unknown as { badge_type: string; is_repeatable: number; metadata: string };
      expect(created.badge_type).toBe('challenge');
      expect(created.is_repeatable).toBe(1);
      expect(JSON.parse(created.metadata).criteria).toBe('personal_encounter_completed');
      expect(
        (sqlite.prepare("SELECT COUNT(*) AS count FROM achievement_definitions WHERE slug = 'challenge-old'").get() as { count: number }).count,
      ).toBe(1);
    });

    it('requires inline badge fields when editing to an unknown badge slug', async () => {
      seedAchievement('challenge-old');
      const id = seedDefinition({ slug: 'encounter-edit', badge_slug: 'challenge-old' });
      const body = { ...BASE_BODY, slug: 'encounter-edit', badge_slug: 'challenge-missing' };

      const response = await handleAdminEncounterUpdate(adminRequest('PUT', body), db, id, body, 1);
      const responseBody = await response.json() as {
        error: string;
        fields: Record<string, string>;
      };

      expect(response.status).toBe(400);
      expect(responseBody.fields).toEqual(expect.objectContaining({
        badge_name: expect.any(String),
        badge_description: expect.any(String),
        badge_image_slug: expect.any(String),
      }));
    });

    it('rejects changing to another definition slug', async () => {
      seedAchievement('challenge-old');
      const id = seedDefinition({ slug: 'encounter-edit', badge_slug: 'challenge-old' });
      seedDefinition({ slug: 'taken-slug', badge_slug: null });

      const body = { ...BASE_BODY, slug: 'taken-slug', badge_slug: 'challenge-old' };
      const response = await handleAdminEncounterUpdate(adminRequest('PUT', body), db, id, body, 1);
      const responseBody = await response.json() as { fields: Record<string, string> };

      expect(response.status).toBe(400);
      expect(responseBody.fields.slug).toContain('already in use');
      expect(definitionRow(id).slug).toBe('encounter-edit');
    });

    it('allows an update that keeps the current slug', async () => {
      seedAchievement('challenge-old');
      const id = seedDefinition({ slug: 'encounter-edit', badge_slug: 'challenge-old' });
      const body = { ...BASE_BODY, slug: 'encounter-edit', badge_slug: 'challenge-old' };

      const response = await handleAdminEncounterUpdate(adminRequest('PUT', body), db, id, body, 1);
      expect(response.status).toBe(200);
    });

    it('returns 404 for a missing definition', async () => {
      const response = await handleAdminEncounterUpdate(
        adminRequest('PUT', BASE_BODY),
        db,
        999,
        BASE_BODY,
        1,
      );
      expect(response.status).toBe(404);
    });
  });

  describe('handleAdminEncounterEnable', () => {
    it('enables a definition and audits the action', async () => {
      const id = seedDefinition({ slug: 'enable-me', enabled: 0 });

      const response = await handleAdminEncounterEnable(adminRequest('PUT'), db, id, 42);
      const body = await response.json() as { encounter: Record<string, any> };

      expect(response.status).toBe(200);
      expect(body.encounter.enabled).toBe(true);
      expect(definitionRow(id).enabled).toBe(1);

      const audits = auditRows();
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: 'enable_encounter',
        target_type: 'personal_encounter',
        target_id: id,
        admin_user_id: 42,
        success: 1,
        ip_address: '203.0.113.9',
      });
      expect(auditDetails(audits[0])).toEqual({ enabled: true });
    });

    it('returns 404 for a missing definition', async () => {
      const response = await handleAdminEncounterEnable(adminRequest('PUT'), db, 999, 1);
      expect(response.status).toBe(404);
    });
  });

  describe('handleAdminEncounterDisable', () => {
    it('disables immediately when there are no active occurrences', async () => {
      const id = seedDefinition({ slug: 'disable-me', enabled: 1 });
      seedOccurrence(id, 2, '2026-02-01', 'completed');

      const response = await handleAdminEncounterDisable(adminRequest('PUT'), db, id, {}, 42);
      const body = await response.json() as { encounter: Record<string, any> };

      expect(response.status).toBe(200);
      expect(body.encounter.enabled).toBe(false);
      expect(definitionRow(id).enabled).toBe(0);
      expect(auditRows()).toHaveLength(1);
      expect(auditRows()[0].action).toBe('disable_encounter');
      expect(auditDetails(auditRows()[0])).toMatchObject({
        enabled: false,
        activeOccurrences: 0,
        cancelActive: false,
        cancelledOccurrences: 0,
      });
    });

    it('requires confirmation when active occurrences exist', async () => {
      const id = seedDefinition({ slug: 'needs-confirmation', enabled: 1 });
      seedOccurrence(id, 2, '2026-02-01');
      seedOccurrence(id, 3, '2026-02-01');

      const response = await handleAdminEncounterDisable(adminRequest('PUT'), db, id, {}, 42);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({ activeOccurrences: 2, requiresConfirmation: true });
      expect(definitionRow(id).enabled).toBe(1);
      expect(auditRows()).toHaveLength(0);
      expect(
        (sqlite.prepare(
          "SELECT COUNT(*) AS count FROM encounter_occurrences WHERE definition_id = ? AND status = 'active'",
        ).get(id) as { count: number }).count,
      ).toBe(2);
    });

    it('keeps active challenges when cancelActive is false', async () => {
      const id = seedDefinition({ slug: 'keep-active', enabled: 1 });
      seedOccurrence(id, 2, '2026-02-01');
      seedOccurrence(id, 3, '2026-02-01');

      const response = await handleAdminEncounterDisable(
        adminRequest('PUT', { cancelActive: false }),
        db,
        id,
        { cancelActive: false },
        42,
      );
      const body = await response.json() as { encounter: Record<string, any> };

      expect(response.status).toBe(200);
      expect(body.encounter.enabled).toBe(false);
      expect(
        (sqlite.prepare(
          "SELECT COUNT(*) AS count FROM encounter_occurrences WHERE definition_id = ? AND status = 'active'",
        ).get(id) as { count: number }).count,
      ).toBe(2);

      const audits = auditRows();
      expect(audits).toHaveLength(1);
      expect(audits[0].action).toBe('disable_encounter');
      expect(auditDetails(audits[0])).toMatchObject({
        activeOccurrences: 2,
        cancelActive: false,
        cancelledOccurrences: 0,
      });
    });

    it('fails active occurrences and audits the cancelled count when cancelActive is true', async () => {
      const id = seedDefinition({ slug: 'cancel-active', enabled: 1 });
      seedOccurrence(id, 2, '2026-02-01');
      seedOccurrence(id, 3, '2026-02-01');
      seedOccurrence(id, 4, '2026-02-01', 'completed');

      const response = await handleAdminEncounterDisable(
        adminRequest('PUT', { cancelActive: true }),
        db,
        id,
        { cancelActive: true },
        42,
      );
      const body = await response.json() as { encounter: Record<string, any> };

      expect(response.status).toBe(200);
      expect(body.encounter.enabled).toBe(false);
      expect(definitionRow(id).enabled).toBe(0);

      const statuses = sqlite.prepare(
        'SELECT status, COUNT(*) AS count FROM encounter_occurrences WHERE definition_id = ? GROUP BY status',
      ).all(id) as unknown as Array<{ status: string; count: number }>;
      expect(statuses).toEqual(expect.arrayContaining([
        { status: 'failed', count: 2 },
        { status: 'completed', count: 1 },
      ]));

      const audits = auditRows();
      expect(audits.map((row) => row.action)).toEqual([
        'disable_encounter',
        'cancel_active_occurrences',
      ]);
      expect(auditDetails(audits[0])).toMatchObject({
        activeOccurrences: 2,
        cancelActive: true,
        cancelledOccurrences: 2,
      });
      expect(auditDetails(audits[1])).toEqual({ cancelledOccurrences: 2 });
      expect(audits[1]).toMatchObject({
        target_type: 'personal_encounter',
        target_id: id,
        admin_user_id: 42,
        success: 1,
        ip_address: '203.0.113.9',
      });
    });

    it('returns 404 for a missing definition', async () => {
      const response = await handleAdminEncounterDisable(adminRequest('PUT'), db, 999, {}, 1);
      expect(response.status).toBe(404);
    });
  });
});
