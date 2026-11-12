import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import type { DbClient } from '../../src/db';
import {
  handleAdminCampaignsList,
  handleAdminCampaignGet,
  handleAdminCampaignCreate,
  handleAdminCampaignUpdate,
  handleAdminCampaignEnable,
  handleAdminCampaignDisable,
  handleAdminCampaignRetrigger,
  handleAdminCampaignSuggestions,
} from '../../src/campaign-admin-handlers';
import { addDays, utcToday } from '../../src/event-utils';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
const TODAY = utcToday();
const TOMORROW = addDays(TODAY, 1);
const ADMIN_ID = 42;

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

const CAMPAIGN_MIGRATIONS = [
  '0121_create_admin_audit_log.sql',
  '0142_create_achievement_definitions.sql',
  '0143_create_user_achievement_instances.sql',
  '0161_create_campaign_definitions.sql',
  '0162_create_campaign_runs.sql',
  '0163_create_campaign_participants.sql',
  '0164_create_campaign_progress_ledger.sql',
];

type SqlValue = string | number | null;

/**
 * Structural subset of `node:sqlite`'s prepared statement that this adapter
 * calls; D1 statements are shaped close enough for the DbClient contract.
 */
type SqlitePreparedStatement = ReturnType<DatabaseSync['prepare']>;

class SqliteStatement {
  private readonly statement: SqlitePreparedStatement;
  private readonly params: unknown[];

  constructor(statement: SqlitePreparedStatement, params: unknown[] = []) {
    this.statement = statement;
    this.params = params;
  }

  bind(...params: unknown[]): SqliteStatement {
    return new SqliteStatement(this.statement, params);
  }

  async first<T>(): Promise<T | null> {
    const row = this.statement.get(...(this.params as never[]));
    return (row ?? null) as T | null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.statement.all(...(this.params as never[])) as T[] };
  }

  async run(): Promise<{ success: true; meta: { changes: number; last_row_id: number } }> {
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
  constructor(private readonly sqlite: DatabaseSync) {}

  prepare(sql: string): SqliteStatement {
    return new SqliteStatement(this.sqlite.prepare(sql));
  }

  async batch(
    statements: SqliteStatement[],
  ): Promise<Array<{ success: true; meta: { changes: number; last_row_id: number } }>> {
    this.sqlite.exec('BEGIN');
    try {
      const results: Array<{ success: true; meta: { changes: number; last_row_id: number } }> = [];
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
  success: number;
}

interface CampaignSeed {
  slug?: string;
  name?: string;
  description?: string;
  image_slug?: string | null;
  badge_slug?: string | null;
  enabled?: number;
}

interface RunSeed {
  runNumber?: number;
  target?: number;
  start?: string;
  end?: string;
  status?: 'upcoming' | 'active' | 'completed' | 'expired';
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
  slug: 'light-the-beacons',
  name: 'Light the Beacons',
  description: 'Rally the community and light the beacons of Gondor.',
  image_slug: 'light-the-beacons',
  badge_slug: 'community-light-the-beacons',
  target_distance: 250,
  start_date: TOMORROW,
  end_date: addDays(TOMORROW, 13),
  badge_name: 'Beacon Lighter',
  badge_description: 'Complete a Light the Beacons community campaign.',
  badge_image_slug: 'community-light-the-beacons',
  repeatable: true,
  rank_thresholds: [1, 3, 7, 15],
};

let sqlite: DatabaseSync;
let db: DbClient;

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = OFF;');
  database.exec(PREREQUISITE_SCHEMA);
  for (const filename of CAMPAIGN_MIGRATIONS) {
    database.exec(readMigration(filename));
  }
  return database;
}

function insertCampaign(overrides: CampaignSeed = {}): number {
  const result = sqlite.prepare(
    `INSERT INTO campaign_definitions
       (slug, name, description, image_slug, badge_slug, enabled)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    overrides.slug ?? 'beacon-watch',
    overrides.name ?? 'Beacon Watch',
    overrides.description ?? 'A community campaign.',
    overrides.image_slug === undefined ? 'beacon-watch' : overrides.image_slug,
    overrides.badge_slug === undefined ? 'community-beacon-watch' : overrides.badge_slug,
    overrides.enabled ?? 1,
  );
  return Number(result.lastInsertRowid);
}

function insertRun(campaignId: number, overrides: RunSeed = {}): number {
  const result = sqlite.prepare(
    `INSERT INTO campaign_runs
       (campaign_id, run_number, target_distance, start_date, end_date, status,
        completed_at, participant_count, contributor_count, total_distance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    campaignId,
    overrides.runNumber ?? 1,
    overrides.target ?? 100,
    overrides.start ?? TODAY,
    overrides.end ?? addDays(TODAY, 13),
    overrides.status ?? 'active',
    overrides.status === 'completed' ? '2026-01-01 00:00:00' : null,
    overrides.status === 'completed' || overrides.status === 'expired' ? 1 : null,
    overrides.status === 'completed' || overrides.status === 'expired' ? 1 : null,
    overrides.status === 'completed' || overrides.status === 'expired' ? 10 : null,
  );
  return Number(result.lastInsertRowid);
}

function ensureUser(userId: number): void {
  sqlite.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)')
    .run(userId, `walker-${userId}`);
}

function insertProgress(userId: number, date: string, distance: number): number {
  ensureUser(userId);
  const result = sqlite.prepare(
    'INSERT INTO progress (user_id, date, distance) VALUES (?, ?, ?)',
  ).run(userId, date, distance);
  return Number(result.lastInsertRowid);
}

function insertParticipant(
  campaignId: number,
  runId: number,
  options: { userId?: number; status?: 'active' | 'removed'; distance?: number; removedAt?: string | null } = {},
): number {
  const userId = options.userId ?? 1;
  ensureUser(userId);
  const result = sqlite.prepare(
    `INSERT INTO campaign_participants
       (campaign_id, run_id, user_id, progress_distance, status, removed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    campaignId,
    runId,
    userId,
    options.distance ?? 0,
    options.status ?? 'active',
    options.removedAt ?? null,
  );
  return Number(result.lastInsertRowid);
}

function insertLedger(
  participantId: number,
  runId: number,
  sourceProgressId: number,
  distance: number,
): void {
  sqlite.prepare(
    `INSERT INTO campaign_progress_ledger
       (participant_id, run_id, source_progress_id, distance)
     VALUES (?, ?, ?, ?)`,
  ).run(participantId, runId, sourceProgressId, distance);
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
    overrides.badge_type ?? 'community',
    overrides.is_repeatable ?? 1,
    overrides.metadata === undefined
      ? '{"storyline":null,"rank_thresholds":[1,3,7,15],"unit":"campaigns","criteria":"community_campaign_completed"}'
      : overrides.metadata,
  );
}

function adminRequest(method = 'GET', body?: unknown, url = 'https://example.com/api/admin/campaigns'): Request {
  return new Request(url, {
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

function campaignRow(id: number): {
  slug: string;
  name: string;
  description: string;
  badge_slug: string | null;
  enabled: number;
} {
  return sqlite.prepare(
    'SELECT slug, name, description, badge_slug, enabled FROM campaign_definitions WHERE id = ?',
  ).get(id) as unknown as {
    slug: string;
    name: string;
    description: string;
    badge_slug: string | null;
    enabled: number;
  };
}

function runRows(campaignId: number): Array<Record<string, unknown>> {
  return sqlite.prepare(
    'SELECT * FROM campaign_runs WHERE campaign_id = ? ORDER BY run_number ASC',
  ).all(campaignId) as unknown as Array<Record<string, unknown>>;
}

function participantRows(campaignId: number): Array<Record<string, unknown>> {
  return sqlite.prepare(
    'SELECT * FROM campaign_participants WHERE campaign_id = ? ORDER BY id ASC',
  ).all(campaignId) as unknown as Array<Record<string, unknown>>;
}

function ledgerCount(): number {
  const row = sqlite.prepare('SELECT COUNT(*) AS count FROM campaign_progress_ledger')
    .get() as unknown as { count: number };
  return Number(row.count);
}

describe('admin campaign handlers', () => {
  beforeEach(() => {
    sqlite = createDatabase();
    const d1 = new SqliteD1(sqlite);
    db = { read: d1 as unknown as D1Database, write: d1 as unknown as D1Database };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  describe('list and detail', () => {
    it('lists definitions with run state, badge, and active participant count', async () => {
      seedAchievement('community-beacon-watch', { name: 'Beacon Warden' });
      const campaignId = insertCampaign({ badge_slug: 'community-beacon-watch', enabled: 1 });
      const runId = insertRun(campaignId, { target: 581, start: TODAY, end: addDays(TODAY, 13), status: 'active' });
      insertParticipant(campaignId, runId, { userId: 1 });
      insertParticipant(campaignId, runId, { userId: 2, status: 'removed' });

      const response = await handleAdminCampaignsList(adminRequest(), db);
      const body = await response.json() as { campaigns: Array<Record<string, any>> };

      expect(response.status).toBe(200);
      expect(body.campaigns).toHaveLength(1);
      expect(body.campaigns[0]).toMatchObject({
        id: campaignId,
        slug: 'beacon-watch',
        enabled: true,
        badge_name: 'Beacon Warden',
        activeParticipantCount: 1,
      });
      expect(body.campaigns[0].activeRun).toMatchObject({ target_distance: 581, status: 'active' });
      expect(body.campaigns[0].latestRun).toMatchObject({ target_distance: 581 });
      expect(body.campaigns[0].badge).toMatchObject({ badge_type: 'community', is_repeatable: true });
    });

    it('returns full run history on detail and 404 for unknown ids', async () => {
      const campaignId = insertCampaign();
      insertRun(campaignId, { runNumber: 1, status: 'completed', target: 100 });
      insertRun(campaignId, { runNumber: 2, status: 'upcoming', target: 200 });

      const response = await handleAdminCampaignGet(adminRequest(), db, campaignId);
      const body = await response.json() as { campaign: Record<string, any> };

      expect(response.status).toBe(200);
      expect(body.campaign.runs).toHaveLength(2);
      expect(body.campaign.activeRun).toMatchObject({ run_number: 2, status: 'upcoming' });
      expect(body.campaign.latestRun).toMatchObject({ run_number: 2 });

      const missing = await handleAdminCampaignGet(adminRequest(), db, 999);
      expect(missing.status).toBe(404);
    });
  });

  describe('create', () => {
    it('creates a disabled definition, its first run, and a repeatable community badge', async () => {
      const response = await handleAdminCampaignCreate(
        adminRequest('POST', BASE_BODY),
        db,
        BASE_BODY,
        ADMIN_ID,
      );
      const body = await response.json() as { campaign: Record<string, any> };

      expect(response.status).toBe(201);
      expect(body.campaign).toMatchObject({
        slug: 'light-the-beacons',
        enabled: false,
        activeParticipantCount: 0,
      });
      expect(body.campaign.activeRun).toMatchObject({
        run_number: 1,
        target_distance: 250,
        start_date: TOMORROW,
        end_date: addDays(TOMORROW, 13),
        status: 'upcoming',
        announced_at: null,
      });

      const row = campaignRow(body.campaign.id);
      expect(row.enabled).toBe(0);

      const badge = sqlite.prepare(
        "SELECT * FROM achievement_definitions WHERE slug = 'community-light-the-beacons'",
      ).get() as unknown as {
        badge_type: string;
        is_repeatable: number;
        metadata: string;
      };
      expect(badge.badge_type).toBe('community');
      expect(badge.is_repeatable).toBe(1);
      const metadata = JSON.parse(badge.metadata) as Record<string, unknown>;
      expect(metadata.rank_thresholds).toEqual([1, 3, 7, 15]);
      expect(metadata).not.toHaveProperty('rank');

      const audits = auditRows();
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        admin_user_id: ADMIN_ID,
        action: 'create_campaign',
        target_type: 'community_campaign',
        target_id: body.campaign.id,
      });
      expect(auditDetails(audits[0])).toMatchObject({ enabled: false, badge_created: true });
    });

    it('links an existing community badge without modifying it', async () => {
      seedAchievement('community-existing', { name: 'Existing Badge', is_repeatable: 0 });

      const body = { ...BASE_BODY, badge_slug: 'community-existing' };
      const response = await handleAdminCampaignCreate(adminRequest('POST', body), db, body, ADMIN_ID);

      expect(response.status).toBe(201);
      const badge = sqlite.prepare(
        "SELECT name, is_repeatable FROM achievement_definitions WHERE slug = 'community-existing'",
      ).get() as unknown as { name: string; is_repeatable: number };
      expect(badge).toEqual({ name: 'Existing Badge', is_repeatable: 0 });
    });

    it('rejects inline metadata aimed at another feature badge', async () => {
      seedAchievement('challenge-foreign', { badge_type: 'challenge', name: 'Foreign Badge' });

      const body = {
        ...BASE_BODY,
        badge_slug: 'challenge-foreign',
        badge_name: 'Renamed Foreign Badge',
      };
      const response = await handleAdminCampaignCreate(adminRequest('POST', body), db, body, ADMIN_ID);
      const parsed = await response.json() as { error: string; fields: Record<string, string> };

      expect(response.status).toBe(400);
      expect(parsed.fields.badge_slug).toMatch(/another feature/);
      expect(campaignRow(1)).toBeUndefined();
    });

    it('returns field-level validation errors including the create-only past start date', async () => {
      const body = {
        ...BASE_BODY,
        slug: 'Not Kebab',
        name: '',
        description: '',
        image_slug: '',
        badge_slug: '',
        target_distance: 0,
        start_date: addDays(TODAY, -1),
        end_date: addDays(TODAY, -2),
      };
      const response = await handleAdminCampaignCreate(adminRequest('POST', body), db, body, ADMIN_ID);
      const parsed = await response.json() as { error: string; fields: Record<string, string> };

      expect(response.status).toBe(400);
      expect(parsed.error).toBe('validation');
      expect(parsed.fields).toMatchObject({
        slug: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        image_slug: expect.any(String),
        badge_slug: expect.any(String),
        target_distance: expect.any(String),
        start_date: expect.any(String),
        end_date: expect.any(String),
      });
      expect(parsed.fields.start_date).toMatch(/today or later/);
    });

    it('requires inline badge metadata when the badge slug is new', async () => {
      const body = {
        ...BASE_BODY,
        badge_name: '',
        badge_description: '',
        badge_image_slug: '',
      };
      const response = await handleAdminCampaignCreate(adminRequest('POST', body), db, body, ADMIN_ID);
      const parsed = await response.json() as { fields: Record<string, string> };

      expect(response.status).toBe(400);
      expect(parsed.fields).toMatchObject({
        badge_name: expect.any(String),
        badge_description: expect.any(String),
        badge_image_slug: expect.any(String),
      });
    });

    it('rejects a duplicate slug', async () => {
      insertCampaign({ slug: 'light-the-beacons' });

      const response = await handleAdminCampaignCreate(
        adminRequest('POST', BASE_BODY),
        db,
        BASE_BODY,
        ADMIN_ID,
      );
      const parsed = await response.json() as { fields: Record<string, string> };

      expect(response.status).toBe(400);
      expect(parsed.fields.slug).toMatch(/already in use/);
    });

    it('validates repeatability and rank thresholds', async () => {
      const body = {
        ...BASE_BODY,
        repeatable: 'yes',
        rank_thresholds: [3, 1],
      };
      const response = await handleAdminCampaignCreate(adminRequest('POST', body), db, body, ADMIN_ID);
      const parsed = await response.json() as { fields: Record<string, string> };

      expect(response.status).toBe(400);
      expect(parsed.fields).toMatchObject({
        repeatable: expect.any(String),
        rank_thresholds: expect.any(String),
      });
    });
  });

  describe('update', () => {
    it('updates an upcoming run target, window, and community badge metadata', async () => {
      seedAchievement('community-beacon-watch', {
        name: 'Beacon Warden',
        description: 'Old description',
        image_slug: 'old-image',
        is_repeatable: 0,
        metadata: '{"storyline":null,"rank":2,"rank_thresholds":[1],"unit":"beacons","criteria":"community_campaign_completed"}',
      });
      const campaignId = insertCampaign({ badge_slug: 'community-beacon-watch', enabled: 1 });
      insertRun(campaignId, { target: 100, start: TOMORROW, end: addDays(TOMORROW, 13), status: 'upcoming' });

      const body = {
        ...BASE_BODY,
        slug: 'beacon-watch',
        badge_slug: 'community-beacon-watch',
        name: 'Beacon Watch Revised',
        target_distance: 400,
        start_date: addDays(TODAY, 3),
        end_date: addDays(TODAY, 20),
        badge_name: 'Beacon Warden Revised',
        badge_description: 'Revised description',
        badge_image_slug: 'new-image',
        repeatable: true,
        rank_thresholds: [1, 5, 10, 20],
      };

      const response = await handleAdminCampaignUpdate(
        adminRequest('PUT', body),
        db,
        campaignId,
        body,
        ADMIN_ID,
      );
      const parsed = await response.json() as { campaign: Record<string, any> };

      expect(response.status).toBe(200);
      expect(parsed.campaign).toMatchObject({ name: 'Beacon Watch Revised', enabled: true });
      expect(parsed.campaign.activeRun).toMatchObject({
        target_distance: 400,
        start_date: addDays(TODAY, 3),
        end_date: addDays(TODAY, 20),
      });

      const badge = sqlite.prepare(
        "SELECT * FROM achievement_definitions WHERE slug = 'community-beacon-watch'",
      ).get() as unknown as { name: string; description: string; image_slug: string; is_repeatable: number; metadata: string };
      expect(badge).toMatchObject({
        name: 'Beacon Warden Revised',
        description: 'Revised description',
        image_slug: 'new-image',
        is_repeatable: 1,
      });
      const metadata = JSON.parse(badge.metadata) as Record<string, unknown>;
      expect(metadata.rank_thresholds).toEqual([1, 5, 10, 20]);
      expect(metadata).not.toHaveProperty('rank');

      expect(auditRows().map((row) => row.action)).toContain('update_campaign');
    });

    it('updates only copy fields on a started run, even with a past start date', async () => {
      seedAchievement('community-beacon-watch');
      const campaignId = insertCampaign({ badge_slug: 'community-beacon-watch', enabled: 1 });
      insertRun(campaignId, {
        target: 100,
        start: addDays(TODAY, -5),
        end: addDays(TODAY, 5),
        status: 'active',
      });

      const body = {
        ...BASE_BODY,
        slug: 'beacon-watch',
        badge_slug: 'community-beacon-watch',
        name: 'Beacon Watch Renamed',
        target_distance: 100,
        start_date: addDays(TODAY, -5),
        end_date: addDays(TODAY, 5),
        badge_name: '',
        badge_description: '',
        badge_image_slug: '',
        repeatable: null,
        rank_thresholds: null,
      };

      const response = await handleAdminCampaignUpdate(
        adminRequest('PUT', body),
        db,
        campaignId,
        body,
        ADMIN_ID,
      );

      expect(response.status).toBe(200);
      expect(campaignRow(campaignId).name).toBe('Beacon Watch Renamed');
    });

    it('rejects target, start-date, and badge changes once the run has started', async () => {
      seedAchievement('community-beacon-watch');
      seedAchievement('community-other');
      const campaignId = insertCampaign({ badge_slug: 'community-beacon-watch', enabled: 1 });
      insertRun(campaignId, {
        target: 100,
        start: addDays(TODAY, -5),
        end: addDays(TODAY, 5),
        status: 'active',
      });

      const body = {
        ...BASE_BODY,
        slug: 'beacon-watch',
        badge_slug: 'community-other',
        target_distance: 200,
        start_date: addDays(TODAY, -4),
        end_date: addDays(TODAY, 6),
        badge_name: '',
        badge_description: '',
        badge_image_slug: '',
        repeatable: null,
        rank_thresholds: null,
      };

      const response = await handleAdminCampaignUpdate(
        adminRequest('PUT', body),
        db,
        campaignId,
        body,
        ADMIN_ID,
      );
      const parsed = await response.json() as { fields: Record<string, string> };

      expect(response.status).toBe(400);
      expect(parsed.fields).toMatchObject({
        target_distance: expect.any(String),
        start_date: expect.any(String),
        badge_slug: expect.any(String),
      });

      const run = runRows(campaignId)[0];
      expect(run.target_distance).toBe(100);
      expect(campaignRow(campaignId).badge_slug).toBe('community-beacon-watch');
    });

    it('allows extending but not shortening an active run end date', async () => {
      seedAchievement('community-beacon-watch');
      const campaignId = insertCampaign({ badge_slug: 'community-beacon-watch', enabled: 1 });
      insertRun(campaignId, {
        target: 100,
        start: addDays(TODAY, -5),
        end: addDays(TODAY, 5),
        status: 'active',
      });

      const base = {
        slug: 'beacon-watch',
        name: 'Beacon Watch',
        description: 'A community campaign.',
        image_slug: 'beacon-watch',
        badge_slug: 'community-beacon-watch',
        target_distance: 100,
        start_date: addDays(TODAY, -5),
      };

      const shorten = { ...base, end_date: addDays(TODAY, 4) };
      const shortenResponse = await handleAdminCampaignUpdate(
        adminRequest('PUT', shorten),
        db,
        campaignId,
        shorten,
        ADMIN_ID,
      );
      expect(shortenResponse.status).toBe(400);

      const extend = { ...base, end_date: addDays(TODAY, 8) };
      const extendResponse = await handleAdminCampaignUpdate(
        adminRequest('PUT', extend),
        db,
        campaignId,
        extend,
        ADMIN_ID,
      );
      expect(extendResponse.status).toBe(200);
      expect(runRows(campaignId)[0].end_date).toBe(addDays(TODAY, 8));
    });

    it('keeps terminal run history frozen and rejects changed run fields', async () => {
      seedAchievement('community-beacon-watch');
      const campaignId = insertCampaign({ badge_slug: 'community-beacon-watch', enabled: 1 });
      insertRun(campaignId, {
        target: 100,
        start: addDays(TODAY, -20),
        end: addDays(TODAY, -7),
        status: 'completed',
      });

      const body = {
        slug: 'beacon-watch',
        name: 'Beacon Watch Copy Edit',
        description: 'A community campaign.',
        image_slug: 'beacon-watch',
        badge_slug: 'community-beacon-watch',
        target_distance: 150,
        start_date: addDays(TODAY, -20),
        end_date: addDays(TODAY, -7),
      };

      const changed = await handleAdminCampaignUpdate(
        adminRequest('PUT', body),
        db,
        campaignId,
        body,
        ADMIN_ID,
      );
      const parsed = await changed.json() as { fields: Record<string, string> };
      expect(changed.status).toBe(400);
      expect(parsed.fields.target_distance).toEqual(expect.any(String));

      const unchanged = { ...body, target_distance: 100 };
      const ok = await handleAdminCampaignUpdate(
        adminRequest('PUT', unchanged),
        db,
        campaignId,
        unchanged,
        ADMIN_ID,
      );
      expect(ok.status).toBe(200);
    });

    it('creates a first run when updating a definition that has none', async () => {
      seedAchievement('community-beacon-watch');
      const campaignId = insertCampaign({ badge_slug: 'community-beacon-watch', enabled: 0 });

      const body = {
        slug: 'beacon-watch',
        name: 'Beacon Watch',
        description: 'A community campaign.',
        image_slug: 'beacon-watch',
        badge_slug: 'community-beacon-watch',
        target_distance: 75,
        start_date: TOMORROW,
        end_date: addDays(TOMORROW, 13),
      };

      const response = await handleAdminCampaignUpdate(
        adminRequest('PUT', body),
        db,
        campaignId,
        body,
        ADMIN_ID,
      );

      expect(response.status).toBe(200);
      const runs = runRows(campaignId);
      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({
        run_number: 1,
        target_distance: 75,
        start_date: TOMORROW,
        status: 'upcoming',
      });
    });

    it('never overwrites a badge owned by another feature', async () => {
      seedAchievement('challenge-foreign', {
        badge_type: 'challenge',
        name: 'Foreign Badge',
      });
      const campaignId = insertCampaign({ badge_slug: 'challenge-foreign', enabled: 1 });
      insertRun(campaignId, { target: 100, start: TOMORROW, end: addDays(TOMORROW, 13), status: 'upcoming' });

      const body = {
        ...BASE_BODY,
        slug: 'beacon-watch',
        badge_slug: 'challenge-foreign',
        badge_name: 'Hijacked',
        badge_description: 'Should not apply',
        badge_image_slug: 'hijacked',
        repeatable: false,
        rank_thresholds: [1],
      };

      const response = await handleAdminCampaignUpdate(
        adminRequest('PUT', body),
        db,
        campaignId,
        body,
        ADMIN_ID,
      );
      const parsed = await response.json() as { fields: Record<string, string> };

      expect(response.status).toBe(400);
      expect(parsed.fields.badge_slug).toMatch(/another feature/);
      const badge = sqlite.prepare(
        "SELECT name, badge_type FROM achievement_definitions WHERE slug = 'challenge-foreign'",
      ).get() as unknown as { name: string; badge_type: string };
      expect(badge).toEqual({ name: 'Foreign Badge', badge_type: 'challenge' });
    });
  });

  describe('suggestions', () => {
    it('uses the past 30 days and the documented formula', async () => {
      insertProgress(1, TODAY, 100);
      insertProgress(2, TODAY, 50);
      insertProgress(1, '2020-01-01', 999);

      const response = await handleAdminCampaignSuggestions(
        adminRequest('GET', undefined, 'https://example.com/api/admin/campaigns/suggestions'),
        db,
      );
      const body = await response.json() as Record<string, number>;

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        thirtyDayTotalDistance: 150,
        thirtyDayActiveUsers: 2,
        suggestedParticipantCount: 2,
        suggestedDurationDays: 14,
        suggestedTargetDistance: Math.round((150 / 2) * 14 * 0.25),
      });

      const clampedLow = await handleAdminCampaignSuggestions(
        adminRequest('GET', undefined, 'https://example.com/api/admin/campaigns/suggestions?durationDays=1'),
        db,
      );
      expect(await clampedLow.json()).toMatchObject({
        suggestedDurationDays: 7,
        suggestedTargetDistance: Math.round((150 / 2) * 7 * 0.25),
      });

      const clampedHigh = await handleAdminCampaignSuggestions(
        adminRequest('GET', undefined, 'https://example.com/api/admin/campaigns/suggestions?durationDays=90'),
        db,
      );
      expect(await clampedHigh.json()).toMatchObject({
        suggestedDurationDays: 30,
        suggestedTargetDistance: Math.round((150 / 2) * 30 * 0.25),
      });
    });

    it('handles a community with no recent walks', async () => {
      const response = await handleAdminCampaignSuggestions(adminRequest(), db);
      expect(await response.json()).toMatchObject({
        thirtyDayTotalDistance: 0,
        thirtyDayActiveUsers: 0,
        suggestedTargetDistance: 0,
      });

      const invalid = await handleAdminCampaignSuggestions(
        adminRequest('GET', undefined, 'https://example.com/api/admin/campaigns/suggestions?durationDays=abc'),
        db,
      );
      expect(await invalid.json()).toMatchObject({ suggestedDurationDays: 14 });
    });
  });

  describe('disable confirmation', () => {
    it('disables immediately when no participants are active', async () => {
      const campaignId = insertCampaign({ enabled: 1 });
      const runId = insertRun(campaignId, { status: 'active' });
      insertParticipant(campaignId, runId, { userId: 1, status: 'removed' });

      const response = await handleAdminCampaignDisable(
        adminRequest('PUT'),
        db,
        campaignId,
        undefined,
        ADMIN_ID,
      );

      expect(response.status).toBe(200);
      expect(campaignRow(campaignId).enabled).toBe(0);
      expect(auditRows().map((row) => row.action)).toEqual(['disable_campaign']);
    });

    it('asks for confirmation and changes nothing when active participants exist', async () => {
      const campaignId = insertCampaign({ enabled: 1 });
      const runId = insertRun(campaignId, { status: 'active' });
      insertParticipant(campaignId, runId, { userId: 1 });
      insertParticipant(campaignId, runId, { userId: 2 });

      const response = await handleAdminCampaignDisable(
        adminRequest('PUT'),
        db,
        campaignId,
        {},
        ADMIN_ID,
      );
      const body = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(400);
      expect(body).toEqual({ activeParticipants: 2, requiresConfirmation: true });
      expect(campaignRow(campaignId).enabled).toBe(1);
      expect(participantRows(campaignId).every((row) => row.status === 'active')).toBe(true);
      expect(auditRows()).toHaveLength(0);
    });

    it('cancels active participants while keeping ledger rows and earned badges', async () => {
      const campaignId = insertCampaign({ enabled: 1 });
      const runId = insertRun(campaignId, { status: 'active' });
      const participantId = insertParticipant(campaignId, runId, { userId: 1, distance: 12 });
      const progressId = insertProgress(1, TODAY, 12);
      insertLedger(participantId, runId, progressId, 12);

      sqlite.prepare(
        `INSERT INTO achievement_definitions
           (slug, name, badge_type, is_repeatable, metadata)
         VALUES ('community-beacon-watch', 'Beacon Warden', 'community', 1, '{}')`,
      ).run();
      const achievementId = Number(
        (sqlite.prepare("SELECT id FROM achievement_definitions WHERE slug = 'community-beacon-watch'")
          .get() as unknown as { id: number }).id,
      );
      sqlite.prepare(
        'INSERT INTO user_achievement_instances (user_id, achievement_id, idempotency_key) VALUES (?, ?, ?)',
      ).run(1, achievementId, 'campaign:beacon-watch:run:1');

      const response = await handleAdminCampaignDisable(
        adminRequest('PUT', { cancelActive: true }),
        db,
        campaignId,
        { cancelActive: true },
        ADMIN_ID,
      );

      expect(response.status).toBe(200);
      expect(campaignRow(campaignId).enabled).toBe(0);
      const participants = participantRows(campaignId);
      expect(participants[0]).toMatchObject({ status: 'removed' });
      expect(participants[0].removed_at).not.toBeNull();
      expect(ledgerCount()).toBe(1);
      expect(
        (sqlite.prepare('SELECT COUNT(*) AS count FROM user_achievement_instances').get() as unknown as { count: number }).count,
      ).toBe(1);
      expect(auditRows().map((row) => row.action)).toEqual([
        'disable_campaign',
        'cancel_campaign_participants',
      ]);
    });

    it('leaves participant rows untouched when cancellation is declined', async () => {
      const campaignId = insertCampaign({ enabled: 1 });
      const runId = insertRun(campaignId, { status: 'active' });
      insertParticipant(campaignId, runId, { userId: 1 });

      const response = await handleAdminCampaignDisable(
        adminRequest('PUT', { cancelActive: false }),
        db,
        campaignId,
        { cancelActive: false },
        ADMIN_ID,
      );

      expect(response.status).toBe(200);
      expect(campaignRow(campaignId).enabled).toBe(0);
      expect(participantRows(campaignId)[0]).toMatchObject({ status: 'active', removed_at: null });
      expect(auditRows().map((row) => row.action)).toEqual(['disable_campaign']);
    });
  });

  describe('enable', () => {
    it('enables the campaign and backfills in-window walks for active participants', async () => {
      const campaignId = insertCampaign({ enabled: 0 });
      const runId = insertRun(campaignId, {
        status: 'active',
        start: addDays(TODAY, -3),
        end: addDays(TODAY, 3),
      });
      const participantId = insertParticipant(campaignId, runId, { userId: 1 });
      insertProgress(1, TODAY, 7.5);
      insertProgress(1, addDays(TODAY, -10), 99);

      const response = await handleAdminCampaignEnable(
        adminRequest('PUT'),
        db,
        campaignId,
        ADMIN_ID,
      );

      expect(response.status).toBe(200);
      expect(campaignRow(campaignId).enabled).toBe(1);
      expect(ledgerCount()).toBe(1);
      const participant = participantRows(campaignId)[0];
      expect(participant.id).toBe(participantId);
      expect(participant.progress_distance).toBe(7.5);
      expect(auditRows()[0]).toMatchObject({ action: 'enable_campaign', target_id: campaignId });
    });

    it('completes the run when re-enable backfill credits walks saved while disabled', async () => {
      seedAchievement('community-beacon-watch');
      const campaignId = insertCampaign({ enabled: 1, badge_slug: 'community-beacon-watch' });
      const runId = insertRun(campaignId, {
        status: 'active',
        target: 10,
        start: addDays(TODAY, -3),
        end: addDays(TODAY, 3),
      });
      insertParticipant(campaignId, runId, { userId: 1 });

      // Mid-run freeze: participants stay active, so credit stops only because
      // the campaign is disabled.
      const disableResponse = await handleAdminCampaignDisable(
        adminRequest('PUT'),
        db,
        campaignId,
        { cancelActive: false },
        ADMIN_ID,
      );
      expect(disableResponse.status).toBe(200);
      expect(campaignRow(campaignId).enabled).toBe(0);

      // Saved while disabled: no reconciliation ran, so nothing is credited yet.
      insertProgress(1, TODAY, 12);
      expect(ledgerCount()).toBe(0);

      const response = await handleAdminCampaignEnable(
        adminRequest('PUT'),
        db,
        campaignId,
        ADMIN_ID,
      );

      expect(response.status).toBe(200);
      expect(runRows(campaignId)[0]).toMatchObject({
        status: 'completed',
        participant_count: 1,
        contributor_count: 1,
        total_distance: 12,
      });
      expect(runRows(campaignId)[0].completed_at).not.toBeNull();

      const badges = sqlite.prepare(
        'SELECT user_id, idempotency_key FROM user_achievement_instances ORDER BY id ASC',
      ).all() as unknown as Array<{ user_id: number; idempotency_key: string }>;
      expect(badges).toHaveLength(1);
      expect(badges[0]).toMatchObject({
        user_id: 1,
        idempotency_key: `campaign:beacon-watch:run:${runId}`,
      });
    });

    it('leaves the run active when re-enable backfill stays below the target', async () => {
      const campaignId = insertCampaign({ enabled: 1 });
      const runId = insertRun(campaignId, {
        status: 'active',
        target: 100,
        start: addDays(TODAY, -3),
        end: addDays(TODAY, 3),
      });
      insertParticipant(campaignId, runId, { userId: 1 });

      await handleAdminCampaignDisable(
        adminRequest('PUT'),
        db,
        campaignId,
        { cancelActive: false },
        ADMIN_ID,
      );
      insertProgress(1, TODAY, 5);

      const response = await handleAdminCampaignEnable(
        adminRequest('PUT'),
        db,
        campaignId,
        ADMIN_ID,
      );

      expect(response.status).toBe(200);
      expect(runRows(campaignId)[0]).toMatchObject({
        status: 'active',
        completed_at: null,
        participant_count: null,
        total_distance: null,
      });
      expect(participantRows(campaignId)[0].progress_distance).toBe(5);
    });
  });

  describe('retrigger', () => {
    it('rejects a disabled campaign with an enable-first message', async () => {
      const campaignId = insertCampaign({ enabled: 0 });
      insertRun(campaignId, { status: 'completed' });

      const response = await handleAdminCampaignRetrigger(
        adminRequest('POST'),
        db,
        campaignId,
        {},
        ADMIN_ID,
      );
      const body = await response.json() as { error: string };

      expect(response.status).toBe(400);
      expect(body.error).toMatch(/Enable this campaign/);
      expect(runRows(campaignId)).toHaveLength(1);
    });

    it('rejects while the latest run is upcoming or active', async () => {
      for (const status of ['upcoming', 'active'] as const) {
        const campaignId = insertCampaign({ enabled: 1, slug: `campaign-${status}` });
        insertRun(campaignId, { status });

        const response = await handleAdminCampaignRetrigger(
          adminRequest('POST'),
          db,
          campaignId,
          {},
          ADMIN_ID,
        );
        const body = await response.json() as { error: string };

        expect(response.status).toBe(400);
        expect(body.error).toMatch(new RegExp(`still ${status}`));
      }
    });

    it('creates an unannounced upcoming run with suggestion defaults and appends history', async () => {
      seedAchievement('community-beacon-watch');
      const campaignId = insertCampaign({ enabled: 1, badge_slug: 'community-beacon-watch' });
      insertProgress(1, TODAY, 400);
      const previousRunId = insertRun(campaignId, {
        status: 'completed',
        target: 100,
        start: addDays(TODAY, -30),
        end: addDays(TODAY, -17),
      });
      const participantId = insertParticipant(campaignId, previousRunId, { userId: 1, distance: 42 });
      const progressId = insertProgress(1, addDays(TODAY, -25), 42);
      insertLedger(participantId, previousRunId, progressId, 42);

      const beforeRun = runRows(campaignId)[0];
      const beforeParticipant = participantRows(campaignId)[0];
      const beforeLedger = sqlite.prepare('SELECT * FROM campaign_progress_ledger ORDER BY id ASC').all();

      const response = await handleAdminCampaignRetrigger(
        adminRequest('POST'),
        db,
        campaignId,
        {},
        ADMIN_ID,
      );
      const body = await response.json() as { campaign: Record<string, any>; run: Record<string, any> };

      expect(response.status).toBe(201);
      expect(body.run).toMatchObject({
        run_number: 2,
        status: 'upcoming',
        announced_at: null,
        start_date: TOMORROW,
        end_date: addDays(TOMORROW, 13),
      });
      expect(body.run.target_distance).toBe(
        Math.max(1, Math.round((442 / 1) * 14 * 0.25)),
      );
      expect(body.campaign.activeRun).toMatchObject({ id: body.run.id, run_number: 2 });

      const runs = runRows(campaignId);
      expect(runs).toHaveLength(2);
      expect(runs[0]).toEqual(beforeRun);
      expect(runs[1]).toMatchObject({ run_number: 2, status: 'upcoming' });
      expect(participantRows(campaignId)).toEqual([beforeParticipant]);
      expect(
        sqlite.prepare('SELECT * FROM campaign_progress_ledger ORDER BY id ASC').all(),
      ).toEqual(beforeLedger);

      const audits = auditRows();
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: 'retrigger_campaign',
        target_type: 'community_campaign',
        target_id: campaignId,
      });
      expect(auditDetails(audits[0])).toMatchObject({
        run_number: 2,
        previous_run_number: 1,
        target_distance: body.run.target_distance,
      });
    });

    it('applies overrides and clamps the default target to at least 1 km', async () => {
      const campaignId = insertCampaign({ enabled: 1 });
      insertRun(campaignId, { status: 'expired', target: 50, start: addDays(TODAY, -30), end: addDays(TODAY, -17) });

      const defaultResponse = await handleAdminCampaignRetrigger(
        adminRequest('POST'),
        db,
        campaignId,
        {},
        ADMIN_ID,
      );
      const defaultBody = await defaultResponse.json() as { run: Record<string, any> };
      expect(defaultBody.run.target_distance).toBe(1);

      const overrideCampaignId = insertCampaign({ slug: 'override-campaign', enabled: 1 });
      insertRun(overrideCampaignId, {
        status: 'expired',
        target: 50,
        start: addDays(TODAY, -30),
        end: addDays(TODAY, -17),
      });

      const overrides = {
        target_distance: 321,
        start_date: addDays(TODAY, 5),
        end_date: addDays(TODAY, 18),
      };
      const overrideResponse = await handleAdminCampaignRetrigger(
        adminRequest('POST', overrides),
        db,
        overrideCampaignId,
        overrides,
        ADMIN_ID,
      );
      const overrideBody = await overrideResponse.json() as { run: Record<string, any> };

      expect(overrideResponse.status).toBe(201);
      expect(overrideBody.run).toMatchObject({
        run_number: 2,
        target_distance: 321,
        start_date: addDays(TODAY, 5),
        end_date: addDays(TODAY, 18),
      });
    });

    it('rejects invalid overrides with field errors', async () => {
      const campaignId = insertCampaign({ enabled: 1 });
      insertRun(campaignId, { status: 'completed' });

      const body = {
        target_distance: -5,
        start_date: addDays(TODAY, -1),
        end_date: addDays(TODAY, -2),
      };
      const response = await handleAdminCampaignRetrigger(
        adminRequest('POST', body),
        db,
        campaignId,
        body,
        ADMIN_ID,
      );
      const parsed = await response.json() as { error: string; fields: Record<string, string> };

      expect(response.status).toBe(400);
      expect(parsed.error).toBe('validation');
      expect(parsed.fields).toMatchObject({
        target_distance: expect.any(String),
        start_date: expect.any(String),
      });
      expect(runRows(campaignId)).toHaveLength(1);
    });
  });
});
