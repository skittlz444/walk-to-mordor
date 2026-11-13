import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

import { app } from '../../src/index';
import type { DbClient } from '../../src/db';
import { addDays, utcToday } from '../../src/event-utils';

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
const TODAY = utcToday();
const TOMORROW = addDays(TODAY, 1);
const ADMIN_AUTH = 'Bearer TEST_MOCK_TOKEN_frodo';
const USER_AUTH = 'Bearer TEST_MOCK_TOKEN_sam';

const PREREQUISITE_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  username TEXT UNIQUE,
  email TEXT,
  approved INTEGER DEFAULT 1,
  is_admin INTEGER DEFAULT 0
);

CREATE TABLE progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  date DATE NOT NULL,
  distance REAL NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(date, user_id)
);
`;

const MIGRATIONS = [
  '0121_create_admin_audit_log.sql',
  '0142_create_achievement_definitions.sql',
  '0161_create_campaign_definitions.sql',
  '0162_create_campaign_runs.sql',
  '0163_create_campaign_participants.sql',
  '0164_create_campaign_progress_ledger.sql',
];

type SqlValue = string | number | null;

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
  } as unknown as D1Database;

  const batch = async (statements: Array<{ run: () => Promise<unknown> }>) => {
    database.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      database.exec('COMMIT');
      return results;
    } catch (error: unknown) {
      database.exec('ROLLBACK');
      throw error;
    }
  };
  (connection as unknown as { batch: typeof batch }).batch = batch;

  return {
    read: connection as unknown as D1Database,
    write: connection as unknown as D1Database,
  };
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
}

function envFor(db: DbClient): Env {
  return {
    DB: db.read,
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
    ALLOW_TEST_AUTH: 'true',
  } as unknown as Env;
}

function authed(auth: string, method = 'GET', body?: unknown): RequestInit {
  return {
    method,
    headers: {
      Authorization: auth,
      'content-type': 'application/json',
      'CF-Connecting-IP': '203.0.113.9',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

const CREATE_BODY = {
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

describe('admin campaign routes', () => {
  let sqlite: DatabaseSync;
  let db: DbClient;
  let env: Env;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(PREREQUISITE_SCHEMA);
    for (const filename of MIGRATIONS) {
      sqlite.exec(readMigration(filename));
    }
    sqlite.prepare(
      "INSERT INTO users (username, email, approved, is_admin) VALUES ('frodo', 'frodo@example.com', 1, 1)",
    ).run();
    sqlite.prepare(
      "INSERT INTO users (username, email, approved, is_admin) VALUES ('sam', 'sam@example.com', 1, 0)",
    ).run();

    db = createTestDb(sqlite);
    env = envFor(db);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  it('serves suggestions from the static path instead of parsing it as an id', async () => {
    const response = await app.request(
      '/api/admin/campaigns/suggestions?durationDays=10',
      authed(ADMIN_AUTH),
      env,
    );
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      suggestedDurationDays: 10,
      suggestedTargetDistance: expect.any(Number),
      suggestedParticipantCount: expect.any(Number),
      thirtyDayTotalDistance: expect.any(Number),
      thirtyDayActiveUsers: expect.any(Number),
    });
  });

  it('creates, lists, updates, enables, disables, and retriggers through the admin routes', async () => {
    const created = await app.request(
      '/api/admin/campaigns',
      authed(ADMIN_AUTH, 'POST', CREATE_BODY),
      env,
    );
    const createdBody = await created.json() as { campaign: Record<string, any> };
    expect(created.status).toBe(201);
    const campaignId = createdBody.campaign.id as number;
    expect(createdBody.campaign).toMatchObject({ enabled: false, activeRun: { run_number: 1 } });

    const list = await app.request('/api/admin/campaigns', authed(ADMIN_AUTH), env);
    const listBody = await list.json() as { campaigns: Array<Record<string, any>> };
    expect(list.status).toBe(200);
    expect(listBody.campaigns.map((campaign) => campaign.id)).toContain(campaignId);

    const detail = await app.request(
      `/api/admin/campaigns/${campaignId}`,
      authed(ADMIN_AUTH),
      env,
    );
    expect(detail.status).toBe(200);

    const updateBody = {
      ...CREATE_BODY,
      name: 'Light the Beacons Revised',
      target_distance: 300,
    };
    const updated = await app.request(
      `/api/admin/campaigns/${campaignId}`,
      authed(ADMIN_AUTH, 'PUT', updateBody),
      env,
    );
    expect(updated.status).toBe(200);
    expect((await updated.json() as { campaign: Record<string, any> }).campaign.name)
      .toBe('Light the Beacons Revised');

    const enabled = await app.request(
      `/api/admin/campaigns/${campaignId}/enable`,
      authed(ADMIN_AUTH, 'PUT'),
      env,
    );
    expect(enabled.status).toBe(200);
    expect((await enabled.json() as { campaign: Record<string, any> }).campaign.enabled).toBe(true);

    const retriggerWhileUpcoming = await app.request(
      `/api/admin/campaigns/${campaignId}/retrigger`,
      authed(ADMIN_AUTH, 'POST', {}),
      env,
    );
    expect(retriggerWhileUpcoming.status).toBe(400);

    const disabled = await app.request(
      `/api/admin/campaigns/${campaignId}/disable`,
      authed(ADMIN_AUTH, 'PUT', {}),
      env,
    );
    expect(disabled.status).toBe(200);
    expect((await disabled.json() as { campaign: Record<string, any> }).campaign.enabled).toBe(false);

    sqlite.prepare(
      "UPDATE campaign_runs SET status = 'completed' WHERE campaign_id = ?",
    ).run(campaignId);

    const retriggerWhileDisabled = await app.request(
      `/api/admin/campaigns/${campaignId}/retrigger`,
      authed(ADMIN_AUTH, 'POST', {}),
      env,
    );
    expect(retriggerWhileDisabled.status).toBe(400);

    sqlite.prepare('UPDATE campaign_definitions SET enabled = 1 WHERE id = ?').run(campaignId);
    const retriggered = await app.request(
      `/api/admin/campaigns/${campaignId}/retrigger`,
      authed(ADMIN_AUTH, 'POST', {}),
      env,
    );
    const retriggeredBody = await retriggered.json() as { run: Record<string, any> };
    expect(retriggered.status).toBe(201);
    expect(retriggeredBody.run).toMatchObject({ run_number: 2, status: 'upcoming' });
  });

  it('rejects non-admin sessions with 403 on every campaign endpoint', async () => {
    const requests: Array<[string, string, unknown?]> = [
      ['GET', '/api/admin/campaigns'],
      ['GET', '/api/admin/campaigns/suggestions'],
      ['POST', '/api/admin/campaigns', CREATE_BODY],
      ['GET', '/api/admin/campaigns/1'],
      ['PUT', '/api/admin/campaigns/1', CREATE_BODY],
      ['PUT', '/api/admin/campaigns/1/enable'],
      ['PUT', '/api/admin/campaigns/1/disable', {}],
      ['POST', '/api/admin/campaigns/1/retrigger', {}],
    ];

    for (const [method, url, body] of requests) {
      const response = await app.request(url, authed(USER_AUTH, method, body), env);
      expect(response.status).toBe(403);
    }
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await app.request('/api/admin/campaigns', undefined, env);
    expect(response.status).toBe(401);
  });

  it('rejects a non-canonical campaign id', async () => {
    const response = await app.request(
      '/api/admin/campaigns/01',
      authed(ADMIN_AUTH),
      env,
    );
    expect(response.status).toBe(400);
  });
});
